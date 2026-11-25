import { requireOwner } from "@/lib/app/owner-gate";
import { MockChat } from "@/components/app/mock/chat";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  await requireOwner();
  const { id } = await params;
  return <MockChat id={id} />;
}
