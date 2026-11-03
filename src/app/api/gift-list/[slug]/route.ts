import { isUuid, readListDetails } from "@/lib/gifts/input";
import { clearClaims, loadList, ownedList, reorderItems, updateList } from "@/lib/gifts/server/store";
import { body, editKey, fail, handle, json, validSlug, type SlugContext } from "@/lib/gifts/server/http";

/**
 * The list. A guest gets every claim; the owner, presenting the edit key, gets
 * the list with claims left out so the surprise holds.
 */
export async function GET(req: Request, { params }: SlugContext) {
  const { slug } = await params;
  if (!validSlug(slug)) return fail("not_found", 404);
  return handle(async () => {
    const key = editKey(req);
    if (key) await ownedList(slug, key);
    const list = await loadList(slug, !key);
    return list ? json(list) : fail("not_found", 404);
  });
}

/** The owner changes the header, the order, or clears claims after an occasion. */
export async function PATCH(req: Request, { params }: SlugContext) {
  const { slug } = await params;
  if (!validSlug(slug)) return fail("not_found", 404);
  return handle(async () => {
    const list = await ownedList(slug, editKey(req));
    const input = (await body(req)) as Record<string, unknown> | null;
    if (!input || typeof input !== "object") return fail("bad_request");

    if ("order" in input) {
      const order = input.order;
      if (!Array.isArray(order) || order.length > 200 || !order.every(isUuid)) return fail("bad_request");
      await reorderItems(list.id, order);
      return json({ ok: true });
    }
    if (input.clearClaims === true) {
      await clearClaims(list.id);
      return json({ ok: true });
    }
    const parsed = readListDetails(input);
    if (!parsed.ok) return fail(parsed.error);
    await updateList(list.id, parsed.value);
    return json({ ok: true });
  });
}
