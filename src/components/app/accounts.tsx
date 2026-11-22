"use client";

import { useMemo, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronRight, Hand, Pause, Play } from "lucide-react";
import { AppBadge } from "@/components/app/ui";
import { When } from "@/components/app/when";
import { hasActivity, summarizeToday, type ActivityRow, type DayStats } from "@/lib/app/activity";
import { setAppPaused, takeOverApp } from "@/lib/app/actions";
import { APP_LABELS, APPS, effectiveStatus, isActiveStatus, type App, type AppAccountRow } from "@/lib/app/domain";
import { appCopy, type CopyContext } from "@/lib/app/status-copy";

type R = { ok: true } | { ok: false; error: string };
export type AccountApi = { pause: (app: App) => Promise<R>; resume: (app: App) => Promise<R>; takeOver: (app: App) => Promise<R> };
export const realAccountApi: AccountApi = { pause: (app) => setAppPaused(app, true), resume: (app) => setAppPaused(app, false), takeOver: (app) => takeOverApp(app) };

const subscribeNever = () => () => {};
/** The viewer's own IANA time zone. The server render says UTC; the browser swaps it on mount (same pattern as <When>). */
function useTimeZone(): string {
  return useSyncExternalStore(subscribeNever, () => Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC", () => "UTC");
}
function zoneName(timeZone: string, nowMs: number): string {
  try {
    return new Intl.DateTimeFormat("en-US", { timeZone, timeZoneName: "short" }).formatToParts(nowMs).find((p) => p.type === "timeZoneName")?.value ?? timeZone;
  } catch { return timeZone; }
}

const STAT_LABELS: [keyof Pick<DayStats, "swipes" | "matches" | "chatsActive" | "datesBooked">, string][] = [
  ["swipes", "Swipes"], ["matches", "New matches"], ["chatsActive", "Chats active"], ["datesBooked", "Dates booked"]
];

function Card({ account, ctx, stats, feedReady, tzLabel, base, api, hasChats }: {
  account: AppAccountRow; ctx: CopyContext; stats: DayStats; feedReady: boolean; tzLabel: string; base: string; api: AccountApi; hasChats: boolean;
}) {
  const router = useRouter();
  const [paused, setPaused] = useState(account.user_paused);
  const [busy, setBusy] = useState<"" | "pause" | "resume" | "takeover">("");
  const [error, setError] = useState("");
  const [confirmTakeOver, setConfirmTakeOver] = useState(false);
  const row = { ...account, user_paused: paused };
  const copy = appCopy(row, ctx);
  const status = effectiveStatus(row);
  const held = Boolean(ctx.hold);
  const running = isActiveStatus(status);
  const needsYou = status === "needs_client_action" && !paused;
  const showToday = !held && (running || needsYou || (paused && hasActivity(stats)));
  const canPause = !held && !paused && (running || needsYou || status === "setting_up") && ctx.paid;
  const canTakeOver = !held && !paused && (running || needsYou) && ctx.paid;
  const canResume = !held && paused;

  async function run(kind: "pause" | "resume" | "takeover", call: () => Promise<R>, after: () => void) {
    if (busy) return;
    setBusy(kind); setError(""); setConfirmTakeOver(false);
    try {
      const r = await call();
      if (r.ok) { after(); router.refresh(); } else setError(r.error);
    } catch {
      setError("Couldn't reach NoSwipe. Check your connection and try again.");
    } finally {
      setBusy("");
    }
  }

  return (
    <li className="app-card acct" data-testid={`app-status-${account.app}`} data-status={held ? "held" : paused ? "paused" : account.status}>
      <div className="acct-head">
        <AppBadge app={account.app} />
        <div className="app-row-body">
          <div className="app-row-title">{APP_LABELS[account.app]} <span className="app-pill" data-tone={copy.tone}><i />{copy.label}</span></div>
        </div>
      </div>
      <p className="acct-text">{copy.text}</p>
      {needsYou ? <p className="acct-action"><Link href={`${base}/profile`} className="app-link">Open Profile<ChevronRight size={16} aria-hidden /></Link> <a className="app-link" href="mailto:support@noswipe.app?subject=I%20did%20what%20you%20asked">Tell us it&rsquo;s done<ChevronRight size={16} aria-hidden /></a></p> : null}

      {showToday ? (
        <div className="acct-today" data-testid={`activity-${account.app}`}>
          <div className="acct-today-head"><strong>Today</strong><span className="app-muted">{tzLabel}{stats.lastAt ? <> · last activity <When iso={stats.lastAt} style="time" /></> : null}</span></div>
          {!feedReady ? <p className="app-muted acct-empty">Activity reporting isn&rsquo;t on for your account yet. It will show up here once our phone reports in.</p> : !hasActivity(stats) ? (
            <p className="app-muted acct-empty">{running ? "Nothing reported yet today. The numbers show up here as our phone works your account." : "Nothing reported today."}</p>
          ) : (
            <dl className="acct-stats">{STAT_LABELS.map(([k, label]) => <div key={k}><dt>{label}</dt><dd>{stats[k]}</dd></div>)}</dl>
          )}
        </div>
      ) : null}

      {canPause || canTakeOver || canResume ? (
        <div className="acct-actions">
          {canResume ? <button type="button" className="app-btn small" onClick={() => run("resume", () => api.resume(account.app), () => setPaused(false))} disabled={busy !== ""} aria-busy={busy === "resume"}>{busy === "resume" ? <><span className="app-spinner" aria-hidden /> Resuming…</> : <><Play size={16} aria-hidden /> Resume</>}</button> : null}
          {canPause ? <button type="button" className="app-btn ghost small" onClick={() => run("pause", () => api.pause(account.app), () => setPaused(true))} disabled={busy !== ""} aria-busy={busy === "pause"}>{busy === "pause" ? <><span className="app-spinner" aria-hidden /> Pausing…</> : <><Pause size={16} aria-hidden /> Pause</>}</button> : null}
          {canTakeOver && !confirmTakeOver ? <button type="button" className="app-btn ghost small" onClick={() => setConfirmTakeOver(true)} disabled={busy !== ""}><Hand size={16} aria-hidden /> Take over</button> : null}
        </div>
      ) : null}
      {confirmTakeOver ? (
        <div className="acct-confirm" role="alertdialog" aria-label={`Take over ${APP_LABELS[account.app]}`}>
          <p>Take over {APP_LABELS[account.app]}? We stop swiping and chatting as you there{hasChats ? ", and every open chat becomes yours to write" : ""}. Resume hands it back.</p>
          <div className="acct-actions">
            <button type="button" className="app-btn small" onClick={() => run("takeover", () => api.takeOver(account.app), () => setPaused(true))} disabled={busy !== ""} aria-busy={busy === "takeover"}>{busy === "takeover" ? <><span className="app-spinner" aria-hidden /> Taking over…</> : "Yes, take over"}</button>
            <button type="button" className="app-btn ghost small" onClick={() => setConfirmTakeOver(false)} disabled={busy !== ""}>Cancel</button>
          </div>
        </div>
      ) : null}
      {error ? <p className="app-error" role="alert" style={{ marginTop: 8 }}>{error}</p> : null}
    </li>
  );
}

/** "Your accounts, run by NoSwipe": one card per connected app with its state, today's activity from the feed and the controls. */
export function AccountCards({ apps, ctx, activity, nowMs, base = "", api = realAccountApi, hasChatsByApp = {} }: {
  apps: AppAccountRow[]; ctx: CopyContext;
  /** null = the feed does not exist yet (nothing to show but an honest line). */
  activity: readonly ActivityRow[] | null; nowMs: number; base?: string; api?: AccountApi; hasChatsByApp?: Partial<Record<App, boolean>>;
}) {
  const tz = useTimeZone();
  const today = useMemo(() => summarizeToday(activity ?? [], nowMs, tz), [activity, nowMs, tz]);
  const accounts = APPS.flatMap((app) => apps.filter((a) => a.app === app));
  const tzLabel = zoneName(tz, nowMs);
  return (
    <ul className="app-list" data-testid="account-cards">
      {accounts.map((a) => <Card key={`${a.app}:${a.user_paused}`} account={a} ctx={ctx} stats={today[a.app]} feedReady={activity !== null} tzLabel={tzLabel} base={base} api={api} hasChats={Boolean(hasChatsByApp[a.app])} />)}
    </ul>
  );
}
