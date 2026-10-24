/**
 * Turning a signature into pixels. Browser only: everything here draws on a
 * canvas.
 *
 * A drawn signature is kept as strokes, each a list of points normalised by the
 * pad's width, so it can be redrawn at any size: small on the pad, large for
 * the PDF. Typed text and drawn strokes both end up as a tightly trimmed
 * transparent PNG, which is what gets placed on the page.
 */

export type Stroke = [number, number][];

/** Ink colours. Fixed, not themed: these go onto white paper either way. */
export const INKS = { blue: "#1d3f9e", black: "#15171b" } as const;
export type Ink = keyof typeof INKS;

/** Plain text marks (dates, names, notes) print in near black. */
export const TEXT_INK = "#111111";

/** Smooth a stroke through the midpoints of its samples. */
export function drawStroke(ctx: CanvasRenderingContext2D, points: Stroke, scale: number, width: number) {
  if (points.length === 0) return;
  ctx.lineWidth = width;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.beginPath();
  ctx.moveTo(points[0][0] * scale, points[0][1] * scale);
  if (points.length === 1) ctx.lineTo(points[0][0] * scale + 0.1, points[0][1] * scale + 0.1);
  for (let i = 1; i < points.length - 1; i++) {
    const mx = (points[i][0] + points[i + 1][0]) / 2;
    const my = (points[i][1] + points[i + 1][1]) / 2;
    ctx.quadraticCurveTo(points[i][0] * scale, points[i][1] * scale, mx * scale, my * scale);
  }
  if (points.length > 1) {
    const last = points[points.length - 1];
    ctx.lineTo(last[0] * scale, last[1] * scale);
  }
  ctx.stroke();
}

/** Crop a canvas to its inked pixels plus a little padding, or null if blank. */
export function trimCanvas(source: HTMLCanvasElement): HTMLCanvasElement | null {
  const ctx = source.getContext("2d");
  if (!ctx) return null;
  const { width: w, height: h } = source;
  const data = ctx.getImageData(0, 0, w, h).data;
  let x0 = w;
  let y0 = h;
  let x1 = -1;
  let y1 = -1;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (data[(y * w + x) * 4 + 3] > 8) {
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
        if (y < y0) y0 = y;
        if (y > y1) y1 = y;
      }
    }
  }
  if (x1 < 0) return null;
  const pad = Math.round(Math.min(w, h) * 0.03);
  x0 = Math.max(0, x0 - pad);
  y0 = Math.max(0, y0 - pad);
  x1 = Math.min(w - 1, x1 + pad);
  y1 = Math.min(h - 1, y1 + pad);
  const out = document.createElement("canvas");
  out.width = x1 - x0 + 1;
  out.height = y1 - y0 + 1;
  out.getContext("2d")?.drawImage(source, x0, y0, out.width, out.height, 0, 0, out.width, out.height);
  return out;
}

/** Redraw the pad's strokes at print resolution. */
export function drawnSignature(strokes: Stroke[], aspect: number, ink: Ink): HTMLCanvasElement | null {
  if (strokes.length === 0) return null;
  const width = 1200;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = Math.round(width * aspect);
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  ctx.strokeStyle = INKS[ink];
  for (const stroke of strokes) drawStroke(ctx, stroke, width, width * 0.0085);
  return trimCanvas(canvas);
}

/** Set a line of text in the given font family and colour. */
export async function typedSignature(
  text: string,
  fontFamily: string,
  color: string,
): Promise<HTMLCanvasElement | null> {
  if (!text.trim()) return null;
  const px = 140;
  const font = `${px}px ${fontFamily}`;
  try {
    await document.fonts.load(font, text);
  } catch {
    // A font that fails to load falls back to the next family in the stack.
  }
  const measure = document.createElement("canvas").getContext("2d");
  if (!measure) return null;
  measure.font = font;
  const canvas = document.createElement("canvas");
  canvas.width = Math.ceil(measure.measureText(text).width) + px;
  canvas.height = Math.round(px * 2.2);
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  ctx.font = font;
  ctx.fillStyle = color;
  ctx.textBaseline = "middle";
  ctx.fillText(text, px * 0.5, canvas.height * 0.55);
  return trimCanvas(canvas);
}

/**
 * A text mark at print resolution: the box's size in points, four pixels to
 * the point, with the text set the way the on-page input shows it.
 */
export async function textImage(
  value: string,
  fontFamily: string,
  widthPt: number,
  heightPt: number,
): Promise<HTMLCanvasElement> {
  const k = 4;
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(2, Math.round(widthPt * k));
  canvas.height = Math.max(2, Math.round(heightPt * k));
  const ctx = canvas.getContext("2d");
  if (ctx) {
    const font = `${canvas.height * TEXT_SIZE}px ${fontFamily}`;
    try {
      await document.fonts.load(font, value);
    } catch {
      // Same fallback as above.
    }
    ctx.font = font;
    ctx.fillStyle = TEXT_INK;
    ctx.textBaseline = "middle";
    ctx.fillText(value, 0, canvas.height / 2);
  }
  return canvas;
}

/** Text fills this share of its box's height, on screen and in the PDF. */
export const TEXT_SIZE = 0.72;

export async function canvasToPng(canvas: HTMLCanvasElement): Promise<Uint8Array> {
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
  if (!blob) throw new Error("The canvas could not be encoded.");
  return new Uint8Array(await blob.arrayBuffer());
}
