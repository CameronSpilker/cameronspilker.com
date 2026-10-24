import { Caveat, Homemade_Apple, Mrs_Saint_Delafield } from "next/font/google";

/**
 * The typed signature styles.
 *
 * Loaded through next/font so the files are served from this site rather than
 * from Google at runtime: the page that promises nothing leaves the browser
 * should not be making third party requests to draw a name.
 */
const homemadeApple = Homemade_Apple({ weight: "400", subsets: ["latin"], display: "swap" });
const mrsSaintDelafield = Mrs_Saint_Delafield({ weight: "400", subsets: ["latin"], display: "swap" });
const caveat = Caveat({ weight: "500", subsets: ["latin"], display: "swap" });

export const SIGNATURE_FONTS = [
  { name: "Homemade Apple", family: homemadeApple.style.fontFamily },
  { name: "Mrs Saint Delafield", family: mrsSaintDelafield.style.fontFamily },
  { name: "Caveat", family: caveat.style.fontFamily },
];
