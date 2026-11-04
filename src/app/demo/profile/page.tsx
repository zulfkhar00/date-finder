import { buildDemo } from "@/lib/app/demo-data";
import { DemoProfile } from "./demo-profile";

export default function DemoProfilePage() {
  const d = buildDemo();
  return <DemoProfile draft={d.draft} photos={d.photos} apps={d.apps} age={d.age} />;
}
