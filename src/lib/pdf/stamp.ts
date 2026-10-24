/**
 * Write the placed marks into the PDF and return the new file's bytes.
 *
 * Every mark arrives as a PNG, text included: it keeps the saved copy looking
 * exactly like the screen, in the reader's chosen font, without embedding a
 * font file into someone else's document. pdf-lib only appends to the file, so
 * the original pages, form fields and metadata come through untouched.
 */
import { PDFDocument, degrees } from "pdf-lib";
import { placement, type Box } from "./geometry";

export type StampedMark = Box & { page: number; png: Uint8Array };

export async function stampPdf(original: Uint8Array, marks: StampedMark[]): Promise<Uint8Array> {
  const pdf = await PDFDocument.load(original, { ignoreEncryption: true });
  const pages = pdf.getPages();

  for (const mark of marks) {
    const page = pages[mark.page];
    if (!page) continue;
    const image = await pdf.embedPng(mark.png);
    const at = placement(mark, page.getCropBox(), page.getRotation().angle);
    page.drawImage(image, { ...at, rotate: degrees(at.rotate) });
  }

  return pdf.save();
}
