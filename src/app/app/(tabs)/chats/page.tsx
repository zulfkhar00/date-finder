import { requireOwner } from "@/lib/app/owner-gate";
import { MockChats } from "@/components/app/mock/screens";

export default async function Page() {
  await requireOwner();
  return <MockChats />;
}
