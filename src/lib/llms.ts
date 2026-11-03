import { aiPages } from "@/content/ai-pages";
import { faqs } from "@/content/faq";
import { guides } from "@/content/guides";

const site = "https://www.noswipe.app";

const summary = [
  "NoSwipe is a screenshot-based AI dating assistant. It drafts dating profile suggestions, first messages (openers), replies and first-date plans from photos and screenshots the user chooses to share. The user makes every profile change, sends every message and confirms every date himself.",
  "NoSwipe does not log in to Tinder, Hinge, Bumble or any dating app, and it does not swipe, like, send messages or book dates. It cannot guarantee matches, replies or dates."
];

const audience =
  "Who it is for: men who date on Tinder, Hinge and Bumble and want a clearer profile and better-written messages without giving anyone access to their accounts.";

const pricing = [
  "NoSwipe is in early access. As shown on the site, the only payment today is a one-time, refundable early-access payment, which the terms say does not start a service.",
  "The exact price is shown at checkout before anyone pays, a refund is available by emailing support@noswipe.app, and prices for any ongoing service will be shown before a person decides to join it."
];

const privacy =
  "Privacy: screenshots and photos are used only to prepare the user's drafts, are deleted after drafting and are never used to train AI models. See " + site + "/privacy.";

const keyPages = [
  { label: "Home", url: site, note: "What NoSwipe does and how it works" },
  ...aiPages.map((page) => ({ label: page.h1, url: `${site}${page.path}`, note: page.description })),
  { label: "Guides index", url: `${site}/guides`, note: "All dating-app guides" },
  { label: "Privacy note", url: `${site}/privacy`, note: "How screenshots and data are handled" },
  { label: "Terms", url: `${site}/terms`, note: "Early-access terms and refund policy" }
];

export function llmsTxt(): string {
  const lines: string[] = [
    "# NoSwipe",
    "",
    `> ${summary[0]}`,
    "",
    summary[1],
    "",
    audience,
    "",
    "## Pricing",
    "",
    ...pricing.flatMap((line) => [line, ""]),
    privacy,
    "",
    "## Key pages",
    "",
    ...keyPages.map((page) => `- [${page.label}](${page.url}): ${page.note}`),
    "",
    "## Guides",
    "",
    ...guides.map((guide) => `- [${guide.h1 ?? guide.title}](${site}/guides/${guide.slug}): ${guide.description}`),
    "",
    "## Optional",
    "",
    `- [Full text for language models](${site}/llms-full.txt): the key pages and every guide in plain text`,
    ""
  ];
  return lines.join("\n");
}

export function llmsFullTxt(): string {
  const out: string[] = [
    "# NoSwipe (full text)",
    "",
    `> ${summary[0]}`,
    "",
    summary[1],
    "",
    audience,
    "",
    "## Pricing",
    "",
    ...pricing.flatMap((line) => [line, ""]),
    privacy,
    "",
    "## Frequently asked questions",
    "",
    ...faqs.flatMap((faq) => [`### ${faq.q}`, "", faq.a, ""])
  ];

  for (const page of aiPages) {
    out.push(`## ${page.h1}`, "", `URL: ${site}${page.path}`, "", page.answer, "");
    for (const section of page.sections) {
      out.push(`### ${section.title}`, "", ...section.paragraphs.flatMap((p) => [p, ""]));
      if (section.bullets) out.push(...section.bullets.map((b) => `- ${b}`), "");
    }
    out.push("### FAQ", "", ...page.faqs.flatMap((faq) => [`**${faq.question}**`, "", faq.answer, ""]));
  }

  for (const guide of guides) {
    out.push(`## ${guide.h1 ?? guide.title}`, "", `URL: ${site}/guides/${guide.slug}`, "", guide.intro, "");
    for (const section of guide.sections) {
      out.push(`### ${section.title}`, "", ...section.paragraphs.flatMap((p) => [p, ""]));
      if (section.bullets) out.push(...section.bullets.map((b) => `- ${b}`), "");
      if (section.example) out.push(`${section.example.label}: ${section.example.text}`, "");
    }
    out.push("### Checklist", "", ...guide.checklist.map((item) => `- ${item}`), "");
    out.push("### FAQ", "", ...guide.faqs.flatMap((faq) => [`**${faq.question}**`, "", faq.answer, ""]));
  }

  return out.join("\n");
}
