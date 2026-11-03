import { isUuid, readClaimName } from "@/lib/gifts/input";
import { claimItem } from "@/lib/gifts/server/store";
import { body, fail, handle, json, validSlug, type ItemContext } from "@/lib/gifts/server/http";

/**
 * A guest marks something as theirs to buy. No key needed: anyone holding the
 * share link may claim. The answer carries the undo token, kept in the guest's
 * browser and nowhere else.
 */
export async function POST(req: Request, { params }: ItemContext) {
  const { slug, id } = await params;
  if (!validSlug(slug) || !isUuid(id)) return fail("not_found", 404);
  return handle(async () => {
    const input = (await body(req)) as { name?: unknown } | null;
    const name = readClaimName(input?.name ?? null);
    if (!name.ok) return fail(name.error);
    const claim = await claimItem(slug, id, name.value);
    return json(claim, 201);
  });
}
