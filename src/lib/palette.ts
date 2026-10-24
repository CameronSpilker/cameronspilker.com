/**
 * Candidate colour palettes, previewed side by side before one replaces the
 * current set in `globals.css`. Temporary: once a palette is chosen it becomes
 * the default and this file, the picker and the `[data-palette]` blocks go.
 *
 * A palette is picked with `?palette=<id>` on any URL, or with the picker in
 * the corner. The choice lasts for the tab (session storage), so it survives
 * moving between pages but never outlives the preview.
 */
export const PALETTES = ["current", "indigo", "paper", "graphite"] as const;

export type Palette = (typeof PALETTES)[number];

export const PALETTE_STORAGE_KEY = "palette-preview";

export function isPalette(value: unknown): value is Palette {
  return typeof value === "string" && (PALETTES as readonly string[]).includes(value);
}

/** Runs in `<head>` beside the theme script, so the first paint is already in the chosen palette. */
export const PALETTE_SCRIPT = `try{var p=new URLSearchParams(location.search).get("palette");var k=${JSON.stringify(
  PALETTE_STORAGE_KEY,
)};var ok=${JSON.stringify(PALETTES)};if(ok.indexOf(p)>-1){sessionStorage.setItem(k,p)}else{p=sessionStorage.getItem(k)}if(ok.indexOf(p)>-1&&p!=="current"){document.documentElement.setAttribute("data-palette",p)}}catch(e){}`;
