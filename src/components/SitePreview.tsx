import type { Preview } from "@/content/projects";

const BARS = [34, 58, 41, 72, 49, 66, 38, 61];

/**
 * The full-bleed backdrop for one project panel.
 *
 * With a capture in `public/shots/`, this is the site's own homepage. Without
 * one it is a wireframe in the product's colors — deliberately abstract, so the
 * page never puts words in a real product's mouth.
 */
export function SitePreview({
  preview,
  image,
  alt,
}: {
  preview: Preview;
  image?: string;
  alt: string;
}) {
  const [from, to] = preview.tint;

  return (
    <div
      className="absolute inset-0 overflow-hidden"
      style={{ backgroundImage: `linear-gradient(150deg, ${from} 0%, ${to} 60%, ${from} 100%)` }}
    >
      {image ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={image}
          alt={alt}
          className="h-full w-full object-cover object-top opacity-90"
        />
      ) : (
        <Wireframe preview={preview} />
      )}

      {/* Scrim: enough to keep the copy legible over any capture, light or
          dark, without draining the colour that makes the panel read as the
          product's own page. */}
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-gradient-to-r from-ink via-ink/60 to-transparent"
      />
      <div
        aria-hidden="true"
        className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-ink to-transparent"
      />
    </div>
  );
}

function Wireframe({ preview }: { preview: Preview }) {
  return (
    <div aria-hidden="true" className="absolute inset-0 text-white">
      <div className="flex items-center justify-between px-8 py-6 sm:px-14">
        <span className="text-sm font-semibold tracking-tight sm:text-base">
          {preview.brand}
        </span>
        <span className="flex gap-5 text-[11px] opacity-70 sm:text-xs">
          {preview.nav.map((item) => (
            <span key={item}>{item}</span>
          ))}
        </span>
      </div>

      {/* Kept to the right half, clear of the copy column. */}
      <div className="absolute top-1/3 right-8 flex w-1/3 flex-col items-end gap-3 sm:right-14">
        <div className="h-3 w-full rounded-full bg-white/20" />
        <div className="h-3 w-2/3 rounded-full bg-white/12" />
      </div>

      <div className="absolute right-8 bottom-14 sm:right-14">
        {preview.shape === "chart" && (
          <div className="flex h-32 items-end gap-2 sm:h-44">
            {BARS.map((h, i) => (
              <span
                key={i}
                className="block w-4 rounded-t bg-white/35 sm:w-6"
                style={{ height: `${h}%` }}
              />
            ))}
          </div>
        )}
        {preview.shape === "grid" && (
          <div className="grid grid-cols-3 gap-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <span
                key={i}
                className="block h-16 w-14 rounded border border-white/22 bg-white/10 sm:h-24 sm:w-20"
              />
            ))}
          </div>
        )}
        {preview.shape === "feed" && (
          <div className="space-y-3">
            {[68, 84, 56, 76].map((w, i) => (
              <span
                key={i}
                className="flex h-9 items-center rounded border border-white/18 bg-white/8 sm:h-11"
                style={{ width: `${w * 2.6}px` }}
              />
            ))}
          </div>
        )}
      </div>

      <span className="absolute right-8 bottom-6 font-mono text-[10px] tracking-[0.18em] text-white/40 uppercase sm:right-14">
        screenshot pending
      </span>
    </div>
  );
}
