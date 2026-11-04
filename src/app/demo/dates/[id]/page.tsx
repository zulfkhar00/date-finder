import { notFound } from "next/navigation";
import { DateDetailView } from "@/components/app/views";
import { buildDemo } from "@/lib/app/demo-data";

export default async function DemoDate({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const date = buildDemo().dates.find((d) => d.id === id);
  if (!date) notFound();
  return <DateDetailView base="/demo" date={date} />;
}
