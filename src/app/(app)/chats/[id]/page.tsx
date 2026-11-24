import { notFound } from "next/navigation";
import { after } from "next/server";
import { Thread } from "@/components/app/thread";
import { handBack, sendMyMessage, takeOver } from "@/lib/app/actions";
import { getChat } from "@/lib/app/data";
import { createAppClient, requireUser } from "@/lib/app/session";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

export const metadata = { title: "Chat" };

export default async function ChatPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const chat = await getChat(await createAppClient(), id);
  if (!chat) notFound();
  // Opening a chat marks it read, but only where read state is tracked (last_read_at is set), so ordinary accounts see no change.
  if (chat.match.last_read_at) {
    after(async () => { await getSupabaseAdmin().from("matches").update({ last_read_at: new Date().toISOString() }).eq("id", id).eq("user_id", user.id); });
  }
  return (
    <Thread
      match={{ id: chat.match.id, name: chat.match.name, age: chat.match.age, app: chat.match.app }}
      photoUrl={chat.photoUrl} messages={chat.messages} mode={chat.mode} paused={chat.paused}
      api={{ takeOver, handBack, send: sendMyMessage }}
      profileHref={chat.profile ? `/chats/${chat.match.id}/profile` : undefined} matchedAt={chat.profile ? chat.match.matched_at : undefined}
    />
  );
}
