import { notFound } from "next/navigation";
import { MatchProfileView } from "@/components/app/match-profile-view";
import { getChat, signUrls } from "@/lib/app/data";
import { createAppClient, requireUser } from "@/lib/app/session";

export const metadata = { title: "Profile" };

export default async function MatchProfilePage({ params }: { params: Promise<{ id: string }> }) {
  await requireUser();
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const sb = await createAppClient();
  const chat = await getChat(sb, id);
  if (!chat?.profile) notFound();
  const urls = await signUrls(sb, chat.profile.photos);
  const photoUrls = chat.profile.photos.map((p) => urls.get(p)).filter((u): u is string => Boolean(u));
  return <MatchProfileView match={chat.match} profile={chat.profile} photoUrls={photoUrls} />;
}
