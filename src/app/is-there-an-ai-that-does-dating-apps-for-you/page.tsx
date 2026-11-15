import type { Metadata } from "next";
import { AiAnswerPage, aiPageMetadata } from "@/components/ai-answer-page";
import { getAiPage } from "@/content/ai-pages";

const page = getAiPage("/is-there-an-ai-that-does-dating-apps-for-you");

export const metadata: Metadata = aiPageMetadata(page);

export default function Page() {
  return <AiAnswerPage page={page} />;
}
