import { buildDemo } from "@/lib/app/demo-data";
import { splitDates } from "@/lib/app/domain";
import { DemoHomeScreen } from "./demo-screens";

export default function DemoHome() {
  const d = buildDemo();
  return <DemoHomeScreen name={d.name} apps={d.apps} chats={d.chats} upcoming={splitDates(d.dates).upcoming} matchesThisWeek={d.matchesThisWeek} activity={d.activity} nowMs={d.now} />;
}
