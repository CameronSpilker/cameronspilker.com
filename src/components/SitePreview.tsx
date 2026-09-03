import type { Preview } from "@/content/projects";

const BARS = [34, 58, 41, 72, 49, 66, 38, 61];

/**
 * The panel's ambient ground: the product's colors flooding the whole viewport.
 *
 * A capture goes in blurred and dimmed. It is atmosphere, not content, and a
 * real homepage is full of its own text that would otherwise fight the copy on
 * top of it. The crisp version lives in SiteFrame.
 */
export function SiteBackdrop({ preview, image }: { preview: Preview; image?: string }) {
  const [from, to] = preview.tint;

  return (
    <div
      className="absolute inset-0 overflow-hidden"
      style={{ backgroundImage: `linear-gradient(150deg, ${from} 0%, ${to} 60%, ${from} 100%)` }}
    >
      {image && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={image}
          alt=""
          aria-hidden="true"
          className="h-full w-full scale-110 object-cover object-top opacity-50 blur-3xl"
        />
      )}
      <div aria-hidden="true" className="absolute inset-0 bg-ink/30" />
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-gradient-to-r from-ink via-ink/70 to-ink/20"
      />
      <div
        aria-hidden="true"
        className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-ink to-transparent"
      />
    </div>
  );
}

/**
 * The site itself, crisp, in a browser frame. This is the part that has to be
 * legible, so nothing is layered over it.
 */
export function SiteFrame({
  preview,
  image,
  alt,
  href,
}: {
  preview: Preview;
  image?: string;
  alt: string;
  href?: string;
}) {
  const host = href ? href.replace(/^https?:\/\//, "").replace(/\/$/, "") : preview.brand;

  return (
    <figure
      className="m-0 overflow-hidden rounded-xl border border-white/15 bg-ink shadow-2xl"
      style={{ borderColor: `${preview.accent}33`, boxShadow: `0 25px 50px -12px var(--frame-shadow)` }}
    >
      <div className="flex items-center gap-2 border-b border-white/10 bg-white/5 px-3 py-2">
        <span aria-hidden="true" className="flex gap-1.5">
          {["#ff5f57", "#febc2e", "#28c840"].map((c) => (
            <span key={c} className="block h-2.5 w-2.5 rounded-full" style={{ backgroundColor: c }} />
          ))}
        </span>
        <span className="truncate pl-2 font-mono text-[11px] text-body/70">{host}</span>
      </div>

      <div className="relative aspect-[16/10] w-full overflow-hidden bg-ink">
        {image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={image} alt={alt} className="h-full w-full object-cover object-top" />
        ) : (
          <Wireframe preview={preview} />
        )}
      </div>
    </figure>
  );
}

/** Stand-in until a capture exists: the product's colors, no invented copy. */
function Wireframe({ preview }: { preview: Preview }) {
  const [from, to] = preview.tint;

  return (
    <div
      aria-hidden="true"
      className="absolute inset-0 text-white"
      style={{ backgroundImage: `linear-gradient(150deg, ${from} 0%, ${to} 70%)` }}
    >
      <div className="flex items-center justify-between px-5 py-4">
        <span className="text-xs font-semibold tracking-tight">{preview.brand}</span>
        <span className="flex gap-3 text-[10px] opacity-70">
          {preview.nav.map((item) => (
            <span key={item}>{item}</span>
          ))}
        </span>
      </div>

      <div className="mt-6 space-y-2.5 px-5">
        <div className="h-2.5 w-3/5 rounded-full bg-white/25" />
        <div className="h-2.5 w-2/5 rounded-full bg-white/14" />
      </div>

      <div className="absolute right-5 bottom-5">
        {preview.shape === "chart" && (
          <div className="flex h-20 items-end gap-1.5">
            {BARS.map((h, i) => (
              <span key={i} className="block w-3 rounded-t bg-white/35" style={{ height: `${h}%` }} />
            ))}
          </div>
        )}
        {preview.shape === "grid" && (
          <div className="grid grid-cols-3 gap-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <span key={i} className="block h-10 w-12 rounded border border-white/20 bg-white/10" />
            ))}
          </div>
        )}
        {preview.shape === "feed" && (
          <div className="space-y-2">
            {[120, 150, 96, 132].map((w, i) => (
              <span
                key={i}
                className="block h-6 rounded border border-white/16 bg-white/8"
                style={{ width: `${w}px` }}
              />
            ))}
          </div>
        )}
      </div>

      <span className="absolute bottom-4 left-5 font-mono text-[9px] tracking-[0.16em] text-white/40 uppercase">
        screenshot pending
      </span>
    </div>
  );
}
