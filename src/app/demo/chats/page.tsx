import { ChatsView } from "@/components/app/views";
import { buildDemo } from "@/lib/app/demo-data";

export default function DemoChats() {
  return <ChatsView base="/demo" chats={buildDemo().chats} />;
}
