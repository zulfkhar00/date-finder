"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { adminEmailOrNull } from "@/lib/admin-auth";
import { APP_OPTIONS, approveAndSend, createClientInvite, recordTracker, regenerateInvite, rejectDraft, releaseStuckDraft, resendDraft, updateClient } from "@/lib/concierge/operator";
import { safeErrorText } from "@/lib/concierge/telegram";
import { CLIENT_STATUSES } from "@/lib/concierge/types";

// Every action checks the shared admin session (confirmed email on ADMIN_EMAILS) itself.

export type ActionState = { ok?: boolean; message?: string; code?: string; link?: string | null } | null;

const QUEUE = "/admin/concierge";
const CLIENTS = "/admin/concierge/clients";
const NOT_AUTHORIZED: ActionState = { ok: false, message: "Your session has ended. Sign in again at /admin/login." };

const uuid = z.uuid();
const text = (max: number) => z.string().trim().max(max);

function apps(formData: FormData) {
  const chosen = formData.getAll("apps").map(String);
  return APP_OPTIONS.filter((app) => chosen.includes(app));
}

function failure(error: unknown): ActionState {
  console.error("Concierge action failed", safeErrorText(error));
  return { ok: false, message: "That didn't work. Check the server configuration and try again." };
}

export async function decideDraft(_: ActionState, formData: FormData): Promise<ActionState> {
  const admin = await adminEmailOrNull();
  if (!admin) return NOT_AUTHORIZED;
  const id = uuid.safeParse(formData.get("id"));
  if (!id.success) return { ok: false, message: "Unknown draft." };
  const intent = String(formData.get("intent") ?? "");
  try {
    if (intent === "reject") {
      const note = text(2000).parse(String(formData.get("note") ?? ""));
      const done = await rejectDraft(id.data, note, admin);
      revalidatePath(QUEUE);
      return done ? { ok: true, message: "Rejected." } : { ok: false, message: "This draft was already handled." };
    }
    if (intent === "send" || intent === "resend") {
      const result = intent === "send"
        ? await approveAndSend(id.data, String(formData.get("message") ?? ""), admin)
        : await resendDraft(id.data);
      revalidatePath(QUEUE);
      if (!result.ok) return { ok: false, message: result.error };
      return { ok: result.sent, message: result.notice ?? (result.sent ? "Sent to the client." : undefined) };
    }
    if (intent === "release") {
      const released = await releaseStuckDraft(id.data);
      revalidatePath(QUEUE);
      return released
        ? { ok: true, message: "Released. Check his chat before resending." }
        : { ok: false, message: "Not released: it is still within its send window or was already handled." };
    }
    return { ok: false, message: "Unknown action." };
  } catch (error) {
    return failure(error);
  }
}

const inviteSchema = z.object({
  name: text(120).min(1, "Enter the client's first name."),
  voiceNotes: text(4000),
  reservationEmail: z.union([z.literal(""), z.email()])
});

export async function createInvite(_: ActionState, formData: FormData): Promise<ActionState> {
  if (!(await adminEmailOrNull())) return NOT_AUTHORIZED;
  const parsed = inviteSchema.safeParse({
    name: String(formData.get("name") ?? ""),
    voiceNotes: String(formData.get("voiceNotes") ?? ""),
    reservationEmail: String(formData.get("reservationEmail") ?? "").trim()
  });
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? "Check the form." };
  try {
    const result = await createClientInvite({ ...parsed.data, apps: apps(formData) });
    revalidatePath(CLIENTS);
    if ("error" in result) return { ok: false, message: result.error };
    return { ok: true, message: `Invite created for ${parsed.data.name}.`, code: result.code, link: result.link };
  } catch (error) {
    return failure(error);
  }
}

export async function newInviteCode(_: ActionState, formData: FormData): Promise<ActionState> {
  if (!(await adminEmailOrNull())) return NOT_AUTHORIZED;
  const id = uuid.safeParse(formData.get("id"));
  if (!id.success) return { ok: false, message: "Unknown client." };
  try {
    const result = await regenerateInvite(id.data);
    revalidatePath(CLIENTS);
    if ("error" in result) return { ok: false, message: result.error };
    return { ok: true, message: "New code ready.", code: result.code, link: result.link };
  } catch (error) {
    return failure(error);
  }
}

export async function saveClient(_: ActionState, formData: FormData): Promise<ActionState> {
  if (!(await adminEmailOrNull())) return NOT_AUTHORIZED;
  const id = uuid.safeParse(formData.get("id"));
  const status = z.enum(CLIENT_STATUSES).safeParse(formData.get("status"));
  const voiceNotes = text(4000).safeParse(String(formData.get("voiceNotes") ?? ""));
  if (!id.success || !status.success || !voiceNotes.success) return { ok: false, message: "Check the form." };
  try {
    await updateClient(id.data, { voiceNotes: voiceNotes.data, apps: apps(formData), status: status.data });
    revalidatePath(CLIENTS);
    return { ok: true, message: "Saved." };
  } catch (error) {
    return failure(error);
  }
}

const count = z.union([z.literal(""), z.coerce.number().int().min(0).max(100000)]).transform((value) => (value === "" ? null : value));

export async function saveTracker(_: ActionState, formData: FormData): Promise<ActionState> {
  if (!(await adminEmailOrNull())) return NOT_AUTHORIZED;
  const parsed = z.object({
    id: uuid,
    matchesWeek: count,
    convos: count,
    datesScheduled: count,
    note: text(500)
  }).safeParse({
    id: formData.get("id"),
    matchesWeek: String(formData.get("matchesWeek") ?? "").trim(),
    convos: String(formData.get("convos") ?? "").trim(),
    datesScheduled: String(formData.get("datesScheduled") ?? "").trim(),
    note: String(formData.get("note") ?? "")
  });
  if (!parsed.success) return { ok: false, message: "Numbers must be whole and zero or more." };
  const { id, ...values } = parsed.data;
  if (values.matchesWeek === null && values.convos === null && values.datesScheduled === null) return { ok: false, message: "Enter at least one number." };
  try {
    await recordTracker(id, values);
    revalidatePath(CLIENTS);
    return { ok: true, message: "Snapshot saved." };
  } catch (error) {
    return failure(error);
  }
}
