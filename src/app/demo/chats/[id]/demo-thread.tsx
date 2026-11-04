"use client";

import { useState } from "react";
import { Thread, type ThreadApi } from "@/components/app/thread";
import { encodeSystemEvent, type ChatMode } from "@/lib/app/domain";
import type { DemoChat, DemoMessage } from "@/lib/app/demo-data";

/** The real thread screen, with local state standing in for the server so taking over and typing work in the demo. */
export function DemoThread({ chat }: { chat: DemoChat }) {
  const [mode, setMode] = useState<ChatMode>(chat.mode);
  const [messages, setMessages] = useState<DemoMessage[]>(chat.messages);
  const add = (sender: DemoMessage["sender"], body: string) =>
    setMessages((m) => [...m, { id: `local-${m.length}`, match_id: chat.id, sender, body, sent_at: new Date().toISOString() }]);
  const api: ThreadApi = {
    async takeOver() { setMode("user"); add("system_internal", encodeSystemEvent({ kind: "took_over" })); return { ok: true }; },
    async handBack() { setMode("ai"); add("system_internal", encodeSystemEvent({ kind: "handed_back" })); return { ok: true }; },
    async send(_id, body) { add("user", body); return { ok: true }; }
  };
  return <Thread base="/demo" match={{ id: chat.id, name: chat.name, age: chat.age, app: chat.app }} photoUrl={chat.photoUrl} messages={messages} mode={mode} paused={false} api={api} />;
}
