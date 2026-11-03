import { giftListTool as copy } from "@/content/tools";
import { readListDetails } from "@/lib/gifts/input";
import { createList } from "@/lib/gifts/server/store";
import { body, fail, handle, json } from "@/lib/gifts/server/http";

/** Make a list. Answers with the share slug and the edit key, the key exactly once. */
export async function POST(req: Request) {
  return handle(async () => {
    const parsed = readListDetails(await body(req));
    if (!parsed.ok) return fail(parsed.error);
    const ownerName = parsed.value.ownerName;
    if (!ownerName) return fail("name_required");
    const created = await createList({
      ownerName,
      title: parsed.value.title ?? copy.defaults.title(ownerName).slice(0, 80),
      note: parsed.value.note ?? copy.defaults.note,
    });
    return json(created, 201);
  });
}
