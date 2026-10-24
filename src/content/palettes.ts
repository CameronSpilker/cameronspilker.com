import type { Palette } from "@/lib/palette";

/** Labels for the temporary palette picker. Goes when a palette is chosen. */
export const paletteLabels: Record<Palette, string> = {
  current: "Current",
  indigo: "Indigo Night",
  paper: "Warm Paper",
  graphite: "Graphite",
};

export const palettePicker = {
  title: "Preview a theme",
  hint: "Light or dark is the toggle in the header.",
} as const;
