export type AiPageSection = { title: string; paragraphs: string[]; bullets?: string[] };

export type AiPage = {
  path: string;
  metaTitle: string;
  h1: string;
  eyebrow: string;
  description: string;
  /** Direct answer. Exactly two sentences; it is also the first thing on the page. */
  answer: string;
  publishedIso: string;
  sections: AiPageSection[];
  faqs: { question: string; answer: string }[];
  related: { href: string; label: string }[];
};

export const aiPages: AiPage[] = [
  {
    path: "/ai-dating-assistant",
    metaTitle: "AI Dating Assistant: What It Is and How It Works",
    h1: "What is an AI dating assistant?",
    eyebrow: "AI dating assistant",
    description: "An AI dating assistant drafts your profile, openers and replies from what you share. You send everything. What it does, what it cannot, how NoSwipe fits.",
    answer: "An AI dating assistant is a tool that drafts your dating profile, first messages and replies from the photos or screenshots you share, while you stay in charge of your account and send every message yourself. The safe kind never logs in to Tinder, Hinge or Bumble, never swipes and never sends anything for you.",
    publishedIso: "2026-10-30",
    sections: [
      {
        title: "What an AI dating assistant does",
        paragraphs: [
          "Most of the work in online dating is writing: a bio, prompt answers, an opener that is better than “hey”, a reply that keeps a conversation moving, an invitation that is easy to say yes to. An AI dating assistant helps with that writing and with the choices around it, such as which photo goes first.",
          "It works from context you provide, usually screenshots of your own profile or of a conversation. It gives you drafts and suggestions. You decide what to change and what to send."
        ],
        bullets: [
          "Reviews your photos and suggests an order",
          "Drafts or rewrites your bio and prompt answers in your voice",
          "Suggests openers based on a match's profile",
          "Drafts replies and ways to suggest a plan",
          "Helps plan a first date and word the invitation"
        ]
      },
      {
        title: "What it should not do",
        paragraphs: [
          "Be careful with any tool that asks for your dating-app password, swipes for you or sends messages from your account. Dating apps write rules against bots and third-party automation, and an account can be restricted or banned. A drafting assistant avoids the whole problem by never touching the account.",
          "No assistant can guarantee matches, replies or dates. Anyone promising a number is guessing. The honest claim is smaller: clearer profiles and better-written messages, which you still have to send and follow through on."
        ]
      },
      {
        title: "How NoSwipe works",
        paragraphs: [
          "NoSwipe is a screenshot-based dating assistant built mainly for men who date on Tinder, Hinge and Bumble. You choose what to share. NoSwipe prepares profile suggestions, openers, replies and date plans. You make the profile changes, send the messages and confirm the dates yourself.",
          "NoSwipe does not log in to your apps, swipe, like profiles, send messages or book dates. Screenshots are used only to prepare your drafts, are deleted after drafting and are never used to train AI models. NoSwipe is in early access, so the screenshot service opens to people as places become available; the privacy note explains the details."
        ]
      },
      {
        title: "Price",
        paragraphs: [
          "NoSwipe is in early access. Today the site takes a one-time, refundable USD 1 early-access payment, and the terms say it does not start a service. You see the exact price on the checkout screen before you pay, and prices for any ongoing service will be shown to you before you decide to join it."
        ]
      }
    ],
    faqs: [
      { question: "What is an AI dating assistant?", answer: "It is a tool that drafts dating profile copy, openers, replies and date plans from the context you share. You send everything and keep control of your accounts." },
      { question: "Is an AI dating assistant the same as a swipe bot?", answer: "No. A swipe bot logs in to your account and acts for you, which the apps' terms are written against. A drafting assistant only produces text and suggestions for you to use." },
      { question: "Does NoSwipe log in to my Tinder, Hinge or Bumble account?", answer: "No. NoSwipe works from screenshots you choose to share. It does not log in, swipe, like, send messages or confirm dates." },
      { question: "Can an AI dating assistant promise matches or dates?", answer: "No. It can improve how clearly your profile and messages read, but it cannot control whether someone replies or agrees to meet." },
      { question: "How much does NoSwipe cost?", answer: "During early access the site takes a one-time refundable USD 1 payment that does not start a service. You see the exact price at checkout before paying." }
    ],
    related: [
      { href: "/best-ai-dating-assistant-2026", label: "Best AI dating assistant 2026: what to look for" },
      { href: "/ai-dating-apps-vs-dating-coaches", label: "AI dating apps vs dating coaches: what actually helps" },
      { href: "/guides/do-ai-dating-assistants-work", label: "Do AI dating assistants actually work?" }
    ]
  },
  {
    path: "/best-ai-dating-assistant-2026",
    metaTitle: "Best AI Dating Assistant 2026: What to Look For",
    h1: "Best AI dating assistant 2026: what to look for",
    eyebrow: "Buyer's checklist",
    description: "The best AI dating assistant in 2026 never touches your account, keeps your voice, is honest about results and clear on privacy and price. A checklist.",
    answer: "The best AI dating assistant in 2026 is one that only drafts, so it never logs in to your dating apps, swipes or sends for you, and it keeps your voice and your photos real. Check five things before you pay: account safety, voice, privacy, honest claims and a clear price.",
    publishedIso: "2026-10-30",
    sections: [
      {
        title: "1. It never touches your account",
        paragraphs: [
          "Ask one question: does the tool need my dating-app login? If yes, walk away. Tinder, Hinge and Bumble all have terms aimed at bots and third-party automation, and the risk of a restricted or banned account sits with you, not the tool.",
          "A screenshot-based assistant avoids this. It reads what you show it and returns text."
        ]
      },
      {
        title: "2. The messages still sound like you",
        paragraphs: [
          "A draft you would never say out loud is a liability on a first date. Look for a tool that asks about you, uses details from the other person's profile and gives you something to edit, not a pasted pickup line.",
          "Test it: read three drafts aloud. If you would wince, the tool is not matching your voice."
        ]
      },
      {
        title: "3. It is clear about screenshots and privacy",
        paragraphs: [
          "A dating screenshot includes another person who never agreed to be shared. Ask how long the tool keeps screenshots, whether they are used for training and whether you can delete them. Blur or crop names, faces, phone numbers and locations first."
        ],
        bullets: [
          "Stated retention: how long, and where",
          "A plain answer on training use",
          "A way to ask for deletion",
          "No requirement to share more than you choose"
        ]
      },
      {
        title: "4. It does not promise outcomes",
        paragraphs: [
          "Be wary of promised match counts, “X times more dates” and invented reviews. Nobody controls whether another person replies. A trustworthy tool promises better drafts and better-organised profiles, and says what it cannot do."
        ]
      },
      {
        title: "5. The price is clear before you pay",
        paragraphs: [
          "You should see the exact price, what it covers and how to get a refund before you enter card details. Watch for trial-to-subscription flows that hide the renewal.",
          "NoSwipe, for reference, is built to this checklist: it drafts only, you send everything, and the exact price is shown at checkout before you pay. In early access the site takes a one-time refundable USD 1 payment that does not start a service. Judge any tool, ours included, against the same five points."
        ]
      }
    ],
    faqs: [
      { question: "What should I look for in an AI dating assistant?", answer: "Look for a tool that never needs your dating-app login, keeps your voice, explains how it handles screenshots, avoids outcome promises and shows the exact price before you pay." },
      { question: "Is it safe to give an AI dating assistant my login?", answer: "It is the main thing to avoid. Dating-app terms are written against bots and third-party automation, so a tool acting inside your account puts the account at risk." },
      { question: "Should I share screenshots with an AI tool?", answer: "Only if you are comfortable with its retention and privacy terms. Blur or crop other people's names, faces, phone numbers and locations first." },
      { question: "Can an AI dating assistant promise more matches?", answer: "No. Matches depend on other people. Treat any promised result as a warning sign." },
      { question: "Is NoSwipe the best AI dating assistant?", answer: "That is for you to judge. NoSwipe is built to the checklist on this page: drafts only, you send everything, no account access and a price shown before you pay." }
    ],
    related: [
      { href: "/ai-dating-assistant", label: "What is an AI dating assistant?" },
      { href: "/guides/dating-screenshot-privacy", label: "What to blur before sharing dating screenshots" },
      { href: "/guides/dating-app-swipe-bots-banned", label: "Can you get banned for using a swipe bot?" }
    ]
  },
  {
    path: "/ai-dating-apps-vs-dating-coaches",
    metaTitle: "AI Dating Apps vs Dating Coaches: What Helps",
    h1: "AI dating apps vs dating coaches: what actually helps",
    eyebrow: "Comparison",
    description: "AI dating assistants and dating coaches help in different ways. Where each works, where each falls short, and how to choose without fake promises.",
    answer: "An AI dating assistant helps most with the writing and the quick decisions, such as your bio, your openers and your replies, while a dating coach helps most with habits, confidence and accountability over time. Neither can guarantee matches or dates, so pick the one that fits the problem you actually have.",
    publishedIso: "2026-10-30",
    sections: [
      {
        title: "What an AI dating assistant is good at",
        paragraphs: [
          "An assistant is there at the moment you are stuck: a match just replied and you do not know what to say, or your bio reads flat. It turns the context you share into drafts within minutes and is usually cheaper than ongoing human coaching.",
          "Its limits are real. It has not met you, cannot see how you come across in person and cannot hold you accountable. You still send every message and show up to every date."
        ],
        bullets: [
          "Profile and photo suggestions from screenshots",
          "Opener and reply drafts in your voice",
          "Date-plan and invitation wording",
          "Available when the conversation is happening"
        ]
      },
      {
        title: "What a dating coach is good at",
        paragraphs: [
          "A coach works on you, not just your text. Good coaching covers how you approach dating, how you handle rejection, how you come across in conversation and what you do between apps and dates. A person can notice patterns across weeks that a one-off draft cannot.",
          "The trade-offs are cost, scheduling and quality. Coaching is unregulated, so check what a coach actually offers, avoid anyone promising a result and ask what happens if it is not a fit."
        ],
        bullets: [
          "Confidence, mindset and in-person skills",
          "Honest feedback from a real person",
          "Accountability over several weeks",
          "Help with patterns, not only single messages"
        ]
      },
      {
        title: "How to choose",
        paragraphs: [
          "If your problem is words and presentation (a weak profile, stalled conversations, awkward invitations), start with an assistant. If your problem is confidence, anxiety, or what happens once you are in the room, a coach or a trusted friend will help more.",
          "Many people use both: a coach for the long game and an assistant for the daily drafting. What matters is the shared rule. Whoever or whatever helps, you send the messages and you go on the date."
        ]
      },
      {
        title: "Where NoSwipe fits",
        paragraphs: [
          "NoSwipe is an assistant, not a coach. It drafts profiles, openers, replies and date plans from screenshots you share, never logs in to your dating apps and never sends for you. It does not replace human coaching, and it does not promise matches or dates."
        ]
      }
    ],
    faqs: [
      { question: "Is an AI dating assistant better than a dating coach?", answer: "Neither is better overall. An assistant is faster for drafting profiles and messages; a coach is better for confidence, habits and accountability." },
      { question: "Can AI replace a dating coach?", answer: "Not fully. AI can draft and suggest, but it cannot observe you in person or hold you accountable over time." },
      { question: "Do dating coaches promise results?", answer: "They should not. Be cautious of any coach or tool that promises matches or dates." },
      { question: "Can I use an AI dating assistant and a coach together?", answer: "Yes. Many people use a coach for the bigger picture and an assistant for day-to-day drafting. You still send your own messages." },
      { question: "Does NoSwipe act as a dating coach?", answer: "No. NoSwipe drafts profile suggestions, openers, replies and date plans from screenshots you share. You send everything yourself." }
    ],
    related: [
      { href: "/ai-dating-assistant", label: "What is an AI dating assistant?" },
      { href: "/best-ai-dating-assistant-2026", label: "Best AI dating assistant 2026: what to look for" },
      { href: "/guides/ai-dating-messages-ok", label: "Is it OK to use AI to write dating messages?" }
    ]
  }
];

export function getAiPage(path: string): AiPage {
  const page = aiPages.find((item) => item.path === path);
  if (!page) throw new Error(`Unknown AI page ${path}`);
  return page;
}
