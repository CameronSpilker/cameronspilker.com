/**
 * Where a mark lands, in two coordinate systems.
 *
 * On screen a mark is a box in page fractions: `x` and `y` from the top left
 * of the page as the reader sees it, `w` and `h` as shares of its width and
 * height. A PDF page measures in points from the bottom left of its crop box,
 * and may also carry a `/Rotate` that turns what the reader sees relative to
 * that box. Everything here is the arithmetic between the two, kept apart from
 * the DOM so it can be tested.
 */

/** A mark's box, in fractions of the page as displayed. */
export type Box = { x: number; y: number; w: number; h: number };

/** A PDF rectangle in points, as pdf-lib's `getCropBox` returns it. */
export type PdfRect = { x: number; y: number; width: number; height: number };

/** Keep a box inside the page: no larger than it, and no edge past it. */
export function clampBox(box: Box): Box {
  const w = Math.min(Math.max(box.w, 0), 1);
  const h = Math.min(Math.max(box.h, 0), 1);
  return {
    w,
    h,
    x: Math.min(Math.max(box.x, 0), 1 - w),
    y: Math.min(Math.max(box.y, 0), 1 - h),
  };
}

/** Page rotation folded into one of the four values a PDF allows. */
export function normalizeRotation(angle: number): 0 | 90 | 180 | 270 {
  const r = (((Math.round(angle / 90) * 90) % 360) + 360) % 360;
  return r as 0 | 90 | 180 | 270;
}

/**
 * The size of the page as the reader sees it, in points. A page rotated a
 * quarter turn shows its crop box on its side.
 */
export function displaySize(rect: PdfRect, rotation: number): { width: number; height: number } {
  const r = normalizeRotation(rotation);
  return r === 90 || r === 270
    ? { width: rect.height, height: rect.width }
    : { width: rect.width, height: rect.height };
}

/**
 * Map a point given in displayed page fractions (`u` across, `v` down) to PDF
 * user space.
 */
export function toPdfPoint(u: number, v: number, rect: PdfRect, rotation: number): [number, number] {
  const { x, y, width, height } = rect;
  switch (normalizeRotation(rotation)) {
    case 90:
      return [x + v * width, y + u * height];
    case 180:
      return [x + (1 - u) * width, y + v * height];
    case 270:
      return [x + (1 - v) * width, y + (1 - u) * height];
    default:
      return [x + u * width, y + (1 - v) * height];
  }
}

/**
 * The arguments pdf-lib's `drawImage` needs to put an image where the reader
 * placed it.
 *
 * pdf-lib anchors an image at its lower left and rotates it about that corner.
 * The lower left as the reader saw it is the box's bottom left in display
 * terms, so that point goes through `toPdfPoint` and the image is turned by
 * the page's own rotation, which makes it read upright once the viewer applies
 * `/Rotate`.
 */
export function placement(box: Box, rect: PdfRect, rotation: number) {
  const r = normalizeRotation(rotation);
  const size = displaySize(rect, r);
  const [x, y] = toPdfPoint(box.x, box.y + box.h, rect, r);
  return { x, y, width: box.w * size.width, height: box.h * size.height, rotate: r };
}

/** "Cameron James Spilker" to "CJS". */
export function initialsOf(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => word[0].toUpperCase())
    .join("");
}

/** "Board minutes.PDF" to "Board minutes-signed.pdf". */
export function signedFileName(name: string): string {
  const base = name.replace(/\.pdf$/i, "") || "document";
  return `${base}-signed.pdf`;
}
