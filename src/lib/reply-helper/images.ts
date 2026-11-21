// Screenshot intake. Pure: bytes in, a checked image out. Nothing is stored; the bytes live in this request only.
import type { ModelImage } from "@/lib/starter-pack/generate";
import { MAX_IMAGES } from "./types";

export const MAX_IMAGE_BYTES = 3_500_000;
/** Vercel rejects request bodies over 4.5 MB; the browser resizes screenshots to ~300 KB each first. */
export const MAX_TOTAL_BYTES = 4_200_000;

export function sniffImage(b: Uint8Array): ModelImage["mediaType"] | null {
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "image/jpeg";
  if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return "image/png";
  if (b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 && b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50) return "image/webp";
  return null;
}

export type IntakeResult = { ok: true; images: ModelImage[] } | { ok: false; status: number; error: string };

/** Checks 1-4 uploaded files (already read to bytes). The same file chosen twice is kept once. */
export function intakeImages(files: Uint8Array[]): IntakeResult {
  if (files.length > MAX_IMAGES) return { ok: false, status: 400, error: `Add up to ${MAX_IMAGES} screenshots.` };
  let total = 0;
  const seen = new Set<string>();
  const images: ModelImage[] = [];
  for (const bytes of files) {
    if (bytes.length === 0) continue;
    if (bytes.length > MAX_IMAGE_BYTES) return { ok: false, status: 413, error: "One screenshot is too large. Try a smaller one." };
    total += bytes.length;
    if (total > MAX_TOTAL_BYTES) return { ok: false, status: 413, error: "Those screenshots are too large together. Try fewer or smaller ones." };
    const mediaType = sniffImage(bytes);
    if (!mediaType) return { ok: false, status: 415, error: "Use JPG, PNG or WebP screenshots." };
    const data = Buffer.from(bytes).toString("base64");
    const key = `${bytes.length}:${data.slice(0, 64)}:${data.slice(-64)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    images.push({ mediaType, data });
  }
  return { ok: true, images };
}

/** Pasted text: control characters out, keep the END (the last messages matter most), bounded. */
export function cleanPasted(value: unknown, max: number): string {
  if (typeof value !== "string") return "";
  const text = value.replace(/\r\n?/g, "\n").replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F\u2028\u2029]/g, " ").replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim();
  return text.length > max ? text.slice(text.length - max).trim() : text;
}
