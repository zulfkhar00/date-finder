import Link from "next/link";
import type { ReactNode } from "react";
import { APP_LABELS, MODE_LABELS, STATUS_LABELS, effectiveStatus, initials, type App, type AppAccountRow, type ChatMode } from "@/lib/app/domain";

export function AppBadge({ app }: { app: App }) {
  return <span className="app-badge" data-app={app} aria-hidden="true">{APP_LABELS[app][0]}</span>;
}

export function Avatar({ name, url, large }: { name: string; url?: string | null; large?: boolean }) {
  return <span className={`app-avatar${large ? " lg" : ""}`} aria-hidden="true">{url ? <img src={url} alt="" /> : initials(name)}</span>;
}

export function StatusPill({ account }: { account: Pick<AppAccountRow, "status" | "user_paused"> }) {
  const s = effectiveStatus(account);
  return <span className="app-pill" data-tone={s === "live" ? "lime" : s === "paused" ? "grey" : "coral"}><i />{STATUS_LABELS[s]}</span>;
}

export function ModePill({ mode, paused }: { mode: ChatMode; paused?: boolean }) {
  if (mode === "ai" && paused) return <span className="app-pill" data-tone="grey"><i />Paused</span>;
  return <span className="app-pill" data-tone={mode === "ai" ? "lime" : "coral"}><i />{MODE_LABELS[mode]}</span>;
}

export function Empty({ title, children, icon }: { title: string; children?: ReactNode; icon?: ReactNode }) {
  return <div className="app-empty">{icon ? <div className="app-empty-mark">{icon}</div> : null}<strong>{title}</strong>{children}</div>;
}

export function RowLink({ href, children }: { href: string; children: ReactNode }) {
  return <Link href={href} className="app-row">{children}</Link>;
}
