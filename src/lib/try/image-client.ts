// Browser-only. Re-encodes every picked image through a canvas: that drops EXIF (location, device,
// timestamps), fixes rotation and caps the longest edge. The original file is never uploaded.

import { MAX_IMAGE_BYTES, MAX_IMAGE_EDGE } from "./shared";

export type ProcessedImage = { file: File; previewUrl: string };

export class ImageError extends Error {}

const HEIC = /\.(heic|heif)$/i;

async function decode(file: File): Promise<{ source: CanvasImageSource; width: number; height: number; close: () => void }> {
  if (typeof createImageBitmap === "function") {
    try {
      const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
      return { source: bitmap, width: bitmap.width, height: bitmap.height, close: () => bitmap.close() };
    } catch {
      // Fall through to <img>, which handles formats createImageBitmap rejects on some browsers.
    }
  }
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.decoding = "async";
    img.src = url;
    await img.decode();
    return { source: img, width: img.naturalWidth, height: img.naturalHeight, close: () => undefined };
  } finally {
    URL.revokeObjectURL(url);
  }
}

export async function processImage(file: File): Promise<ProcessedImage> {
  if (!file.type.startsWith("image/") && !HEIC.test(file.name)) throw new ImageError("That file isn't an image.");
  let decoded;
  try {
    decoded = await decode(file);
  } catch {
    throw new ImageError("We couldn't open that image. Try a screenshot or a JPEG or PNG.");
  }
  try {
    const scale = Math.min(1, MAX_IMAGE_EDGE / Math.max(decoded.width, decoded.height));
    const width = Math.max(1, Math.round(decoded.width * scale));
    const height = Math.max(1, Math.round(decoded.height * scale));
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");
    if (!context) throw new ImageError("Your browser can't prepare images. Try another browser.");
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, width, height);
    context.drawImage(decoded.source, 0, 0, width, height);
    let blob = await toBlob(canvas, 0.86);
    if (blob.size > MAX_IMAGE_BYTES) blob = await toBlob(canvas, 0.6);
    if (blob.size > MAX_IMAGE_BYTES) throw new ImageError("That image is too large. Try a smaller one.");
    const name = (file.name.replace(/\.[^.]+$/, "") || "image").replace(/[^\w-]+/g, "_").slice(0, 40);
    const processed = new File([blob], `${name}.jpg`, { type: "image/jpeg" });
    return { file: processed, previewUrl: URL.createObjectURL(processed) };
  } finally {
    decoded.close();
  }
}

function toBlob(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new ImageError("We couldn't prepare that image."))), "image/jpeg", quality);
  });
}

const SESSION_KEY = "ns_try_sid";

/** Persistent per-browser id used only for the daily free-run limit. */
export function getTrySessionId(): string {
  try {
    const existing = window.localStorage.getItem(SESSION_KEY);
    if (existing) return existing;
    const created = crypto.randomUUID();
    window.localStorage.setItem(SESSION_KEY, created);
    return created;
  } catch {
    return crypto.randomUUID();
  }
}
