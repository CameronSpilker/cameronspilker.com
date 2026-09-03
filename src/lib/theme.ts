/**
 * Appearance, shared by the toggle in the chrome and by the script that runs
 * before the first paint.
 *
 * Three settings rather than two. "System" is the default and is what most
 * people want; the other two exist for the visitor whose machine is set one
 * way and who wants this site the other. The Full Data Stack Lab dashboard
 * offers the same three, under the same default, so the two sites behave
 * alike.
 */
export const APPEARANCES = ["system", "light", "dark"] as const;

export type Appearance = (typeof APPEARANCES)[number];

export const THEME_STORAGE_KEY = "theme";

export function isAppearance(value: unknown): value is Appearance {
  return typeof value === "string" && (APPEARANCES as readonly string[]).includes(value);
}

/**
 * The snippet that runs in `<head>`, before anything paints.
 *
 * It resolves the stored setting to a concrete appearance and stamps it on
 * `<html>`, so a visitor who chose light never sees a frame of dark first. It
 * is deliberately tiny and deliberately wrapped in a try: private-mode storage
 * throws on read, and the page has to render anyway.
 */
export const THEME_SCRIPT = `try{var s=localStorage.getItem(${JSON.stringify(
  THEME_STORAGE_KEY,
)});var d=window.matchMedia("(prefers-color-scheme: dark)").matches;var t=s==="light"||s==="dark"?s:(d?"dark":"light");document.documentElement.setAttribute("data-theme",t);document.documentElement.style.colorScheme=t;}catch(e){}`;
