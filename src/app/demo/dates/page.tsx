import { buildDemo } from "@/lib/app/demo-data";
import { DemoDatesScreen } from "../demo-screens";

export default function DemoDates() {
  return <DemoDatesScreen dates={buildDemo().dates} />;
}
