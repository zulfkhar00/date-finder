import { notFound } from "next/navigation";
import { buildDemo } from "@/lib/app/demo-data";
import { DemoThread } from "./demo-thread";

export default async function DemoChat({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const chat = buildDemo().chats.find((c) => c.id === id);
  if (!chat) notFound();
  return <DemoThread chat={chat} />;
}
