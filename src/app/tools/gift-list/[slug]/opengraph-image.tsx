import { ImageResponse } from "next/og";
import { giftListTool as copy } from "@/content/tools";
import { SLUG_PATTERN } from "@/lib/gifts/ids";
import { imageDataUri } from "@/lib/gifts/server/fetch";
import { isConfigured, loadList } from "@/lib/gifts/server/store";

/**
 * The card a messaging app shows for a shared list: the list's name, the note,
 * and the first few things on it. Drawn per list, on request.
 *
 * Product pictures are fetched through the same guarded client as the link
 * preview (the owner chose those URLs, not the site), turned into data URIs,
 * and dropped if they are slow, large, or a format the renderer cannot draw.
 */
export const alt = "A gift list";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

type Font = { name: string; data: ArrayBuffer; weight: 500 | 800; style: "normal" };
let fontCache: Promise<Font[]> | null = null;

/**
 * Plus Jakarta Sans, the site's face, as TTF in the two weights the card uses.
 * Any failure falls back to the renderer's default font rather than no card.
 */
function jakarta(): Promise<Font[]> {
  fontCache ??= Promise.all(
    ([500, 800] as const).map(async (weight): Promise<Font | null> => {
      try {
        const css = await fetch(`https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@${weight}`).then((r) => r.text());
        const src = css.match(/src:\s*url\(([^)]+)\)\s*format\('(?:truetype|opentype)'\)/)?.[1];
        if (!src) return null;
        return { name: "Jakarta", data: await fetch(src).then((r) => r.arrayBuffer()), weight, style: "normal" };
      } catch {
        return null;
      }
    }),
  ).then((fonts) => fonts.filter((f): f is Font => f !== null));
  return fontCache;
}

const INK = "#eef6f9";
const BRIGHT = "#0b2233";
const BODY = "#46606f";
const ACCENT = "#0969c0";

function clip(text: string, max: number) {
  return text.length > max ? `${text.slice(0, max - 1).trimEnd()}…` : text;
}

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const list = SLUG_PATTERN.test(slug) && isConfigured() ? await loadList(slug, false).catch(() => null) : null;

  const title = list?.title ?? copy.name;
  const note = list?.note ?? "";
  const count = list?.items.length ?? 0;
  const pictures = list
    ? (
        await Promise.all(
          list.items
            .filter((i) => i.imageUrl)
            .slice(0, 6)
            .map((i) => imageDataUri(i.imageUrl as string)),
        )
      )
        .filter((src): src is string => Boolean(src))
        .slice(0, 4)
    : [];
  const fonts = await jakarta();

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          backgroundColor: INK,
          backgroundImage:
            "radial-gradient(circle at 0% 0%, rgba(143,211,244,0.85), rgba(143,211,244,0) 55%), radial-gradient(circle at 100% 30%, rgba(132,240,213,0.6), rgba(132,240,213,0) 50%), radial-gradient(circle at 45% 100%, rgba(165,184,255,0.6), rgba(165,184,255,0) 55%)",
          padding: 64,
          fontFamily: fonts.length ? "Jakarta" : undefined,
          fontWeight: 500,
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", flex: 1, paddingRight: pictures.length ? 48 : 0 }}>
          <div style={{ display: "flex", fontSize: 22, fontWeight: 800, letterSpacing: 6, color: ACCENT, textTransform: "uppercase" }}>
            {copy.share.label}
          </div>
          <div
            style={{
              display: "flex",
              marginTop: 18,
              fontSize: title.length > 28 ? 60 : 76,
              lineHeight: 1.05,
              fontWeight: 800,
              color: BRIGHT,
              letterSpacing: -2,
            }}
          >
            {clip(title, 60)}
          </div>
          {note && (
            <div style={{ display: "flex", marginTop: 26, fontSize: 30, lineHeight: 1.35, color: BODY }}>
              {clip(note, 130)}
            </div>
          )}
          <div style={{ display: "flex", marginTop: "auto", fontSize: 24, color: BODY }}>
            {count > 0 ? `${copy.share.ideas(count)} · cameronspilker.com` : "cameronspilker.com"}
          </div>
        </div>

        {pictures.length > 0 && (
          <div style={{ display: "flex", flexWrap: "wrap", width: 440, gap: 20, alignContent: "center" }}>
            {pictures.map((src, i) => (
              <div
                key={i}
                style={{
                  display: "flex",
                  width: pictures.length === 1 ? 440 : 210,
                  height: pictures.length === 1 ? 440 : 210,
                  backgroundColor: "#ffffff",
                  borderRadius: 32,
                  border: "2px solid rgba(255,255,255,0.9)",
                  boxShadow: "0 20px 50px rgba(10,105,192,0.18)",
                  alignItems: "center",
                  justifyContent: "center",
                  padding: 18,
                }}
              >
                <img src={src} alt="" style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain" }} />
              </div>
            ))}
          </div>
        )}
      </div>
    ),
    {
      ...size,
      fonts: fonts.length ? fonts : undefined,
    },
  );
}
