import { notFound } from "next/navigation";
import { Thread } from "@/components/app/thread";
import { handBack, sendMyMessage, takeOver } from "@/lib/app/actions";
import { getChat } from "@/lib/app/data";
import { createAppClient, requireUser } from "@/lib/app/session";

export const metadata = { title: "Chat" };

export default async function ChatPage({ params }: { params: Promise<{ id: string }> }) {
  await requireUser();
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const chat = await getChat(await createAppClient(), id);
  if (!chat) notFound();
  return (
    <Thread
      match={{ id: chat.match.id, name: chat.match.name, age: chat.match.age, app: chat.match.app }}
      photoUrl={chat.photoUrl} messages={chat.messages} mode={chat.mode} paused={chat.paused}
      api={{ takeOver, handBack, send: sendMyMessage }}
    />
  );
}
