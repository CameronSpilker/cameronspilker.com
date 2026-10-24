/**
 * The practice document the signer opens on arrival.
 *
 * Built in the page with pdf-lib rather than shipped as a file, so there is no
 * binary in the repo to drift from the code that describes it. Every name and
 * figure in it is invented, and the page says so over the top of it.
 */
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

const BODY = [
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

export async function makeSamplePdf(): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const page = doc.addPage([612, 792]);
  const regular = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const ink = rgb(0.1, 0.1, 0.12);
  const muted = rgb(0.4, 0.42, 0.46);

  page.drawText("SAMPLE", { x: 470, y: 740, size: 11, font: bold, color: rgb(0.75, 0.2, 0.17) });
  page.drawText("MAPLE RIDGE HOMEOWNERS ASSOCIATION", { x: 72, y: 712, size: 10, font: bold, color: muted });
  page.drawText("Resolution of the Board of Directors", { x: 72, y: 686, size: 20, font: bold, color: ink });
  page.drawText("Resolution No. 2026-07  ·  Adopted at the regular board meeting", {
    x: 72,
    y: 664,
    size: 10,
    font: regular,
    color: muted,
  });

  let y = 620;
  for (const line of BODY) {
    page.drawText(line, { x: 72, y, size: 11.5, font: regular, color: ink });
    y -= 19;
  }

  const line = (x1: number, x2: number, at: number) =>
    page.drawLine({ start: { x: x1, y: at }, end: { x: x2, y: at }, thickness: 0.8, color: ink });
  const label = (text: string, x: number, at: number) =>
    page.drawText(text, { x, y: at - 14, size: 9.5, font: regular, color: muted });

  const signatureRow = (at: number, text: string) => {
    line(72, 330, at);
    line(380, 540, at);
    label(text, 72, at);
    label("Date", 380, at);
  };

  signatureRow(330, "Board Member Signature");
  line(72, 330, 270);
  label("Printed Name", 72, 270);
  signatureRow(190, "Secretary Signature");

  return doc.save();
}
