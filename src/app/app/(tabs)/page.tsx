import { requireOwner } from "@/lib/app/owner-gate";
import { MockHome } from "@/components/app/mock/screens";

export default async function Page() {
  await requireOwner();
  return <MockHome />;
}
