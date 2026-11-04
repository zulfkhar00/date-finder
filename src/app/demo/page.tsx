import { HomeView } from "@/components/app/views";
import { buildDemo } from "@/lib/app/demo-data";
import { splitDates } from "@/lib/app/domain";

export default function DemoHome() {
  const d = buildDemo();
  return <HomeView base="/demo" name={d.name} apps={d.apps} chats={d.chats} upcoming={splitDates(d.dates).upcoming} needsYou={d.chats.filter((c) => c.needs_user && c.mode === "ai")} matchesThisWeek={d.matchesThisWeek} />;
}
