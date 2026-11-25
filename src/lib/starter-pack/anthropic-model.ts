import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { PackError, type ModelRequest, type ModelResponse, type PackModel } from "./generate";
import { PACK_MODEL } from "./types";

// The only place the starter pack talks to Anthropic. The key stays on the server (ANTHROPIC_API_KEY, never
// NEXT_PUBLIC_). maxRetries is 0: the generator owns retries and backoff so every attempt is counted and capped.

const REQUEST_TIMEOUT_MS = 70_000;

/** Maps an SDK failure to a code. Only the status and the error class name are read: never the message or body. */
export function classifyModelError(error: unknown): PackError {
  const status = (error as { status?: unknown } | null)?.status;
  const name = (error as { name?: unknown } | null)?.name;
  if (name === "APIConnectionTimeoutError") return new PackError("timeout", true);
  if (name === "APIConnectionError") return new PackError("network", true);
  if (typeof status === "number") {
    if (status === 429) return new PackError("rate_limited", true);
    if (status === 408 || status === 409 || status === 529 || status >= 500) return new PackError("overloaded", true);
    if (status === 401 || status === 403) return new PackError("unauthorized", false);
    return new PackError(`rejected_${status}`, false);
  }
  return new PackError("model_error", true);
}

export function createAnthropicModel(apiKey: string | undefined = process.env.ANTHROPIC_API_KEY, timeoutMs: number = REQUEST_TIMEOUT_MS): PackModel | null {
  if (!apiKey?.trim()) return null;
  const client = new Anthropic({ apiKey, timeout: timeoutMs, maxRetries: 0 });
  return {
    async complete(request: ModelRequest): Promise<ModelResponse> {
      const content: Anthropic.ContentBlockParam[] = [];
      (request.images ?? []).forEach((image, i) => {
        content.push({ type: "text", text: `Photo ${i + 1}:` });
        content.push({ type: "image", source: { type: "base64", media_type: image.mediaType, data: image.data } });
      });
      content.push({ type: "text", text: request.user });
      try {
        const message = await client.messages.create({
          model: request.model ?? PACK_MODEL, max_tokens: request.maxTokens, system: request.system, messages: [{ role: "user", content }]
        });
        const text = message.content.map((block) => (block.type === "text" ? block.text : "")).join("");
        return { text, inputTokens: message.usage?.input_tokens ?? 0, outputTokens: message.usage?.output_tokens ?? 0, stopReason: message.stop_reason };
      } catch (error) {
        throw classifyModelError(error);
      }
    }
  };
}
