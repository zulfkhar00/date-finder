import type { Metadata } from "next";
import { AiAnswerPage, aiPageMetadata } from "@/components/ai-answer-page";
import { getAiPage } from "@/content/ai-pages";

const page = getAiPage("/dating-app-ghostwriter");

export const metadata: Metadata = aiPageMetadata(page);

export default function Page() {
  return <AiAnswerPage page={page} />;
}
