/**
 * Fitting an option's text inside its slice.
 *
 * A label runs along the slice's centre line, from just inside the rim towards
 * the hub. The slice narrows towards the hub, so a label has two limits: its
 * longest line must stop short of the hub, and its stack of lines must fit
 * the slice's width where the text ends nearest the centre.
 *
 * The wheel draws labels in Geist Mono, where every character advances 0.6em,
 * so widths can be worked out here without a DOM.
 */

/** Width of one character, as a share of the font size. */
export const CHAR_WIDTH = 0.6;

/** Distance between lines, as a share of the font size. */
export const LINE_HEIGHT = 1.1;

/** Smallest font size the wheel will draw. Past this, labels are cut. */
export const MIN_FONT = 6;

/** Most lines a label may wrap onto. */
export const MAX_LINES = 3;

export type Geometry = {
  /** Number of slices. */
  n: number;
  /** Radius where each label's outer end sits. */
  outer: number;
  /** Radius the labels must stay outside of (the hub, plus a margin). */
  inner: number;
  /** Largest font size to try, for this many slices. */
  maxFont: number;
};

export type LabelLayout = {
  lines: string[];
  fontSize: number;
  lineHeight: number;
};

/** Break text into lines of at most `width` characters, at spaces when it can. */
export function wrap(text: string, width: number): string[] {
  const lines: string[] = [];
  let line = "";
  for (const word of text.split(/\s+/).filter(Boolean)) {
    let rest = word;
    // A word too long for any line is split across lines.
    while (rest.length > width) {
      if (line) {
        lines.push(line);
        line = "";
      }
      lines.push(rest.slice(0, width));
      rest = rest.slice(width);
    }
    if (!rest) continue;
    if (!line) line = rest;
    else if (line.length + 1 + rest.length <= width) line += ` ${rest}`;
    else {
      lines.push(line);
      line = rest;
    }
  }
  if (line) lines.push(line);
  return lines;
}

/** How tall a stack of lines may be, if its inner end sits at radius `r`. */
function room(r: number, n: number) {
  if (n <= 2) return Infinity;
  const half = Math.PI / n;
  // Leave a little clear of each seam.
  return 2 * r * Math.tan(half) * 0.82;
}

function fits(lines: string[], fontSize: number, g: Geometry) {
  const longest = Math.max(...lines.map((l) => l.length));
  const innerEnd = g.outer - longest * CHAR_WIDTH * fontSize;
  if (innerEnd < g.inner - 0.01) return false;
  const height = (lines.length - 1) * LINE_HEIGHT * fontSize + fontSize;
  return height <= room(innerEnd, g.n);
}

/**
 * The largest font size, from `maxFont` down to `MIN_FONT`, at which the label
 * fits whole on up to `MAX_LINES` lines. A single line is preferred down to
 * 80% of `maxFont`, and fewer lines win at the same size. If
 * nothing fits, the label is drawn at the smallest size and cut with an
 * ellipsis, so it never spills out of its slice.
 */
export function layoutLabel(label: string, g: Geometry): LabelLayout {
  const text = label.trim().replace(/\s+/g, " ");
  const span = g.outer - g.inner;
  // A single line a little smaller reads better than two at full size.
  for (let fontSize = g.maxFont; fontSize >= Math.max(MIN_FONT, g.maxFont * 0.8); fontSize -= 0.5) {
    if (fits([text], fontSize, g)) return { lines: [text], fontSize, lineHeight: LINE_HEIGHT * fontSize };
  }
  for (let fontSize = g.maxFont; fontSize >= MIN_FONT; fontSize -= 0.5) {
    const width = Math.floor(span / (CHAR_WIDTH * fontSize));
    if (width < 1) continue;
    // One line first; wrap only when the label is longer than a line.
    const candidates = text.length <= width ? [[text]] : [];
    const wrapped = wrap(text, width);
    if (wrapped.length <= MAX_LINES) candidates.push(wrapped);
    for (const lines of candidates) {
      if (fits(lines, fontSize, g)) return { lines, fontSize, lineHeight: LINE_HEIGHT * fontSize };
    }
  }
  return { lines: cut(text, g), fontSize: MIN_FONT, lineHeight: LINE_HEIGHT * MIN_FONT };
}

/**
 * Last resort, at the smallest size: whichever number of lines shows the most
 * of the label, with the last line cut. Taller stacks have to stop further
 * from the hub, where the slice is wide enough for them, so more lines does
 * not always mean more text.
 */
function cut(text: string, g: Geometry): string[] {
  let best: string[] = [`${text.slice(0, 1)}…`];
  let shown = 0;
  for (let count = 1; count <= MAX_LINES; count++) {
    const height = (count - 1) * LINE_HEIGHT * MIN_FONT + MIN_FONT;
    const start = Math.max(g.inner, needed(height, g.n));
    const width = Math.floor((g.outer - start) / (CHAR_WIDTH * MIN_FONT));
    if (width < 2) break;
    const all = wrap(text, width);
    const lines = all.slice(0, count);
    if (all.length > count) {
      const last = lines[count - 1];
      lines[count - 1] = last.length >= width ? `${last.slice(0, width - 1)}…` : `${last}…`;
    }
    const chars = lines.join("").replace("…", "").length;
    if (chars > shown) {
      best = lines;
      shown = chars;
    }
  }
  return best;
}

/** The radius at which a slice is wide enough for a stack this tall. */
function needed(height: number, n: number) {
  if (n <= 2) return 0;
  return height / (2 * Math.tan(Math.PI / n) * 0.82);
}
