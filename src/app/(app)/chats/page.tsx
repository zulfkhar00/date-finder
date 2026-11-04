import { ChatsView } from "@/components/app/views";
import { listChats } from "@/lib/app/data";
import { createAppClient, requireUser } from "@/lib/app/session";

export const metadata = { title: "Chats" };

export default async function ChatsPage() {
  await requireUser();
  return <ChatsView chats={await listChats(await createAppClient())} />;
}
