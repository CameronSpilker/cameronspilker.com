/**
 * The practice documents the signer can open.
 *
 * Built in the page with pdf-lib rather than shipped as files, so there is no
 * binary in the repo to drift from the code that describes it. Every name and
 * figure in them is invented, and the page says so over the top of them.
 */
import { PDFDocument, PDFFont, PDFPage, StandardFonts, rgb } from "pdf-lib";

export type SampleId = "resolution" | "form";

const INK = rgb(0.1, 0.1, 0.12);
const MUTED = rgb(0.4, 0.42, 0.46);
const FLAG = rgb(0.75, 0.2, 0.17);

type Fonts = { regular: PDFFont; bold: PDFFont };

/** A rule to write on, with its label underneath, the way paper forms do it. */
function field(page: PDFPage, fonts: Fonts, label: string, x1: number, x2: number, y: number) {
  page.drawLine({ start: { x: x1, y }, end: { x: x2, y }, thickness: 0.8, color: INK });
  page.drawText(label, { x: x1, y: y - 14, size: 9.5, font: fonts.regular, color: MUTED });
}

function heading(page: PDFPage, fonts: Fonts, text: string, y: number) {
  page.drawText(text.toUpperCase(), { x: 72, y, size: 10, font: fonts.bold, color: MUTED });
  page.drawLine({ start: { x: 72, y: y - 8 }, end: { x: 540, y: y - 8 }, thickness: 0.5, color: MUTED });
}

function resolution(page: PDFPage, fonts: Fonts) {
  const { regular, bold } = fonts;
  page.drawText("MAPLE RIDGE HOMEOWNERS ASSOCIATION", { x: 72, y: 712, size: 10, font: bold, color: MUTED });
  page.drawText("Resolution of the Board of Directors", { x: 72, y: 686, size: 20, font: bold, color: INK });
  page.drawText("Resolution No. 2026-07  ·  Adopted at the regular board meeting", {
    x: 72,
    y: 664,
    size: 10,
    font: regular,
    color: MUTED,
  });

  const body = [
    "WHEREAS, the Association's reserve study recommends replacing the clubhouse roof",
    "within the current fiscal year; and",
    "",
    "WHEREAS, the Board received three bids and reviewed them at the October meeting;",
    "",
    "NOW, THEREFORE, BE IT RESOLVED that the Board approves the bid from Summit Roofing",
    "in the amount of $48,250.00, to be paid from the reserve fund, and authorizes the",
    "President to execute the contract on behalf of the Association.",
    "",
    "This resolution was adopted by a majority vote of the directors present.",
  ];
  let y = 620;
  for (const line of body) {
    page.drawText(line, { x: 72, y, size: 11.5, font: regular, color: INK });
    y -= 19;
  }

  field(page, fonts, "Board Member Signature", 72, 330, 330);
  field(page, fonts, "Date", 380, 540, 330);
  field(page, fonts, "Printed Name", 72, 330, 270);
  field(page, fonts, "Secretary Signature", 72, 330, 190);
  field(page, fonts, "Date", 380, 540, 190);
}

/**
 * A general purpose intake form: the kind with blanks to fill, boxes to tick
 * and a signature block, so every kind of mark has somewhere to go.
 */
function form(page: PDFPage, fonts: Fonts) {
  const { regular, bold } = fonts;
  page.drawText("General Information Form", { x: 72, y: 700, size: 20, font: bold, color: INK });
  page.drawText("Please complete every section, sign at the bottom, and return a copy.", {
    x: 72,
    y: 680,
    size: 10.5,
    font: regular,
    color: MUTED,
  });

  heading(page, fonts, "1. Your details", 640);
  field(page, fonts, "Full name", 72, 540, 600);
  field(page, fonts, "Date of birth", 72, 290, 556);
  field(page, fonts, "Phone", 322, 540, 556);
  field(page, fonts, "Email", 72, 540, 512);
  field(page, fonts, "Street address", 72, 540, 468);
  field(page, fonts, "City", 72, 300, 424);
  field(page, fonts, "State", 322, 410, 424);
  field(page, fonts, "ZIP code", 432, 540, 424);

  heading(page, fonts, "2. Preferred contact", 376);
  ["Email", "Phone", "Mail"].forEach((label, i) => {
    const x = 72 + i * 120;
    page.drawRectangle({ x, y: 340, width: 12, height: 12, borderColor: INK, borderWidth: 0.8 });
    page.drawText(label, { x: x + 20, y: 342, size: 11, font: regular, color: INK });
  });

  heading(page, fonts, "3. Acknowledgement", 300);
  const statement = [
    "I confirm that the information on this form is accurate and complete to the best",
    "of my knowledge, and I agree to let the recipient know if any of it changes.",
  ];
  statement.forEach((line, i) =>
    page.drawText(line, { x: 72, y: 270 - i * 16, size: 11, font: regular, color: INK }),
  );
  field(page, fonts, "Signature", 72, 330, 190);
  field(page, fonts, "Date", 380, 540, 190);
  field(page, fonts, "Printed name", 72, 330, 136);
}

export async function makeSamplePdf(id: SampleId): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const page = doc.addPage([612, 792]);
  const fonts = {
    regular: await doc.embedFont(StandardFonts.Helvetica),
    bold: await doc.embedFont(StandardFonts.HelveticaBold),
  };
  page.drawText("SAMPLE", { x: 490, y: 740, size: 11, font: fonts.bold, color: FLAG });
  if (id === "form") form(page, fonts);
  else resolution(page, fonts);
  return doc.save();
}
