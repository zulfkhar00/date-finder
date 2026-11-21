"use client";

import { DatesView, HomeView } from "@/components/app/views";
import type { AccountApi } from "@/components/app/accounts";
import type { DateApi } from "@/components/app/date-actions";
import type { DemoChat } from "@/lib/app/demo-data";
import type { ActivityRow } from "@/lib/app/activity";
import type { AppAccountRow, DateRow } from "@/lib/app/domain";
import type { CopyContext } from "@/lib/app/status-copy";

// The real Home and Dates screens with sample data. Pause, Take over, Resume, Confirm and Decline do nothing but answer "ok" after a
// beat, so the buttons show their loading state and the card changes, with nothing saved anywhere.
const wait = () => new Promise<{ ok: true }>((resolve) => setTimeout(() => resolve({ ok: true }), 600));
export const demoAccountApi: AccountApi = { pause: wait, resume: wait, takeOver: wait };
export const demoDateApi: DateApi = { respond: wait };

export function DemoHomeScreen({ name, apps, chats, upcoming, matchesThisWeek, activity, nowMs, fulfilment }: {
  name: string; apps: AppAccountRow[]; chats: DemoChat[]; upcoming: (DateRow & { match_id: string | null })[]; matchesThisWeek: number;
  activity: ActivityRow[] | null; nowMs: number; fulfilment?: CopyContext;
}) {
  return (
    <HomeView
      base="/demo" name={name} apps={apps} chats={chats} upcoming={upcoming} needsYou={chats.filter((c) => c.needs_user && c.mode === "ai")}
      matchesThisWeek={matchesThisWeek} activity={activity} nowMs={nowMs} accountApi={demoAccountApi} fulfilment={fulfilment}
    />
  );
}

export function DemoDatesScreen({ dates }: { dates: DateRow[] }) {
  return <DatesView base="/demo" dates={dates} dateApi={demoDateApi} />;
}
