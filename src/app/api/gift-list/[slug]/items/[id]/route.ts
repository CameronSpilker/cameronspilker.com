import { isUuid, readItem } from "@/lib/gifts/input";
import { deleteItem, ownedList, updateItem } from "@/lib/gifts/server/store";
import { body, editKey, fail, handle, json, validSlug, type ItemContext } from "@/lib/gifts/server/http";

export async function PATCH(req: Request, { params }: ItemContext) {
  const { slug, id } = await params;
  if (!validSlug(slug) || !isUuid(id)) return fail("not_found", 404);
  return handle(async () => {
    const list = await ownedList(slug, editKey(req));
    const parsed = readItem(await body(req));
    if (!parsed.ok) return fail(parsed.error);
    await updateItem(list.id, id, parsed.value);
    return json({ ok: true });
  });
}

export async function DELETE(req: Request, { params }: ItemContext) {
  const { slug, id } = await params;
  if (!validSlug(slug) || !isUuid(id)) return fail("not_found", 404);
  return handle(async () => {
    const list = await ownedList(slug, editKey(req));
    await deleteItem(list.id, id);
    return json({ ok: true });
  });
}
