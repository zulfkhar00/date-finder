// Checks for the photo step's failure handling. No network, no database.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { PHOTO_ENCODE_ERROR, PHOTO_NETWORK_ERROR, uploadErrorMessage, withTimeout } from "../src/lib/app/photo-errors";

async function main() {
  assert.equal(uploadErrorMessage(new Error("encode")), PHOTO_ENCODE_ERROR);
  assert.equal(uploadErrorMessage(new TypeError("Failed to fetch")), PHOTO_NETWORK_ERROR, "offline fetch is a connection problem");
  const timeout = new Error("signal timed out"); timeout.name = "TimeoutError";
  assert.equal(uploadErrorMessage(timeout), PHOTO_NETWORK_ERROR);
  assert.equal(uploadErrorMessage(new Error("timeout")), PHOTO_NETWORK_ERROR);
  assert.equal(uploadErrorMessage(new Error("That photo is too large.")), "That photo is too large.", "server messages are shown as is");
  assert.equal(uploadErrorMessage("weird"), PHOTO_NETWORK_ERROR);
  assert.equal(await withTimeout(Promise.resolve("ok"), 50), "ok");
  await assert.rejects(withTimeout(new Promise(() => undefined), 20), /timeout/);

  const manager = readFileSync(new URL("../src/components/app/photo-manager.tsx", import.meta.url), "utf8");
  assert.match(manager, /AbortSignal\.timeout/, "uploads cannot hang forever");
  assert.equal((manager.match(/lock\(""\)/g) ?? []).length, 3, "add, remove and move all release the lock");
  assert.match(manager, /withTimeout\(api\.remove/, "remove cannot leave the controls disabled");
  assert.match(manager, /withTimeout\(api\.reorder/, "reorder cannot leave the controls disabled");
  const flow = readFileSync(new URL("../src/app/onboarding/flow.tsx", import.meta.url), "utf8");
  assert.match(flow, /def\.key === "photos" \? !photoBusy/, "Continue waits for an upload in flight");
  console.log("photo step checks ok");
}
void main();
