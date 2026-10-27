"use server";

import { revalidatePath } from "next/cache";
import { adminEmailOrNull } from "@/lib/admin-auth";
import { ACTION_FROM_STATUS, CONTENT_ACTIONS, type ContentAction } from "@/lib/content";
import { UUID_PATTERN } from "../_lib/data";
import { requestAction } from "./data";

export type ContentActionState = { ok?: boolean; error?: string };

const MESSAGES = {
  already: "Already requested. It applies within about 5 minutes.",
  wrong_status: "This video moved on since the page loaded. Reload to see where it is now.",
  missing: "This video is no longer in the list.",
  unavailable: "Couldn't save the request. Try again in a minute."
} as const;

export async function requestContentAction(postId: string, action: ContentAction): Promise<ContentActionState> {
  const email = await adminEmailOrNull();
  if (!email) return { error: "Not authorized." };
  if (!UUID_PATTERN.test(postId) || !CONTENT_ACTIONS.includes(action)) return { error: "Unknown video." };

  const result = await requestAction(postId, action, ACTION_FROM_STATUS[action], email);
  if (result !== "ok") return { error: MESSAGES[result] };
  revalidatePath("/admin/videos");
  return { ok: true };
}
