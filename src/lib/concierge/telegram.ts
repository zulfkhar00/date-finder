import "server-only";
import { timingSafeEqual } from "node:crypto";

/** Subset of the Telegram Bot API Update we handle. */
export type TelegramPhotoSize = { file_id: string; file_size?: number; width: number; height: number };
export type TelegramMessage = {
  message_id: number;
  chat: { id: number; type: string };
  from?: { id: number; first_name?: string };
  text?: string;
  caption?: string;
  media_group_id?: string;
  photo?: TelegramPhotoSize[];
  document?: { file_id: string; mime_type?: string; file_size?: number };
};
export type TelegramUpdate = { update_id: number; message?: TelegramMessage };

const API = "https://api.telegram.org";
/** Claude accepts images up to 5 MB each. */
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"] as const;
export type ImageType = (typeof IMAGE_TYPES)[number];

export function telegramToken() {
  return process.env.TELEGRAM_BOT_TOKEN || null;
}

export function telegramConfigured() {
  return Boolean(process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_WEBHOOK_SECRET);
}

/** Constant-time check of the X-Telegram-Bot-Api-Secret-Token header. */
export function verifyWebhookSecret(header: string | null) {
  const secret = process.env.TELEGRAM_WEBHOOK_SECRET;
  if (!secret || !header) return false;
  const a = new TextEncoder().encode(header);
  const b = new TextEncoder().encode(secret);
  return a.length === b.length && timingSafeEqual(a, b);
}

async function call<T>(method: string, body: Record<string, unknown>): Promise<T> {
  const token = telegramToken();
  if (!token) throw new Error("Telegram is not configured");
  const response = await fetch(`${API}/bot${token}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(15_000)
  });
  const json = (await response.json().catch(() => null)) as { ok: boolean; result?: T; description?: string } | null;
  if (!response.ok || !json?.ok) throw new Error(`Telegram ${method} failed (${response.status}${json?.description ? `: ${json.description}` : ""})`);
  return json.result as T;
}

/** Sends plain text (no parse mode, so nothing needs escaping), split at Telegram's 4096-char limit. */
export async function sendMessage(chatId: number, text: string) {
  const chunks: string[] = [];
  let rest = text;
  while (rest.length > 4000) {
    const cut = rest.lastIndexOf("\n", 4000) > 2000 ? rest.lastIndexOf("\n", 4000) : 4000;
    chunks.push(rest.slice(0, cut));
    rest = rest.slice(cut).replace(/^\n+/, "");
  }
  if (rest) chunks.push(rest);
  for (const chunk of chunks) await call("sendMessage", { chat_id: chatId, text: chunk, link_preview_options: { is_disabled: true } });
}

/** Error text that is safe to log: bot tokens masked, length capped. Never pass message content here. */
export function safeErrorText(error: unknown) {
  const text = error instanceof Error
    ? `${error.name}: ${error.message}`
    : error && typeof error === "object" && "message" in error ? String((error as { message: unknown }).message) : "unknown error";
  return text.replace(/bot\d+:[\w-]+/g, "bot***").slice(0, 300);
}

/** Best-effort reply used for bot acknowledgements; never throws. */
export async function sendMessageQuietly(chatId: number, text: string) {
  try {
    await sendMessage(chatId, text);
  } catch (error) {
    console.error("Telegram reply failed", safeErrorText(error));
  }
}

function sniffImageType(bytes: Uint8Array): ImageType | null {
  if (bytes[0] === 0xff && bytes[1] === 0xd8) return "image/jpeg";
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) return "image/png";
  if (bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46) return "image/gif";
  if (bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 && bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50) return "image/webp";
  return null;
}

/**
 * Downloads a Telegram file into memory and returns it base64-encoded. Nothing touches disk.
 * Returns null for files that are too large or not a supported image.
 */
export async function downloadImage(fileId: string): Promise<{ mediaType: ImageType; base64: string } | null> {
  const token = telegramToken();
  if (!token) return null;
  const file = await call<{ file_path?: string; file_size?: number }>("getFile", { file_id: fileId });
  if (!file.file_path || (file.file_size ?? 0) > MAX_IMAGE_BYTES) return null;
  const response = await fetch(`${API}/file/bot${token}/${file.file_path}`, { signal: AbortSignal.timeout(20_000) });
  if (!response.ok) throw new Error(`Telegram file download failed (${response.status})`);
  const bytes = new Uint8Array(await response.arrayBuffer());
  if (bytes.byteLength > MAX_IMAGE_BYTES) return null;
  const mediaType = sniffImageType(bytes);
  if (!mediaType) return null;
  return { mediaType, base64: Buffer.from(bytes).toString("base64") };
}

/** The file id of the image in a message: the largest photo size, or an image sent as a file. */
export function imageFileId(message: TelegramMessage): string | null {
  if (message.photo?.length) {
    const sizes = [...message.photo].sort((a, b) => b.width * b.height - a.width * a.height);
    const fitting = sizes.find((size) => (size.file_size ?? 0) <= MAX_IMAGE_BYTES);
    return (fitting ?? sizes[sizes.length - 1]).file_id;
  }
  if (message.document && IMAGE_TYPES.includes(message.document.mime_type as ImageType)) return message.document.file_id;
  return null;
}

export function botUsername() {
  return (process.env.TELEGRAM_BOT_USERNAME || "").replace(/^@/, "") || null;
}
