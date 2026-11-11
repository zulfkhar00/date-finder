import { ResumeSlot } from "@/components/app/resume-slot";
import { ChatsView } from "@/components/app/views";
import { getApps, getSetupGaps, listChats } from "@/lib/app/data";
import { createAppClient, requireUser } from "@/lib/app/session";

export const metadata = { title: "Chats" };

export default async function ChatsPage() {
  const user = await requireUser();
  const sb = await createAppClient();
  const chats = await listChats(sb);
  const [apps, gaps] = chats.length ? [[], []] : await Promise.all([getApps(sb), getSetupGaps(sb, user.id)]);
  return <><ResumeSlot /><ChatsView chats={chats} apps={apps} gaps={gaps} /></>;
}
