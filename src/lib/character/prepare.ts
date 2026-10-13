/**
 * Browser-side image preparation, before anything is uploaded.
 *
 * HEIC (what iPhones save) is converted to JPEG here, because only Safari can
 * decode it natively; the converter is loaded only when a HEIC file is picked.
 * Every image is then redrawn onto a white canvas at no more than 1568 px on
 * the long edge, which is the largest size the model uses at full detail, and
 * sent as JPEG. Redrawing also drops EXIF metadata such as GPS location.
 */

export const MAX_FILE_BYTES = 8 * 1024 * 1024;
export const MAX_EDGE = 1568;

export type Prepared = { dataUrl: string; width: number; height: number };
export type PrepareError = "unsupported" | "too_large" | "unreadable";

const ACCEPTED = /^image\/(jpeg|png|webp|heic|heif)$/i;
const HEIC_NAME = /\.(heic|heif)$/i;

export function isHeic(file: File) {
  return /heic|heif/i.test(file.type) || HEIC_NAME.test(file.name);
}

export function checkFile(file: File): PrepareError | null {
  const typeOk = ACCEPTED.test(file.type) || HEIC_NAME.test(file.name) || /\.(jpe?g|png|webp)$/i.test(file.name);
  if (!typeOk) return "unsupported";
  if (file.size > MAX_FILE_BYTES) return "too_large";
  return null;
}

function loadImage(blob: Blob): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("decode"));
    };
    img.src = url;
  });
}

export async function prepareImage(file: File): Promise<Prepared> {
  let blob: Blob = file;
  let img: HTMLImageElement;
  try {
    img = await loadImage(blob);
  } catch {
    if (!isHeic(file)) throw new Error("unreadable");
    // Not Safari: convert with the bundled decoder.
    const { default: heic2any } = await import("heic2any");
    const out = await heic2any({ blob: file, toType: "image/jpeg", quality: 0.9 });
    blob = Array.isArray(out) ? out[0] : out;
    img = await loadImage(blob);
  }

  const w0 = img.naturalWidth;
  const h0 = img.naturalHeight;
  if (!w0 || !h0) throw new Error("unreadable");
  const scale = Math.min(1, MAX_EDGE / Math.max(w0, h0));
  const width = Math.max(1, Math.round(w0 * scale));
  const height = Math.max(1, Math.round(h0 * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("unreadable");
  // Transparent PNGs would turn black as JPEG; put them on paper instead.
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, width, height);
  ctx.drawImage(img, 0, 0, width, height);
  return { dataUrl: canvas.toDataURL("image/jpeg", 0.88), width, height };
}
