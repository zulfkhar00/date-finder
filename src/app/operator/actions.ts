"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { endAdminSession, requireAdmin, sendAdminMagicLink } from "@/lib/admin-auth";
import { APP_OPTIONS, approveAndSend, createClientInvite, recordTracker, regenerateInvite, rejectDraft, updateClient } from "@/lib/concierge/operator";
import { safeErrorText } from "@/lib/concierge/telegram";
import { CLIENT_STATUSES } from "@/lib/concierge/types";

export type ActionState = { ok?: boolean; message?: string; code?: string; link?: string | null } | null;

const uuid = z.uuid();
const text = (max: number) => z.string().trim().max(max);

function siteOrigin() {
  return (process.env.SITE_URL ?? "http://localhost:3000").replace(/\/$/, "");
}

function apps(formData: FormData) {
  const chosen = formData.getAll("apps").map(String);
  return APP_OPTIONS.filter((app) => chosen.includes(app));
}

function failure(error: unknown): ActionState {
  console.error("Operator action failed", safeErrorText(error));
  return { ok: false, message: "That didn't work. Check the server configuration and try again." };
}

export async function requestMagicLink(_: ActionState, formData: FormData): Promise<ActionState> {
  const email = z.email().safeParse(String(formData.get("email") ?? "").trim());
  if (!email.success) return { ok: false, message: "Enter a valid email address." };
  const next = String(formData.get("next") ?? "/operator");
  const safeNext = next.startsWith("/operator") ? next : "/operator";
  try {
    await sendAdminMagicLink(email.data, `${siteOrigin()}/operator/auth/callback?next=${encodeURIComponent(safeNext)}`);
  } catch (error) {
    return failure(error);
  }
  return { ok: true, message: "If that address is on the operator list, a sign-in link is on its way. Open it in this browser." };
}

export async function signOut() {
  await endAdminSession();
  redirect("/operator/login");
}

export async function decideDraft(_: ActionState, formData: FormData): Promise<ActionState> {
  const admin = await requireAdmin("/operator");
  const id = uuid.safeParse(formData.get("id"));
  if (!id.success) return { ok: false, message: "Unknown draft." };
  const intent = String(formData.get("intent") ?? "");
  try {
    if (intent === "reject") {
      const note = text(2000).parse(String(formData.get("note") ?? ""));
      const done = await rejectDraft(id.data, note, admin.email);
      revalidatePath("/operator");
      return done ? { ok: true, message: "Rejected." } : { ok: false, message: "This draft was already handled." };
    }
    if (intent === "send") {
      const result = await approveAndSend(id.data, String(formData.get("message") ?? ""), admin.email);
      revalidatePath("/operator");
      if (!result.ok) return { ok: false, message: result.error };
      return { ok: result.sent, message: result.sent ? "Sent to the client." : result.notice };
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
  await requireAdmin("/operator/clients");
  const parsed = inviteSchema.safeParse({
    name: String(formData.get("name") ?? ""),
    voiceNotes: String(formData.get("voiceNotes") ?? ""),
    reservationEmail: String(formData.get("reservationEmail") ?? "").trim()
  });
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? "Check the form." };
  try {
    const result = await createClientInvite({ ...parsed.data, apps: apps(formData) });
    revalidatePath("/operator/clients");
    if ("error" in result) return { ok: false, message: result.error };
    return { ok: true, message: `Invite created for ${parsed.data.name}.`, code: result.code, link: result.link };
  } catch (error) {
    return failure(error);
  }
}

export async function newInviteCode(_: ActionState, formData: FormData): Promise<ActionState> {
  await requireAdmin("/operator/clients");
  const id = uuid.safeParse(formData.get("id"));
  if (!id.success) return { ok: false, message: "Unknown client." };
  try {
    const result = await regenerateInvite(id.data);
    revalidatePath("/operator/clients");
    if ("error" in result) return { ok: false, message: result.error };
    return { ok: true, message: "New code ready.", code: result.code, link: result.link };
  } catch (error) {
    return failure(error);
  }
}

export async function saveClient(_: ActionState, formData: FormData): Promise<ActionState> {
  await requireAdmin("/operator/clients");
  const id = uuid.safeParse(formData.get("id"));
  const status = z.enum(CLIENT_STATUSES).safeParse(formData.get("status"));
  const voiceNotes = text(4000).safeParse(String(formData.get("voiceNotes") ?? ""));
  if (!id.success || !status.success || !voiceNotes.success) return { ok: false, message: "Check the form." };
  try {
    await updateClient(id.data, { voiceNotes: voiceNotes.data, apps: apps(formData), status: status.data });
    revalidatePath("/operator/clients");
    return { ok: true, message: "Saved." };
  } catch (error) {
    return failure(error);
  }
}

const count = z.union([z.literal(""), z.coerce.number().int().min(0).max(100000)]).transform((value) => (value === "" ? null : value));

export async function saveTracker(_: ActionState, formData: FormData): Promise<ActionState> {
  await requireAdmin("/operator/clients");
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
    revalidatePath("/operator/clients");
    return { ok: true, message: "Snapshot saved." };
  } catch (error) {
    return failure(error);
  }
}
