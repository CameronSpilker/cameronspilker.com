/**
 * Every read and write the gift list makes. Server only: it holds the database
 * connection, and nothing in here is safe to ship to a browser.
 *
 * The connection string is DATABASE_URL. On Vercel it is Supabase's
 * transaction pooler (port 6543), which is why prepared statements are off.
 */
import postgres from "postgres";
import { hashSecret, makeSlug, newSecret, secretMatches } from "../ids.ts";
import { LIMITS, type ListDetails } from "../input.ts";
import { wouldOverClaim } from "../claims.ts";
import type { GiftItem, GiftItemInput, GiftList } from "../types.ts";

export class NotConfigured extends Error {}
export class GiftError extends Error {
  constructor(
    public code: "not_found" | "full" | "too_many_items" | "forbidden",
    public status: number,
  ) {
    super(code);
  }
}

const globalForDb = globalThis as unknown as { giftSql?: postgres.Sql };

function db(): postgres.Sql {
  const url = process.env.DATABASE_URL;
  if (!url) throw new NotConfigured("DATABASE_URL is not set");
  globalForDb.giftSql ??= postgres(url, {
    prepare: false,
    max: 3,
    idle_timeout: 20,
    connect_timeout: 10,
    onnotice: () => {},
  });
  return globalForDb.giftSql;
}

export function isConfigured(): boolean {
  return Boolean(process.env.DATABASE_URL);
}

type ListRow = { id: string; slug: string; edit_key_hash: string; owner_name: string; title: string; note: string };
type ItemRow = {
  id: string;
  title: string;
  url: string | null;
  image_url: string | null;
  price_cents: number | null;
  store: string | null;
  note: string | null;
  quantity: number | null;
  claims: { id: string; name: string | null }[];
};

export async function createList(details: ListDetails): Promise<{ slug: string; editKey: string }> {
  const sql = db();
  const editKey = newSecret();
  // A collision on eight random characters is close to impossible; retry anyway.
  for (let attempt = 0; attempt < 4; attempt++) {
    const slug = makeSlug(details.ownerName);
    const rows = await sql`
      insert into gift_lists (slug, edit_key_hash, owner_name, title, note)
      values (${slug}, ${hashSecret(editKey)}, ${details.ownerName}, ${details.title}, ${details.note})
      on conflict (slug) do nothing
      returning slug`;
    if (rows.length) return { slug, editKey };
  }
  throw new Error("could not find a free slug");
}

async function findList(slug: string): Promise<ListRow | null> {
  const rows = await db()<ListRow[]>`
    select id, slug, edit_key_hash, owner_name, title, note from gift_lists where slug = ${slug}`;
  return rows[0] ?? null;
}

/** The list, for an owner who presented the right edit key. Throws otherwise. */
export async function ownedList(slug: string, editKey: string | null): Promise<ListRow> {
  const list = await findList(slug);
  if (!list) throw new GiftError("not_found", 404);
  if (!editKey || !secretMatches(editKey, list.edit_key_hash)) throw new GiftError("forbidden", 403);
  return list;
}

/**
 * The list as a page shows it. `withClaims` is false for the owner's editor,
 * which never learns what has been claimed.
 */
export async function loadList(slug: string, withClaims: boolean): Promise<GiftList | null> {
  const list = await findList(slug);
  if (!list) return null;
  const items = await db()<ItemRow[]>`
    select i.id, i.title, i.url, i.image_url, i.price_cents, i.store, i.note, i.quantity,
      coalesce(
        (select json_agg(json_build_object('id', c.id, 'name', c.name) order by c.created_at)
         from gift_claims c where c.item_id = i.id),
        '[]'::json
      ) as claims
    from gift_items i
    where i.list_id = ${list.id}
    order by i.position, i.created_at`;
  return {
    slug: list.slug,
    ownerName: list.owner_name,
    title: list.title,
    note: list.note,
    items: items.map(
      (row): GiftItem => ({
        id: row.id,
        title: row.title,
        url: row.url,
        imageUrl: row.image_url,
        priceCents: row.price_cents,
        store: row.store,
        note: row.note,
        quantity: row.quantity,
        claims: withClaims ? row.claims : [],
      }),
    ),
  };
}

export async function updateList(listId: string, details: Partial<ListDetails>): Promise<void> {
  const patch: Record<string, string> = {};
  if (details.ownerName !== undefined) patch.owner_name = details.ownerName;
  if (details.title !== undefined) patch.title = details.title;
  if (details.note !== undefined) patch.note = details.note;
  if (!Object.keys(patch).length) return;
  await db()`update gift_lists set ${db()(patch)}, updated_at = now() where id = ${listId}`;
}

function itemColumns(input: GiftItemInput) {
  return {
    title: input.title,
    url: input.url,
    image_url: input.imageUrl,
    price_cents: input.priceCents,
    store: input.store,
    note: input.note,
    quantity: input.quantity,
  };
}

/** New items go to the bottom; the owner drags them up. */
export async function addItem(listId: string, input: GiftItemInput): Promise<string> {
  return db().begin(async (tx) => {
    // Serialise adds on one list so two tabs cannot share a position or slip past the cap.
    await tx`select id from gift_lists where id = ${listId} for update`;
    const [{ count, next }] = await tx<{ count: number; next: number }[]>`
      select count(*)::int as count, coalesce(max(position) + 1, 0)::int as next
      from gift_items where list_id = ${listId}`;
    if (count >= LIMITS.items) throw new GiftError("too_many_items", 409);
    const [row] = await tx<{ id: string }[]>`
      insert into gift_items ${tx({ list_id: listId, position: next, ...itemColumns(input) })}
      returning id`;
    await tx`update gift_lists set updated_at = now() where id = ${listId}`;
    return row.id;
  });
}

export async function updateItem(listId: string, itemId: string, input: GiftItemInput): Promise<void> {
  const rows = await db()`
    update gift_items set ${db()(itemColumns(input))}
    where id = ${itemId} and list_id = ${listId}
    returning id`;
  if (!rows.length) throw new GiftError("not_found", 404);
}

export async function deleteItem(listId: string, itemId: string): Promise<void> {
  const rows = await db()`delete from gift_items where id = ${itemId} and list_id = ${listId} returning id`;
  if (!rows.length) throw new GiftError("not_found", 404);
}

/** Rewrites every position from the order given. Ids not on this list are ignored. */
export async function reorderItems(listId: string, ids: string[]): Promise<void> {
  await db()`
    update gift_items as i set position = o.position
    from (select id::uuid as id, (ordinality - 1)::int as position
          from unnest(${db().array(ids)}::text[]) with ordinality as t(id, ordinality)) as o
    where i.id = o.id and i.list_id = ${listId}`;
}

/** For the owner after an occasion: every claim on the list goes. */
export async function clearClaims(listId: string): Promise<void> {
  await db()`
    delete from gift_claims c using gift_items i
    where c.item_id = i.id and i.list_id = ${listId}`;
}

/**
 * A guest says they are getting something. The item row is locked while the
 * claims are counted, so two guests pressing at once cannot both take the last
 * one.
 */
export async function claimItem(
  slug: string,
  itemId: string,
  name: string | null,
): Promise<{ claimId: string; token: string }> {
  const token = newSecret();
  return db().begin(async (tx) => {
    const items = await tx<{ id: string; quantity: number | null }[]>`
      select i.id, i.quantity from gift_items i
      join gift_lists l on l.id = i.list_id
      where i.id = ${itemId} and l.slug = ${slug}
      for update of i`;
    const item = items[0];
    if (!item) throw new GiftError("not_found", 404);
    const [{ count }] = await tx<{ count: number }[]>`
      select count(*)::int as count from gift_claims where item_id = ${itemId}`;
    if (wouldOverClaim(item.quantity, count)) throw new GiftError("full", 409);
    const [row] = await tx<{ id: string }[]>`
      insert into gift_claims (item_id, name, token_hash)
      values (${itemId}, ${name}, ${hashSecret(token)})
      returning id`;
    return { claimId: row.id, token };
  });
}

/** Undo, by whoever holds the token from the claim. */
export async function unclaimItem(slug: string, claimId: string, token: string): Promise<void> {
  const rows = await db()<{ id: string; token_hash: string }[]>`
    select c.id, c.token_hash from gift_claims c
    join gift_items i on i.id = c.item_id
    join gift_lists l on l.id = i.list_id
    where c.id = ${claimId} and l.slug = ${slug}`;
  const claim = rows[0];
  if (!claim) throw new GiftError("not_found", 404);
  if (!secretMatches(token, claim.token_hash)) throw new GiftError("forbidden", 403);
  await db()`delete from gift_claims where id = ${claimId}`;
}
