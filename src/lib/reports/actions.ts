"use server";

import { revalidatePath } from "next/cache";
import { userOrNull } from "@/lib/app/session";
import { submitAppeal } from "./service";

export type AppealState = { ok?: string; error?: string };

/** The signed-in user's appeal of a pause or closure that followed a report. One appeal, within 14 days. */
export async function submitAppealAction(_prev: AppealState, formData: FormData): Promise<AppealState> {
  const user = await userOrNull();
  if (!user) return { error: "Your session ended. Sign in again." };
  try {
    const result = await submitAppeal(user.id, formData.get("appeal"));
    if (!result.ok) return { error: result.error };
    revalidatePath("/", "layout");
    return { ok: `Appeal received for ${result.ref}. A different reviewer looks at it within 7 days and we email you the answer.` };
  } catch (error) {
    console.error("Appeal action failed", error instanceof Error ? error.name : "unknown");
    return { error: "We couldn't save your appeal. Try again in a moment." };
  }
}
