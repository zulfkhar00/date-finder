import { DatesView } from "@/components/app/views";
import { buildDemo } from "@/lib/app/demo-data";

export default function DemoDates() {
  return <DatesView base="/demo" dates={buildDemo().dates} />;
}
