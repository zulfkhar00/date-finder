// Pure helpers for the photo step, so a dropped connection never leaves the controls stuck. No I/O.
export const PHOTO_NETWORK_ERROR = "Couldn't reach NoSwipe. Check your connection and try again.";
export const PHOTO_ENCODE_ERROR = "We couldn't read that photo. Try a JPG or PNG.";
export const PHOTO_ACTION_TIMEOUT_MS = 20_000;

/** Rejects with a timeout error when the promise has not settled in `ms`. */
export function withTimeout<T>(promise: Promise<T>, ms = PHOTO_ACTION_TIMEOUT_MS): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error("timeout")), ms); });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

/**
 * What to tell the user when an upload throws. "encode" is our own marker for a file the browser could not read,
 * a message from the server (too big, wrong type, limit reached) is shown as is, and anything else, including
 * fetch failures (TypeError) and aborts, is a connection problem.
 */
export function uploadErrorMessage(cause: unknown): string {
  if (!(cause instanceof Error)) return PHOTO_NETWORK_ERROR;
  if (cause.message === "encode") return PHOTO_ENCODE_ERROR;
  if (cause.name === "TimeoutError" || cause.name === "AbortError" || cause instanceof TypeError || cause.message === "timeout" || !cause.message) return PHOTO_NETWORK_ERROR;
  return cause.message;
}
