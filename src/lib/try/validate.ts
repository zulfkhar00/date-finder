import { MAX_ABOUT_CHARS, MAX_IMAGES, MAX_IMAGE_BYTES, TRY_APPS, TRY_KINDS, TRY_KIND_LABELS, type TryApp, type TryKind } from "./shared";

// Pure input validation for /api/try. Image type is decided from the file's magic bytes, never from
// the filename or the declared content type.

export type TryMediaType = "image/jpeg" | "image/png" | "image/webp" | "image/gif";

function ascii(bytes: Uint8Array, from: number, to: number): string {
  let out = "";
  for (let i = from; i < to; i += 1) out += String.fromCharCode(bytes[i]);
  return out;
}

export function sniffImageType(bytes: Uint8Array): TryMediaType | null {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
  if (bytes.length >= 8 && bytes[0] === 0x89 && ascii(bytes, 1, 4) === "PNG" && bytes[4] === 0x0d && bytes[5] === 0x0a && bytes[6] === 0x1a && bytes[7] === 0x0a) return "image/png";
  if (bytes.length >= 12 && ascii(bytes, 0, 4) === "RIFF" && ascii(bytes, 8, 12) === "WEBP") return "image/webp";
  if (bytes.length >= 6 && (ascii(bytes, 0, 6) === "GIF87a" || ascii(bytes, 0, 6) === "GIF89a")) return "image/gif";
  return null;
}

export type TryFields = { kind: TryKind; app: TryApp; about: string; sessionId: string; funnelSessionId: string | null };
export type Invalid = { ok: false; message: string };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Text fields from the multipart body. `about` is trimmed and stripped of control characters and quote fences. */
export function validateFields(get: (name: string) => string | null): ({ ok: true } & TryFields) | Invalid {
  const kind = TRY_KINDS.find((value) => value === get("kind"));
  if (!kind) return { ok: false, message: "Pick what you want help with." };
  const app = TRY_APPS.find((value) => value === get("app"));
  if (!app) return { ok: false, message: "Pick Tinder, Hinge or Bumble." };
  const sessionId = get("sessionId") ?? "";
  if (!UUID.test(sessionId)) return { ok: false, message: "Reload the page and try again." };
  const funnel = get("funnelSessionId");
  const about = (get("about") ?? "").replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, "").replace(/"{3,}/g, '"').trim();
  if (about.length > MAX_ABOUT_CHARS) return { ok: false, message: `Keep the note under ${MAX_ABOUT_CHARS} characters.` };
  return { ok: true, kind, app, about, sessionId: sessionId.toLowerCase(), funnelSessionId: funnel && UUID.test(funnel) ? funnel.toLowerCase() : null };
}

export type FileLike = { size: number; arrayBuffer(): Promise<ArrayBuffer> };
export type ValidImage = { mediaType: TryMediaType; base64: string };

/** Checks count, size and real type of each upload. Returns base64 ready for the model. */
export async function validateImages(files: FileLike[], kind: TryKind): Promise<{ ok: true; images: ValidImage[] } | Invalid> {
  if (files.length === 0) return { ok: false, message: kind === "profile" ? "Add at least one photo." : "Add a screenshot." };
  const limit = Math.min(TRY_KIND_LABELS[kind].max, MAX_IMAGES);
  if (files.length > limit) return { ok: false, message: `Add up to ${limit} images.` };
  const images: ValidImage[] = [];
  for (const file of files) {
    if (file.size <= 0) return { ok: false, message: "One of the files is empty." };
    if (file.size > MAX_IMAGE_BYTES) return { ok: false, message: "Each image must be under 5 MB." };
    const bytes = new Uint8Array(await file.arrayBuffer());
    const mediaType = sniffImageType(bytes);
    if (!mediaType) return { ok: false, message: "Only JPEG, PNG, WebP or GIF images work." };
    images.push({ mediaType, base64: Buffer.from(bytes).toString("base64") });
  }
  return { ok: true, images };
}
