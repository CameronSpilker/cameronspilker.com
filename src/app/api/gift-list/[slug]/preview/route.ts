import { webUrl } from "@/lib/gifts/input";
import { previewLink } from "@/lib/gifts/server/preview";
import { ownedList } from "@/lib/gifts/server/store";
import { body, editKey, fail, handle, json, validSlug, type SlugContext } from "@/lib/gifts/server/http";

/**
 * Reads a pasted product link for its title, picture and price. Owner only, so
 * the site's server is not an open proxy for anyone who finds the endpoint.
 */
export async function POST(req: Request, { params }: SlugContext) {
  const { slug } = await params;
  if (!validSlug(slug)) return fail("not_found", 404);
  return handle(async () => {
    await ownedList(slug, editKey(req));
    const input = (await body(req)) as { url?: unknown } | null;
    const url = webUrl(input?.url ?? null);
    if (!url) return fail("bad_url");
    const preview = await previewLink(url);
    return preview ? json(preview) : fail("bad_url");
  });
}
