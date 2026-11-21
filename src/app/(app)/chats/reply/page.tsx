import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { ReplyHelper } from "@/components/app/reply-helper";
import { createAppClient, requireUser } from "@/lib/app/session";
import { listThreads } from "@/lib/reply-helper/service";

export const metadata = { title: "Reply helper" };

// Open to every signed-in user, in every country: it is free value that needs no phone automation and no payment.
export default async function ReplyHelperPage({ searchParams }: { searchParams: Promise<{ t?: string }> }) {
  await requireUser();
  const sb = await createAppClient();
  const [{ t }, threads] = await Promise.all([searchParams, listThreads(sb).catch(() => [])]);
  return (
    <>
      <p className="app-sub" style={{ marginTop: 0 }}><Link href="/chats" className="app-link"><ChevronLeft size={16} aria-hidden />Chats</Link></p>
      <h1 className="app-h1">Reply helper</h1>
      <p className="app-sub">Show us a chat you&rsquo;re in. Get three replies in your own voice, where it stands, and when to ask them out.</p>
      <div style={{ marginTop: 18 }}>
        <ReplyHelper threads={threads} activeId={typeof t === "string" ? t : null} />
      </div>
    </>
  );
}
