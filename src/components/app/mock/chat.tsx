"use client";

import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { Thread } from "@/components/app/thread";
import { Empty } from "@/components/app/ui";
import { draftApi, threadApi } from "@/components/app/mock/actions";
import { chatSummaries, lastReal } from "@/lib/app/mock-core";
import { useMock } from "@/lib/app/mock-store";

export function MockChat({ id }: { id: string }) {
  const s = useMock();
  if (!s) return null;
  const m = s.matches.find((x) => x.id === id);
  const summary = chatSummaries(s).find((c) => c.id === id);
  if (!m || !summary) {
    // A bookmarked chat from before a reset, or a mistyped link.
    return (
      <>
        <Link href="/app/chats" className="app-link" style={{ display: "inline-flex", alignItems: "center", gap: 4, textDecoration: "none", marginLeft: -6 }}><ChevronLeft size={20} aria-hidden /> Chats</Link>
        <div style={{ marginTop: 18 }}><Empty title="This chat isn't here">It may have been cleared when the sample data was reset.</Empty></div>
      </>
    );
  }
  const draft = m.draft ? { body: m.draft.options[m.draft.i], reason: m.needs_reason, canRetake: m.draft.options.length > 1 } : null;
  const canDraft = m.mode === "ai" && !m.draft && !m.pendingReplyAt && lastReal(m)?.sender === "match";
  return (
    <Thread
      base="/app" match={{ id: m.id, name: m.name, age: m.age, app: m.app }} photoUrl={m.photoUrl}
      messages={m.messages.map((x) => ({ ...x, match_id: m.id }))} mode={m.mode} paused={summary.paused}
      api={threadApi} draftApi={draftApi} draft={draft} typing={Boolean(m.pendingReplyAt)} canDraft={canDraft}
    />
  );
}
