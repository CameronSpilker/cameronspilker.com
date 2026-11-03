import { isUuid } from "@/lib/gifts/input";
import { unclaimItem } from "@/lib/gifts/server/store";
import { body, fail, handle, json, validSlug, type ItemContext } from "@/lib/gifts/server/http";

/** Undo a claim, with the token the claim handed back. */
export async function DELETE(req: Request, { params }: ItemContext) {
  const { slug, id } = await params;
  if (!validSlug(slug) || !isUuid(id)) return fail("not_found", 404);
  return handle(async () => {
    const input = (await body(req)) as { token?: unknown } | null;
    const token = input?.token;
    if (typeof token !== "string" || token.length > 100) return fail("forbidden", 403);
    await unclaimItem(slug, id, token);
    return json({ ok: true });
  });
}
