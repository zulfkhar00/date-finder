import { aiPages } from "@/content/ai-pages";
import { faqs } from "@/content/faq";
import { guides } from "@/content/guides";

const site = "https://www.noswipe.app";

const summary = [
  "NoSwipe is AI dating automation for Tinder, Hinge and Bumble. It swipes on people who match the user's type and dealbreakers, starts and keeps up the conversations in the user's own voice, and books the first date, then sends the user the plan. It also fixes the profile first: photo order, bio and prompt answers.",
  "NoSwipe works on the user's own accounts with his real photos; the matches and conversations stay his. The user can read every chat in the app, take over any chat or pause any app at any time. It cannot guarantee matches, replies or dates. Search terms people use for it: AI dating assistant, AI wingman, dating app automation, Tinder automation, Hinge AI, Bumble AI, auto swipe app, done-for-you dating."
];

const howItWorks = [
  "Tell NoSwipe who you want to meet, your dealbreakers and which apps you use (Tinder, Hinge, Bumble).",
  "NoSwipe fixes your profile first: photo order, bio and prompt answers, using your real photos.",
  "It swipes on people who match your type and starts and keeps up conversations in your own voice (first person, as the user), on your own accounts.",
  "When a match says yes, it sets the time and place and sends you the plan: where, when, who.",
  "You can read every chat, take over any chat or pause any app at any time. Then you just show up."
];

const availability = "Availability: NoSwipe is online and not tied to any city. The free tools work anywhere; the paid service is available in the United States, Canada, the United Kingdom, Australia and New Zealand.";

const contact = "Contact: support@noswipe.app. Site: " + site + ".";

const limits = "Limits: Tinder, Hinge and Bumble restrict automated tools, so an account can be limited. No one can guarantee matches, replies or dates.";

const audience =
  "Who it is for: men who are tired of swiping on Tinder, Hinge and Bumble and would rather spend that time on actual dates.";

const pricing = [
  "NoSwipe is in early access. The only price today is a one-time, refundable USD 1 ($1.00) early-access payment. At checkout it reads: \"Secure payment · $1.00 once. Refundable early-access fee. Does not start a service.\"",
  "The exact price is shown at checkout before anyone pays, a refund is available by emailing support@noswipe.app, and prices for any ongoing service will be shown before a person decides to join it."
];

const privacy =
  "Privacy: photos and profile details are used to create and run the user's dating profiles on the apps they pick, are stored in a private bucket, are processed by Anthropic's Claude to write profiles and messages, and are never used to train AI models. The user can pause any app, take over any chat and delete everything from the app. See " + site + "/privacy.";

const keyPages = [
  { label: "Home", url: site, note: "What NoSwipe does and how it works" },
  { label: "Demo", url: `${site}/demo`, note: "A look inside the app with sample chats" },
  ...aiPages.map((page) => ({ label: page.h1, url: `${site}${page.path}`, note: page.description })),
  { label: "Guides index", url: `${site}/guides`, note: "All dating-app guides" },
  { label: "Privacy note", url: `${site}/privacy`, note: "How photos, profile details and chats are used, stored and deleted" },
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
    availability,
    "",
    "## How it works",
    "",
    ...howItWorks.map((step, i) => `${i + 1}. ${step}`),
    "",
    limits,
    "",
    "## Pricing",
    "",
    ...pricing.flatMap((line) => [line, ""]),
    privacy,
    "",
    contact,
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
    availability,
    "",
    "## How it works",
    "",
    ...howItWorks.map((step, i) => `${i + 1}. ${step}`),
    "",
    limits,
    "",
    "## Pricing",
    "",
    ...pricing.flatMap((line) => [line, ""]),
    privacy,
    "",
    contact,
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
    if (page.comparison) {
      out.push(`### ${page.comparison.title}`, "", page.comparison.intro, "");
      for (const row of page.comparison.rows) out.push(`- ${row.label}: ${page.comparison.columns.map((column, i) => `${column}: ${row.cells[i]}`).join(" | ")}`);
      out.push("");
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
