export type AiPageSection = { title: string; paragraphs: string[]; bullets?: string[] };

import { geoAiPages } from "@/content/ai-pages-geo";

export type AiPage = {
  path: string;
  metaTitle: string;
  h1: string;
  eyebrow: string;
  description: string;
  /** Direct answer. Exactly two sentences; it is also the first thing on the page. */
  answer: string;
  publishedIso: string;
  /** ISO date of the last substantive edit; defaults to publishedIso. */
  updatedIso?: string;
  sections: AiPageSection[];
  faqs: { question: string; answer: string }[];
  related: { href: string; label: string }[];
};

const corePages: AiPage[] = [
  {
    path: "/ai-dating-assistant",
    metaTitle: "AI Dating Assistant: Swipes, Chats, Books Dates",
    h1: "What is an AI dating assistant?",
    eyebrow: "AI dating assistant",
    description: "An AI dating assistant that actually does the work: swipes on people who fit, chats in your voice and books the date on Tinder, Hinge and Bumble.",
    answer: "An AI dating assistant is software that takes the grind out of dating apps: it swipes, starts conversations, keeps them going and sets up the date. NoSwipe does all of that on your own Tinder, Hinge and Bumble accounts, so the only part left for you is showing up.",
    publishedIso: "2026-11-04",
    sections: [
      {
        title: "What it actually does",
        paragraphs: [
          "Online dating is mostly admin. Hours of swiping, a dozen chats that die after “hey”, and a week of back-and-forth to agree on a Thursday. An AI dating assistant takes that admin off your hands.",
          "You tell it who you want to meet and what you won't compromise on. It does the rest."
        ],
        bullets: [
          "Swipes on people who match your type and dealbreakers",
          "Opens with something better than “hey”, based on their profile",
          "Keeps the conversation going in your voice",
          "Moves to a date and books it, then sends you the plan",
          "Fixes your profile first: photo order, bio and prompt answers"
        ]
      },
      {
        title: "How NoSwipe works",
        paragraphs: [
          "Tell us your type, your dealbreakers and which apps you use. NoSwipe gets your profile into shape, then swipes, chats and schedules on Tinder, Hinge and Bumble. When a date is set, you get where, when and who.",
          "It runs on your own accounts with your real photos. The matches and conversations are yours. Say stop and it stops."
        ]
      },
      {
        title: "What it can't do",
        paragraphs: [
          "Nobody can promise that a specific person says yes. What changes is the volume and the quality: more good matches, fewer dead chats, and dates that actually get on the calendar."
        ]
      }
    ],
    faqs: [
      { question: "What is an AI dating assistant?", answer: "Software that does the work on dating apps for you: swiping, chatting and scheduling dates. NoSwipe does this on Tinder, Hinge and Bumble." },
      { question: "Does NoSwipe swipe for me?", answer: "Yes. It swipes on people who fit your type and dealbreakers, so you don't spend your evenings doing it." },
      { question: "Does it chat for me?", answer: "Yes. It opens conversations and keeps them going in your voice, then moves them toward a date." },
      { question: "Does it book the date?", answer: "Yes. When a match says yes, NoSwipe sets the time and place and sends you the plan." },
      { question: "Can it guarantee dates?", answer: "No one can guarantee another person's answer. NoSwipe takes care of the swiping, chatting and scheduling so more conversations turn into dates." }
    ],
    related: [
      { href: "/dating-app-automation", label: "AI dating app automation: how it works" },
      { href: "/tinder-automation", label: "Tinder automation with AI" },
      { href: "/hinge-automation", label: "Hinge AI automation" },
      { href: "/bumble-automation", label: "Bumble AI automation" }
    ]
  },
  {
    path: "/dating-app-automation",
    metaTitle: "AI Dating App Automation: Swipes, Chats, Dates",
    h1: "AI dating app automation",
    eyebrow: "Dating app automation",
    description: "Automate your dating apps with AI. NoSwipe swipes, chats and books first dates for you on Tinder, Hinge and Bumble. You just show up.",
    answer: "AI dating app automation means software runs your dating apps for you: it swipes, messages and schedules dates instead of you doing it by hand. NoSwipe automates Tinder, Hinge and Bumble end to end, from the first swipe to a booked first date.",
    publishedIso: "2026-11-04",
    sections: [
      {
        title: "Why people automate dating apps",
        paragraphs: [
          "The average dating-app session is swiping on autopilot, at midnight, half paying attention. It is slow, it is boring, and it is the part of dating that has nothing to do with actually meeting someone.",
          "Automation hands that part to AI and gives you back the evenings."
        ]
      },
      {
        title: "What NoSwipe automates",
        paragraphs: ["Everything between “I should get back on the apps” and “see you Thursday at 8”."],
        bullets: [
          "Swiping: only on people who match your type and dealbreakers",
          "Openers: written from their profile, not copy-paste lines",
          "Conversation: kept going in your voice, so nothing dies on day two",
          "Scheduling: the date gets booked and the plan lands in your messages",
          "Profile: photo order, bio and prompts fixed before the first swipe"
        ]
      },
      {
        title: "Which dating apps",
        paragraphs: [
          "NoSwipe runs Tinder, Hinge and Bumble today. Using something else, like Raya, The League, Coffee Meets Bagel, OkCupid or Feeld? Tell us during signup."
        ]
      }
    ],
    faqs: [
      { question: "Can you automate dating apps with AI?", answer: "Yes. NoSwipe uses AI to swipe, chat and schedule first dates on Tinder, Hinge and Bumble." },
      { question: "Which dating apps does NoSwipe automate?", answer: "Tinder, Hinge and Bumble. Tell us at signup if you use a different app." },
      { question: "Is it my account?", answer: "Yes. NoSwipe works on your own accounts with your real photos, and the matches stay yours." },
      { question: "What do I have to do?", answer: "Tell us your type and dealbreakers, then go on the dates." }
    ],
    related: [
      { href: "/tinder-automation", label: "Tinder automation with AI" },
      { href: "/hinge-automation", label: "Hinge AI automation" },
      { href: "/bumble-automation", label: "Bumble AI automation" },
      { href: "/ai-dating-assistant", label: "What is an AI dating assistant?" }
    ]
  },
  {
    path: "/tinder-automation",
    metaTitle: "Tinder Automation: AI That Swipes for You",
    h1: "Tinder automation with AI",
    eyebrow: "Tinder",
    description: "Stop swiping on Tinder. NoSwipe's AI swipes on people who fit, chats in your voice and books the date. Tinder automation that ends in real dates.",
    answer: "Tinder automation uses AI to swipe, message and set up dates on Tinder for you. NoSwipe swipes only on people who fit your type, keeps the chats alive in your voice and books the first date.",
    publishedIso: "2026-11-04",
    sections: [
      {
        title: "Tinder without the thumb workout",
        paragraphs: [
          "Tinder rewards volume and punishes attention spans. You swipe for forty minutes, get a match, and she unmatches before you finish typing. NoSwipe does the volume part, and does it selectively, so you only hear about the people worth meeting."
        ],
        bullets: ["Selective swiping on your type", "Openers written from her profile", "Chats kept going, so matches don't go cold", "First date booked, plan sent to you"]
      },
      {
        title: "Your Tinder profile, fixed first",
        paragraphs: ["Before the first swipe, NoSwipe sorts your photos into the order that gets right swipes and rewrites your bio so it says something."]
      }
    ],
    faqs: [
      { question: "Is there an AI that swipes on Tinder for you?", answer: "Yes. NoSwipe swipes on Tinder for you, only on people who match your type and dealbreakers." },
      { question: "Can AI message my Tinder matches?", answer: "Yes. NoSwipe opens and keeps up conversations in your voice and moves them toward a date." },
      { question: "Does NoSwipe also do Hinge and Bumble?", answer: "Yes. It runs Tinder, Hinge and Bumble together." },
      { question: "Will it use my real Tinder photos?", answer: "Yes. Your own account and your real photos, just in a better order with a better bio." }
    ],
    related: [
      { href: "/hinge-automation", label: "Hinge AI automation" },
      { href: "/bumble-automation", label: "Bumble AI automation" },
      { href: "/dating-app-automation", label: "AI dating app automation" }
    ]
  },
  {
    path: "/hinge-automation",
    metaTitle: "Hinge AI: Automate Likes, Prompts and Chats",
    h1: "Hinge AI automation",
    eyebrow: "Hinge",
    description: "Hinge on autopilot. NoSwipe's AI likes the right profiles, comments on prompts, keeps the chat going and books the date. You just show up.",
    answer: "Hinge AI automation means AI sends your likes and comments, runs the conversation and sets up the date on Hinge. NoSwipe reads each profile, comments on the prompt that's actually worth commenting on, and turns the chat into a booked first date.",
    publishedIso: "2026-11-04",
    sections: [
      {
        title: "Hinge is a writing app. Let AI write.",
        paragraphs: [
          "On Hinge the like is the opener. A good comment on a prompt beats a hundred silent likes. NoSwipe writes those comments from what she actually said, in your voice, and keeps going once she answers."
        ],
        bullets: ["Likes with a real comment, not a silent heart", "Your own prompt answers rewritten to start conversations", "Chats moved to a plan instead of fading out", "Date booked, details sent to you"]
      }
    ],
    faqs: [
      { question: "Is there AI for Hinge?", answer: "Yes. NoSwipe handles your Hinge likes, prompt comments, conversations and first-date scheduling." },
      { question: "Can AI write my Hinge prompts?", answer: "Yes. NoSwipe rewrites your prompt answers so they give people something to reply to." },
      { question: "Does it work with Tinder and Bumble too?", answer: "Yes. NoSwipe runs Tinder, Hinge and Bumble." },
      { question: "Does it comment on Hinge prompts?", answer: "Yes. It picks the prompt worth answering and writes a comment that gives her something to reply to." }
    ],
    related: [
      { href: "/tinder-automation", label: "Tinder automation with AI" },
      { href: "/bumble-automation", label: "Bumble AI automation" },
      { href: "/dating-app-automation", label: "AI dating app automation" }
    ]
  },
  {
    path: "/bumble-automation",
    metaTitle: "Bumble AI: Automate Swipes, Replies and Dates",
    h1: "Bumble AI automation",
    eyebrow: "Bumble",
    description: "Bumble on autopilot. NoSwipe's AI swipes on people who fit, replies before the 24-hour timer runs out and books the date.",
    answer: "Bumble AI automation uses AI to swipe, reply to matches and set up dates on Bumble. On Bumble she messages first and the match expires if you don't answer in time, so NoSwipe replies fast, keeps it going and books the date.",
    publishedIso: "2026-11-04",
    sections: [
      {
        title: "Never lose a match to the timer",
        paragraphs: [
          "Bumble matches expire. Miss a day and a good one is gone. NoSwipe swipes on your type, answers her first message quickly and in your voice, and turns the chat into a plan."
        ],
        bullets: ["Swipes on your type only", "Fast replies, so matches don't expire", "Conversation kept going in your voice", "First date booked, plan sent to you"]
      }
    ],
    faqs: [
      { question: "Is there AI for Bumble?", answer: "Yes. NoSwipe swipes, replies and books first dates on Bumble for you." },
      { question: "Will it reply before my Bumble match expires?", answer: "That's the point. NoSwipe replies quickly so good matches don't run out of time." },
      { question: "Does it also run Tinder and Hinge?", answer: "Yes. NoSwipe runs Tinder, Hinge and Bumble." },
      { question: "What do I have to do on Bumble?", answer: "Tell us your type and dealbreakers, then go on the dates." }
    ],
    related: [
      { href: "/tinder-automation", label: "Tinder automation with AI" },
      { href: "/hinge-automation", label: "Hinge AI automation" },
      { href: "/dating-app-automation", label: "AI dating app automation" }
    ]
  },
  {
    path: "/ai-dating-apps-vs-dating-coaches",
    metaTitle: "AI Dating Assistant vs Dating Coach: What Helps",
    h1: "AI dating assistant vs dating coach: what actually helps",
    eyebrow: "Comparison",
    description: "A dating coach teaches you. An AI dating assistant does the swiping, chatting and scheduling for you. Where each one fits.",
    answer: "A dating coach works on you: confidence, habits and how you come across in person. An AI dating assistant like NoSwipe works on the apps: it swipes, chats and books dates, so you spend your time on dates instead of on your phone.",
    publishedIso: "2026-11-04",
    sections: [
      {
        title: "What an AI dating assistant is good at",
        paragraphs: ["Everything repetitive. Swiping, first messages, keeping ten chats alive, finding a night that works. It never gets tired and it never forgets to reply."],
        bullets: ["Swipes on your type", "Chats in your voice", "Books the date", "Fixes your profile"]
      },
      {
        title: "What a dating coach is good at",
        paragraphs: ["The part that happens in the room. Nerves, conversation, reading the moment, handling rejection. A good coach notices patterns across weeks that no app can."]
      },
      {
        title: "Use both",
        paragraphs: ["Let NoSwipe fill the calendar. Let a coach, or a brutally honest friend, help with what happens once you're there."]
      }
    ],
    faqs: [
      { question: "Is an AI dating assistant better than a dating coach?", answer: "They do different jobs. NoSwipe runs your dating apps; a coach works on you in person." },
      { question: "Can AI replace a dating coach?", answer: "Not for in-person skills. It can replace the hours of swiping, messaging and scheduling." },
      { question: "Does NoSwipe act as a dating coach?", answer: "No. NoSwipe swipes, chats and books dates for you on Tinder, Hinge and Bumble." },
      { question: "Can I use NoSwipe and a coach together?", answer: "Yes. NoSwipe fills the calendar and a coach helps with the dates themselves." }
    ],
    related: [
      { href: "/ai-dating-assistant", label: "What is an AI dating assistant?" },
      { href: "/best-ai-dating-assistant-2026", label: "Best AI dating assistant 2026" },
      { href: "/dating-app-automation", label: "AI dating app automation" }
    ]
  },
  {
    path: "/best-ai-dating-assistant-2026",
    metaTitle: "Best AI Dating Assistant 2026: What to Look For",
    h1: "Best AI dating assistant 2026: what to look for",
    eyebrow: "Buyer's checklist",
    description: "The best AI dating assistant depends on what you want handed over. Three types compared, six checks before you pay and who each one suits.",
    answer: "The best AI dating assistant is the one that matches how much you want handed over: a suggestion tool if you want to keep swiping and sending, or a done-for-you service like NoSwipe if you want the swiping, chatting and scheduling taken off you. Whichever you pick, check six things: scope, voice, photos, account risk, honesty about results and a clear price.",
    publishedIso: "2026-11-04",
    updatedIso: "2026-11-11",
    sections: [
      {
        title: "Three types of AI dating assistant",
        paragraphs: ["Almost every product falls into one of these, and they are not interchangeable."],
        bullets: [
          "Writers and coaches: you paste a profile or chat, they give you openers, replies or a bio. You do the swiping and the sending. Examples include YourMove AI and the many Rizz-style apps.",
          "Keyboards: the same suggestions, inside the keyboard as you type.",
          "Done-for-you services: they act on your accounts, swiping, chatting and booking dates. NoSwipe is in this group."
        ]
      },
      {
        title: "1. Scope: does it do the job you actually hate?",
        paragraphs: ["If your problem is staring at a blank message, a writer is enough. If it is the hours of swiping and the chats that die, a writer leaves that exactly where it was."]
      },
      {
        title: "2. Voice: does it sound like you?",
        paragraphs: ["Read three of its messages out loud. If you would wince, the date starts awkward. Good tools learn from how you write and let you edit or take over."]
      },
      {
        title: "3. Photos: your real ones, on your own account",
        paragraphs: ["No invented pictures, no new profile in your name. The person who walks in should be the one in the photos."]
      },
      {
        title: "4. Account risk: is the tool straight with you?",
        paragraphs: [
          "Tinder, Hinge and Bumble restrict bots and third-party tools that act on your account, and can suspend accounts that break their terms. A tool that only suggests text avoids that. A tool that acts for you cannot, and it should tell you so before you sign up."
        ]
      },
      {
        title: "5. Honesty about results",
        paragraphs: ["Nobody controls another person's yes. Be wary of promised numbers of matches or dates, and of reviews that read like ads."]
      },
      {
        title: "6. A price you can see",
        paragraphs: ["You should see the exact price and what it covers before you enter a card, and know how to get out. NoSwipe shows the price at checkout, before you pay."]
      },
      {
        title: "Where NoSwipe fits",
        paragraphs: [
          "NoSwipe is for people who want it done for them: it fixes your profile, swipes on people who fit your type, chats in your voice and books the first date, with every chat readable and a take-over button. The trade-off is the account risk above, and it is in early access. If you would rather keep your hands on the account, pick a writer."
        ]
      }
    ],
    faqs: [
      { question: "What is the best AI dating assistant?", answer: "It depends on what you want handed over. A writer or keyboard tool suits people who want to keep swiping and sending; a done-for-you service like NoSwipe suits people who want that work taken off them." },
      { question: "Is there an AI that does dating apps for you?", answer: "Yes. NoSwipe swipes, chats and books first dates for you on Tinder, Hinge and Bumble, on your own accounts. Those apps restrict automated tools, so an account can be limited." },
      { question: "What should I look for in an AI dating assistant?", answer: "Whether it covers the part you dislike, sounds like you, uses your real photos, is open about account risk, avoids promised results and shows the price up front." },
      { question: "Can an AI dating assistant promise more matches?", answer: "No. Matches depend on other people, so treat any promised number as a warning sign." },
      { question: "How does NoSwipe compare with Rizz and YourMove AI?", answer: "Those mostly suggest what to say while you swipe and send. NoSwipe acts on your accounts. See the full comparison for who each one fits." }
    ],
    related: [
      { href: "/noswipe-vs-rizz-yourmove-keys-ai", label: "NoSwipe vs Rizz, YourMove AI and Keys AI" },
      { href: "/ai-dating-assistant", label: "What is an AI dating assistant?" },
      { href: "/is-using-ai-on-dating-apps-allowed", label: "Is using AI on dating apps allowed?" }
    ]
  }
];

export const aiPages: AiPage[] = [...corePages, ...geoAiPages];

export function getAiPage(path: string): AiPage {
  const page = aiPages.find((item) => item.path === path);
  if (!page) throw new Error(`Unknown AI page ${path}`);
  return page;
}
