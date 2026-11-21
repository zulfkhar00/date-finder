import { notFound } from "next/navigation";
import { DateDetailView } from "@/components/app/views";
import { getDate } from "@/lib/app/data";
import { createAppClient, requireUser } from "@/lib/app/session";
import { DateActions } from "@/components/app/date-actions";

export const metadata = { title: "Date" };

export default async function DatePage({ params }: { params: Promise<{ id: string }> }) {
  await requireUser();
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const date = await getDate(await createAppClient(), id);
  if (!date) notFound();
  const answerable = date.status !== "cancelled" && (date.client_response ?? "pending") === "pending" && Date.parse(date.starts_at) > Date.now();
  return <DateDetailView date={date} tag={date.status === "cancelled" ? "Cancelled" : date.client_response === "confirmed" ? "Confirmed" : "To confirm"} actions={answerable ? <DateActions id={date.id} who={date.who} /> : undefined} />;
}
