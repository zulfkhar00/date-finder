"use server";

import { revalidatePath } from "next/cache";
import { adminEmailOrNull } from "@/lib/admin-auth";
import { isAction } from "@/lib/reports/core";
import { applyAction } from "@/lib/reports/admin-actions";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

export type OpState = { ok?: string; error?: string };

/** One decision on a report. The admin session is checked here (never trusting the page), the note is required, and the
 * action is logged with the admin's email by applyAction. */
export async function reportAction(reportId: string, action: string, _prev: OpState, formData: FormData): Promise<OpState> {
  const admin = await adminEmailOrNull();
  if (!admin || !isAction(action)) return { error: "Not authorized." };
  try {
    const result = await applyAction(getSupabaseAdmin(), admin, reportId, action, {
      note: formData.get("note"), userId: formData.get("userId"), photoId: formData.get("photoId"), ncmecId: formData.get("ncmecId")
    });
    if (!result.ok) return { error: result.error };
    revalidatePath(`/admin/reports/${reportId}`);
    revalidatePath("/admin/reports");
    return { ok: result.warning ? `${result.message} Warning: ${result.warning}` : result.message };
  } catch (error) {
    console.error("Report action failed", error instanceof Error ? error.name : "unknown");
    return { error: "Couldn't save. Try again." };
  }
}
