import { readItem } from "@/lib/gifts/input";
import { addItem, ownedList } from "@/lib/gifts/server/store";
import { body, editKey, fail, handle, json, validSlug, type SlugContext } from "@/lib/gifts/server/http";

export async function POST(req: Request, { params }: SlugContext) {
  const { slug } = await params;
  if (!validSlug(slug)) return fail("not_found", 404);
  return handle(async () => {
    const list = await ownedList(slug, editKey(req));
    const parsed = readItem(await body(req));
    if (!parsed.ok) return fail(parsed.error);
    const id = await addItem(list.id, parsed.value);
    return json({ id }, 201);
  });
}
