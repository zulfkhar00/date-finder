import { notFound } from "next/navigation";
import { DateDetailView } from "@/components/app/views";
import { getDate } from "@/lib/app/data";
import { createAppClient, requireUser } from "@/lib/app/session";

export const metadata = { title: "Date" };

export default async function DatePage({ params }: { params: Promise<{ id: string }> }) {
  await requireUser();
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const date = await getDate(await createAppClient(), id);
  if (!date) notFound();
  return <DateDetailView date={date} />;
}
