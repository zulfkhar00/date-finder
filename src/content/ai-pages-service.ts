import type { AiPage } from "@/content/ai-pages";

const published = "2026-11-23";

/** The offer, said the same way on every page so the facts never drift. */
const offer =
  "We create your dating profiles from your real photos and details, then run them for you: swiping, chats in your voice and booking the date, with your permission. You just show up.";
const control =
  "You can read every chat, take over any chat or pause any app at any time, and you can tell us to stop.";
const risk =
  "Tinder, Hinge and Bumble restrict automated tools, so an account can be limited, which the terms spell out. Nobody can promise matches, replies or dates.";
const availability =
  "The free tools work anywhere. The paid service is available in the United States, Canada, the United Kingdom, Australia and New Zealand, and the pricing page shows exactly what is charged before you pay.";

const faqAvailability = { question: "Is it available where I live?", answer: availability };
const faqPrivacy = {
  question: "What happens to my photos and messages?",
  answer: "They are used to create and run your profiles, and we do not use them to train AI models. You can delete your account in Profile, which removes your photos, matches and messages from NoSwipe. The privacy page has the details."
};
const faqConsent = {
  question: "Is it only my own account, and does it need my consent?",
  answer: "Yes to both. NoSwipe only works on profiles that belong to you, for you, with your explicit consent, and you can withdraw that consent by deleting your account."
};
const faqSafety = {
  question: "What about safety when I meet someone?",
  answer: "Meet in a public place, tell a friend where you are and arrange your own transport. The first-date safety checklist covers the rest, and you confirm every date yourself."
};

const closing = [
  { href: "/pricing", label: "Pricing and where it is available" },
  { href: "/terms", label: "Terms, including dating-app risk" }
];
const privacyLink = { href: "/ai-dating-assistant-privacy", label: "AI dating assistant privacy" };
const safetyLink = { href: "/first-date-safety-from-dating-apps", label: "First date safety checklist" };

/** Twelve high-intent pages for people who want dating apps done for them, one query each. */
export const servicePages: AiPage[] = [
  {
    path: "/someone-to-run-my-dating-apps",
    metaTitle: "Someone to Run My Dating Apps: How It Works",
    h1: "Someone to run my dating apps: how handing them off works",
    eyebrow: "Run my dating apps",
    description: "Want someone to run your dating apps? What you hand over, what you keep and how NoSwipe creates your profiles and runs them while you show up.",
    answer: "Yes, you can hand your dating apps to someone else, and NoSwipe is built for exactly that: we create your profiles and run them for you. You give us your photos, your type and the days you are free, and you just show up to the dates.",
    publishedIso: published,
    steps: [
      "You tell us who you want to meet, your dealbreakers, your tone and when you are free for dates.",
      "We create your profiles on the apps you choose, from your real photos and details, then run them: swiping, chats and booking.",
      "You get the plan for each date: where, when and who. You show up."
    ],
    sections: [
      {
        title: "What “running your apps” means here",
        paragraphs: [
          "Most people who search for this are not lazy. They are tired of a second job made of swiping, small talk and diary-swapping. Handing it off means someone else does that work while the matches stay yours.",
          offer
        ]
      },
      {
        title: "What you give, and what you keep",
        paragraphs: ["Handing off is not handing over your life. The split is simple."],
        bullets: [
          "You give: your real photos, a few facts about you, your type and your dealbreakers",
          "You give: explicit consent for NoSwipe to act on your profiles, and the days you are free",
          "You keep: every decision about who you meet and whether you see them again",
          "You keep: the right to read any chat, take over any chat or pause any app",
          "You keep: the date itself, which is the only part nobody can do for you"
        ]
      },
      {
        title: "What to check before you hand anything over",
        paragraphs: [
          "Ask any service the same five questions: whose account it is, whether you can read every message, whether you can stop it in one tap, what happens to your photos, and whether it promises results. Walk away from anyone who promises dates, because nobody controls another person's answer.",
          risk
        ]
      }
    ],
    faqs: [
      { question: "Can someone really run my dating apps for me?", answer: "Yes. NoSwipe creates your profiles and runs them for you with your permission, so the only part left for you is the date." },
      { question: "Do I have to give up control?", answer: "No. " + control },
      faqConsent,
      faqPrivacy,
      faqAvailability
    ],
    related: [
      { href: "/hire-someone-to-do-my-dating-apps", label: "Hire someone to do my dating apps" },
      { href: "/dating-app-management-service", label: "Dating app management service" },
      { href: "/dating-app-concierge", label: "What is a dating app concierge?" },
      privacyLink,
      ...closing
    ]
  },
  {
    path: "/dating-app-management-service",
    metaTitle: "Dating App Management Service: What It Covers",
    h1: "Dating app management service: what it covers and what to ask",
    eyebrow: "Management service",
    description: "A dating app management service runs your profiles day to day. What a good one covers, the questions to ask and how NoSwipe answers them.",
    answer: "A dating app management service takes over the day-to-day running of your dating profiles, from setup to chats to scheduling. NoSwipe is one: we create your profiles and run them for you, and you just show up.",
    publishedIso: published,
    steps: [
      "Set-up: you share your preferences, photos and availability once.",
      "Management: we create and run your profiles, keeping chats moving and booking dates.",
      "Oversight: you read, take over or pause whenever you like, and show up to the dates."
    ],
    sections: [
      {
        title: "The scope of a proper service",
        paragraphs: ["Some services only polish a bio. A management service should cover the whole loop, and it should say plainly which parts it does not do."],
        bullets: [
          "Profile creation: photo order, bio and prompt answers from your real details",
          "Day-to-day swiping against your type and dealbreakers",
          "Opening and keeping up conversations in your voice",
          "Scheduling: proposing a time and place and sending you the plan",
          "Housekeeping: refreshing the profile and pausing an app when you ask"
        ]
      },
      {
        title: "Six questions to put to any provider",
        paragraphs: ["Use these to compare a service with NoSwipe or with anyone else."],
        bullets: [
          "Whose account is it, and is it only ever mine?",
          "Can I read every message and take over any chat?",
          "Can I pause or stop it myself, instantly?",
          "What happens to my photos and messages, and are they used to train AI?",
          "Does it promise matches or dates? (A yes is a red flag.)",
          "Is it available where I live, and what exactly is charged before I commit?"
        ]
      },
      {
        title: "Where NoSwipe fits",
        paragraphs: [
          offer,
          control + " " + risk
        ]
      }
    ],
    faqs: [
      { question: "What does a dating app management service do?", answer: "It runs your dating profiles for you day to day: creating them, swiping, chatting and booking dates." },
      { question: "How is this different from a dating coach?", answer: "A coach advises you and you do the work. A management service does the work, which is why you should be able to see and stop all of it." },
      { question: "Can I see what is being sent in my name?", answer: "Yes. You can read every chat and take over any chat at any time." },
      faqPrivacy,
      faqAvailability
    ],
    related: [
      { href: "/someone-to-run-my-dating-apps", label: "Someone to run my dating apps" },
      { href: "/ai-dating-apps-vs-dating-coaches", label: "AI dating apps vs dating coaches" },
      { href: "/dating-app-automation", label: "AI dating app automation: how it works" },
      privacyLink,
      ...closing
    ]
  },
  {
    path: "/tinder-done-for-you",
    metaTitle: "Tinder Done for You: We Run It, You Show Up",
    h1: "Tinder done for you: we create and run your profile",
    eyebrow: "Tinder done for you",
    description: "Tinder done for you: we create your profile from your real photos and run the swiping and chats while you just show up. How it works and the limits.",
    answer: "Tinder done for you means we create your Tinder profile and run it: swiping on people who fit your type, chatting in your voice and booking the date. You create the account and verify yourself, then you just show up.",
    publishedIso: published,
    steps: [
      "You open your own Tinder account and finish any verification Tinder asks of you.",
      "You give us consent, your type and your free days. We build the profile from your real photos.",
      "We run the swiping and chats. You get the plan for each date and show up."
    ],
    sections: [
      {
        title: "Why Tinder is the one people hand off first",
        paragraphs: [
          "Tinder rewards volume and quick replies, and that is the part that eats your evenings. Most matches die in the first two messages, so the admin is repetitive and the payoff is uneven.",
          "That is the profile of a job you can hand off: high effort, low skill, and a clear instruction set in your type and dealbreakers."
        ]
      },
      {
        title: "What stays with you on Tinder",
        paragraphs: ["Tinder may ask you to verify yourself, and an account has to belong to a real person, so setting it up is always yours."],
        bullets: [
          "Creating the account and any verification Tinder asks for",
          "Choosing which photos are used, so they are really you",
          "Saying who you want to meet and what you will not accept",
          "The decision to meet anyone, and the date itself"
        ]
      },
      {
        title: "What we do on Tinder, and the honest risk",
        paragraphs: [
          offer,
          control,
          "Tinder restricts automated tools, so your account can be limited, and that risk is yours to weigh before you start. Nobody can promise matches, replies or dates."
        ]
      }
    ],
    faqs: [
      { question: "Can you run my Tinder for me?", answer: "Yes. You create the account and verify yourself, and with your consent we create your profile and run the swiping, chats and booking." },
      { question: "Does Tinder allow this?", answer: "Tinder restricts automated tools, so an account can be limited or banned. That is a real risk, and the terms and the guide on swipe-bot bans explain it." },
      { question: "Will it message people as me?", answer: "Yes, in your voice, and you can read or take over any chat. Nothing is promised about replies." },
      faqSafety,
      faqAvailability
    ],
    related: [
      { href: "/tinder-automation", label: "Tinder automation with AI" },
      { href: "/guides/dating-app-swipe-bots-banned", label: "Are dating app swipe bots banned?" },
      { href: "/hinge-done-for-you", label: "Hinge done for you" },
      { href: "/bumble-done-for-you", label: "Bumble done for you" },
      safetyLink,
      ...closing
    ]
  },
  {
    path: "/hinge-done-for-you",
    metaTitle: "Hinge Done for You: We Run It, You Show Up",
    h1: "Hinge done for you: prompts, likes and chats handled",
    eyebrow: "Hinge done for you",
    description: "Hinge done for you: we write your prompts from your real details, pick who to like and chat in your voice while you just show up. How it works.",
    answer: "Hinge done for you means we create your Hinge profile, prompts included, and run it: choosing who to like, commenting, chatting and booking the date. You make the account yourself, then you just show up.",
    publishedIso: published,
    steps: [
      "You create your own Hinge account and give us consent, your type and your free days.",
      "We write your prompt answers and order your photos from your real details.",
      "We run likes and chats. You get the plan for each date and show up."
    ],
    sections: [
      {
        title: "Why Hinge profiles are harder to hand off than they look",
        paragraphs: [
          "Hinge is built on prompts and comments, so a generic profile gets generic likes. The work is specific writing: one real detail per answer and a comment on someone else's prompt that gives them something to reply to.",
          "That is exactly the work most people put off, which is why a half-finished Hinge profile is so common."
        ]
      },
      {
        title: "What we do on Hinge",
        paragraphs: [offer],
        bullets: [
          "Prompt answers written from your real details, not a template",
          "Photo order so the first photo is a clear one",
          "Likes with a comment that refers to something in their profile",
          "Replies that keep the chat moving toward a plan",
          "Hinge limits how many likes you can send, so which ones get spent matters"
        ]
      },
      {
        title: "What you keep, and the risk",
        paragraphs: [
          control,
          "Hinge restricts automated tools, so an account can be limited. Nobody can promise matches, replies or dates."
        ]
      }
    ],
    faqs: [
      { question: "Can you write my Hinge prompts?", answer: "Yes. We write them from your real details and you can read and change anything, because a prompt only works if it sounds like you." },
      { question: "Will it like and message people for me?", answer: "Yes, with your consent, in your voice. You can take over any chat or pause the app at any time." },
      { question: "Does Hinge allow this?", answer: "Hinge restricts automated tools, so an account can be limited. The terms spell this out and the risk is yours to weigh." },
      faqPrivacy,
      faqAvailability
    ],
    related: [
      { href: "/hinge-automation", label: "Hinge AI automation" },
      { href: "/hinge-prompt-answers-for-men", label: "Hinge prompt answers for men" },
      { href: "/tinder-done-for-you", label: "Tinder done for you" },
      { href: "/bumble-done-for-you", label: "Bumble done for you" },
      ...closing
    ]
  },
  {
    path: "/bumble-done-for-you",
    metaTitle: "Bumble Done for You: We Run It, You Show Up",
    h1: "Bumble done for you: first moves and chats handled",
    eyebrow: "Bumble done for you",
    description: "Bumble done for you: we create your profile and handle the first move, the chats and the date plan while you just show up. How it works and the limits.",
    answer: "Bumble done for you means we create your Bumble profile and run it: swiping, sending the first move when it is yours to send, keeping chats alive and booking the date. You create the account, then you just show up.",
    publishedIso: published,
    steps: [
      "You create your own Bumble account and give us consent, your type and your free days.",
      "We build your profile from your real photos and details.",
      "We run swiping and chats before matches expire. You get the plan and show up."
    ],
    sections: [
      {
        title: "Why Bumble punishes slow replies",
        paragraphs: [
          "On Bumble, matches expire if nobody writes, and in a match between a man and a woman the woman sends the first message by default. Either way the clock is the problem: a good match goes cold while you are in a meeting.",
          "Fast, steady attention is the thing that is easiest to hand off."
        ]
      },
      {
        title: "What we do on Bumble",
        paragraphs: [offer],
        bullets: [
          "A bio and prompt answers that give a person one easy thing to reply to",
          "Swiping against your type and dealbreakers",
          "Sending the first message when the first move is yours",
          "Replying quickly so matches do not lapse",
          "Proposing a simple plan after a few good messages"
        ]
      },
      {
        title: "What you keep, and the risk",
        paragraphs: [
          control,
          "Bumble restricts automated tools, so an account can be limited. Nobody can promise matches, replies or dates."
        ]
      }
    ],
    faqs: [
      { question: "Can you handle Bumble for me?", answer: "Yes. You create the account, and with your consent we create your profile and run the swiping, chats and booking." },
      { question: "What if the first move is mine?", answer: "We send it in your voice, and you can read it and take over the chat whenever you like." },
      { question: "Does Bumble allow this?", answer: "Bumble restricts automated tools, so an account can be limited. The terms spell this out and the risk is yours to weigh." },
      faqSafety,
      faqAvailability
    ],
    related: [
      { href: "/bumble-automation", label: "Bumble AI automation" },
      { href: "/bumble-opening-lines", label: "Bumble opening lines that get replies" },
      { href: "/tinder-done-for-you", label: "Tinder done for you" },
      { href: "/hinge-done-for-you", label: "Hinge done for you" },
      ...closing
    ]
  },
  {
    path: "/hire-a-dating-assistant",
    metaTitle: "Hire a Dating Assistant: Human, AI or Both?",
    h1: "Hire a dating assistant: a person, an AI or a coach?",
    eyebrow: "Hire a dating assistant",
    description: "Thinking of hiring a dating assistant? A person, an AI and a coach do different jobs. What each does, what to ask and where NoSwipe fits.",
    answer: "A dating assistant can be a person you hire, an AI service or a coach, and they do different jobs: advise, draft or actually run your profiles. NoSwipe is an AI dating concierge that creates and runs your profiles, so you just show up.",
    publishedIso: published,
    steps: [
      "Decide the job: advice, drafted messages or running the apps for you.",
      "Check the provider on consent, control, privacy and what it charges before you commit.",
      "With NoSwipe, you share your type and free days, and we create and run your profiles."
    ],
    comparison: {
      title: "A dating coach, a message-drafting tool or NoSwipe",
      intro: "All three can help. They differ in who does the daily work and what you still have to do.",
      columns: ["Dating coach", "Message-drafting tool", "NoSwipe"],
      rows: [
        { label: "What you get", cells: ["Advice and feedback on your approach.", "Suggested lines you copy.", "Profiles created and run for you."] },
        { label: "Who sends the messages", cells: ["You.", "You.", "We do, in your voice, with your permission."] },
        { label: "Your daily time", cells: ["Swiping and chatting stay with you.", "Swiping, pasting and sending stay with you.", "Setting preferences, then showing up to dates."] },
        { label: "Your control", cells: ["Full.", "Full.", "Read every chat, take over any chat, pause any app."] },
        { label: "Account risk", cells: ["None from tools.", "None from tools.", "The apps restrict automated tools, so an account can be limited."] },
        { label: "Results", cells: ["Depend on the other person.", "Depend on the other person.", "Depend on the other person. Nobody can promise a date."] }
      ]
    },
    sections: [
      {
        title: "Three things people mean by “dating assistant”",
        paragraphs: [
          "The phrase covers a coach who reviews your profile, a tool that drafts lines and a service that runs the apps. Decide which job you want done before you compare prices or promises."
        ]
      },
      {
        title: "Why an AI instead of a person",
        paragraphs: [
          "A person can be warm and has a limited number of hours. Software can keep a chat warm at any hour and for any number of conversations at once, which matters because dating apps reward quick replies.",
          "The trade-off is that you are trusting software with your voice, which is why reading and taking over every chat should be easy."
        ]
      },
      {
        title: "What to ask before you hire anyone",
        paragraphs: ["Whose account is used, whether you can read every message, whether you can stop it yourself, what happens to your photos and whether the provider promises dates. " + control]
      }
    ],
    faqs: [
      { question: "What does a dating assistant do?", answer: "It depends on the type: a coach advises, a drafting tool suggests lines, and a service like NoSwipe creates and runs your profiles for you." },
      { question: "Is an AI dating assistant better than a human one?", answer: "Neither is better in general. A person suits advice and judgment, and software suits repetitive daily work at any hour." },
      { question: "Can I trust it with my messages?", answer: "You can read every chat and take over any chat at any time, so nothing has to go out unseen if you would rather check." },
      faqPrivacy,
      faqAvailability
    ],
    related: [
      { href: "/virtual-dating-assistant-cost", label: "Virtual dating assistant cost" },
      { href: "/dating-app-ghostwriter", label: "Dating app ghostwriter vs done for you" },
      { href: "/best-ai-dating-assistant-2026", label: "Best AI dating assistant: how to choose" },
      { href: "/ai-dating-apps-vs-dating-coaches", label: "AI dating apps vs dating coaches" },
      ...closing
    ]
  },
  {
    path: "/dating-concierge-online",
    metaTitle: "Online Dating Concierge Service: How It Works",
    h1: "Online dating concierge: a service you can start from your phone",
    eyebrow: "Online dating concierge",
    description: "An online dating concierge creates your profiles and runs them remotely, with no city list and no meetings. How NoSwipe works and where it is available.",
    answer: "An online dating concierge does the work of dating apps for you remotely: it creates your profiles, chats and books dates, with nothing to attend. NoSwipe is one, and you can start from your phone and just show up to the dates.",
    publishedIso: published,
    steps: [
      "Sign up on your phone and tell us your type, dealbreakers and free days.",
      "We create your profiles and run them remotely.",
      "You get each date plan in the app. You show up."
    ],
    sections: [
      {
        title: "What “online” changes",
        paragraphs: [
          "Traditional concierge and matchmaking services start with an intake meeting, a local team and a list of cities. An online concierge removes all of that: the set-up is a short form and the work happens on your own dating apps.",
          offer
        ]
      },
      {
        title: "Where it works",
        paragraphs: [
          "There is no city list and no local team to wait for. " + availability
        ]
      },
      {
        title: "What an online service still has to prove",
        paragraphs: ["Remote does not mean opaque. You should be able to read every chat, take over any chat and stop everything yourself, and the service should say what it does with your photos."],
        bullets: [
          "A clear consent step before anything runs on your profiles",
          "Access to every conversation sent in your name",
          "A one-tap way to pause an app",
          "No promised results"
        ]
      }
    ],
    faqs: [
      { question: "Is an online dating concierge as good as a local matchmaker?", answer: "They do different things. A matchmaker introduces people from their own network, and NoSwipe works on your own Tinder, Hinge and Bumble accounts, so the pool is whatever those apps offer where you live." },
      { question: "Do I need to meet anyone to start?", answer: "No. You set it up in the app and the work happens online." },
      { question: "Can I use it outside the five paid countries?", answer: "The free tools work anywhere, but the paid service is only offered in the United States, Canada, the United Kingdom, Australia and New Zealand for now." },
      faqConsent,
      faqSafety
    ],
    related: [
      { href: "/dating-app-concierge", label: "What is a dating app concierge?" },
      { href: "/ai-dating-concierge-vs-matchmaker", label: "AI dating concierge vs a matchmaker" },
      { href: "/dating-app-management-service", label: "Dating app management service" },
      safetyLink,
      ...closing
    ]
  },
  {
    path: "/too-busy-for-dating-apps",
    metaTitle: "Too Busy for Dating Apps? Hand Them Off",
    h1: "Too busy for dating apps? Hand them off instead of quitting",
    eyebrow: "Too busy to date",
    description: "No time for dating apps? A simple way to count the hours, what to cut and how to hand the rest to NoSwipe while you keep the dates.",
    answer: "If you are too busy for dating apps, you do not have to quit or fake a hobby of swiping: you can hand the repetitive work to someone else. NoSwipe creates and runs your profiles, and you just show up to the dates.",
    publishedIso: published,
    steps: [
      "Tell us the hours you actually have free for a date, even if it is one evening a week.",
      "We create your profiles and run them around that diary.",
      "You get the plan for each date and show up."
    ],
    sections: [
      {
        title: "Count the real hours first",
        paragraphs: [
          "Dating apps look free and cost hours: opening the app, scrolling, replying, rearranging. Add up a normal week before you decide anything, including the chats that stall and the plans that fall through.",
          "If the total is more than you would spend on a hobby you enjoy, the apps are not the problem. The unpaid admin is."
        ]
      },
      {
        title: "What to cut, and what to hand off",
        paragraphs: ["You cannot hand off the date, but nearly everything before it can go."],
        bullets: [
          "Cut: a third and fourth app you never open",
          "Cut: long chats with people you would not meet",
          "Hand off: swiping through people who clearly do not fit",
          "Hand off: replies that keep a match warm while you are working",
          "Hand off: finding a time that fits your diary and theirs"
        ]
      },
      {
        title: "How NoSwipe fits a crowded week",
        paragraphs: [
          offer,
          control
        ]
      }
    ],
    faqs: [
      { question: "I only have one free evening a week. Is that enough?", answer: "It can be. You tell us which days you are free for dates and plans are made around them." },
      { question: "Will I have to check the app all day?", answer: "No. You can check in for a few minutes if you want to read chats, or leave it and look at the plan for each date." },
      { question: "What if I stop having time at all?", answer: "You can pause any app at any time, and you can tell us to stop." },
      faqSafety,
      faqAvailability
    ],
    related: [
      { href: "/ai-dating-assistant-for-busy-professionals", label: "AI dating assistant for busy professionals" },
      { href: "/guides/dating-with-a-busy-schedule", label: "Dating with a busy schedule" },
      { href: "/dating-app-burnout", label: "Dating app burnout" },
      { href: "/someone-to-run-my-dating-apps", label: "Someone to run my dating apps" },
      ...closing
    ]
  },
  {
    path: "/dating-app-ghostwriter",
    metaTitle: "Dating App Ghostwriter vs Done-for-You Dating",
    h1: "Dating app ghostwriter or done for you: what is the difference?",
    eyebrow: "Dating app ghostwriter",
    description: "A dating app ghostwriter drafts words you still send. How that differs from done-for-you dating, where we create and run your profiles for you.",
    answer: "A dating app ghostwriter writes your bio or your messages and you still post and send them. NoSwipe goes further: we create your profiles and run them for you with your permission, so you just show up.",
    publishedIso: published,
    steps: [
      "A ghostwriter hands you words. You paste, post and send.",
      "With NoSwipe you give consent, your details and your free days, and we create and run the profiles.",
      "You read or take over any chat you like, then show up to the date."
    ],
    comparison: {
      title: "A ghostwriter or NoSwipe",
      intro: "Both write words in your name. The difference is who does everything after the writing.",
      columns: ["Ghostwriter", "NoSwipe"],
      rows: [
        { label: "What you receive", cells: ["Drafts of a bio, prompts or messages.", "Profiles created and running on your apps."] },
        { label: "Who posts and sends", cells: ["You.", "We do, with your permission."] },
        { label: "Swiping and scheduling", cells: ["You.", "We do."] },
        { label: "Your control", cells: ["Full, you send each message.", "Read every chat, take over any chat, pause any app."] },
        { label: "Account risk", cells: ["None from tools.", "The apps restrict automated tools, so an account can be limited."] }
      ]
    },
    sections: [
      {
        title: "What a ghostwriter is good for",
        paragraphs: [
          "If you enjoy the apps and just freeze at the blank bio, a ghostwriter is a fair fix: someone else writes the sentence and you do the rest. It is also the lowest-risk option, because you stay in charge of every action on the account."
        ]
      },
      {
        title: "Where it stops",
        paragraphs: ["The writing is a small part of the work. A ghostwriter does not swipe, answer at 2pm on a Tuesday or find a date that fits your diary. If those are the parts you dread, a draft will not help."]
      },
      {
        title: "How done for you works instead",
        paragraphs: [
          offer + " The words are written in your voice from your real details, and you can read all of it.",
          risk
        ]
      }
    ],
    faqs: [
      { question: "Do you ghostwrite messages for me to send?", answer: "No. We create your profiles and run them for you with your permission, rather than handing you drafts to send yourself." },
      { question: "Will the messages sound like me?", answer: "They are written in your voice from the details and tone you give us, and you can read any chat and take over whenever you want." },
      { question: "Is a ghostwriter safer for my account?", answer: "In one way, yes: you do every action yourself, so no tool acts on the app. NoSwipe runs the account for you, and the apps restrict automated tools." },
      faqConsent,
      faqPrivacy
    ],
    related: [
      { href: "/hire-a-dating-assistant", label: "Hire a dating assistant" },
      { href: "/dating-app-message-assistant", label: "Dating app message assistant" },
      { href: "/done-for-you-dating-profile", label: "Done-for-you dating profile" },
      privacyLink,
      ...closing
    ]
  },
  {
    path: "/virtual-dating-assistant-cost",
    metaTitle: "Virtual Dating Assistant Cost: What You Pay For",
    h1: "Virtual dating assistant cost: what you are really paying for",
    eyebrow: "Virtual assistant cost",
    description: "What a virtual dating assistant costs depends on who does the work. What drives the price, hidden costs to ask about and where to see NoSwipe's price.",
    answer: "What a virtual dating assistant costs depends on who does the work and how many hours they spend, so quotes vary widely and are worth getting in writing. NoSwipe shows exactly what is charged on its pricing page before you pay.",
    publishedIso: published,
    steps: [
      "Write down the job: advice, drafts or running your profiles.",
      "Ask each provider for the full charge, what is included and what is refundable.",
      "With NoSwipe, open the pricing page and check the price and availability before you pay."
    ],
    comparison: {
      title: "What drives the cost",
      intro: "No prices here, because they change and differ by provider. This is what to compare.",
      columns: ["A person you hire", "An AI service like NoSwipe"],
      rows: [
        { label: "Main cost driver", cells: ["Their hours.", "The service plan on the pricing page."] },
        { label: "Capacity", cells: ["Limited by their time.", "Runs your chats at any hour."] },
        { label: "Things to ask", cells: ["Rate, minimum hours, extras, notice period.", "What is charged, when and what is refundable."] },
        { label: "Your own time", cells: ["Briefings and feedback calls.", "A short set-up, then showing up."] }
      ]
    },
    sections: [
      {
        title: "Why quotes are all over the place",
        paragraphs: [
          "A virtual assistant for dating can mean a person on retainer, a freelance profile writer or an AI service. The price follows the labour: more hours and more custom writing cost more, and software scales without extra hours.",
          "We are not going to quote competitors, because we would be guessing. Ask for a written total."
        ]
      },
      {
        title: "Questions that expose the real cost",
        paragraphs: ["The headline number is rarely the whole story."],
        bullets: [
          "Is it a one-off fee or does it renew?",
          "What is included: profile, swiping, chatting, scheduling?",
          "What is refundable, and how do you ask?",
          "Is there a minimum term or a notice period?",
          "Are the paid features available in your country?"
        ]
      },
      {
        title: "Where to see NoSwipe's price",
        paragraphs: [
          "The pricing page states what is charged today, shown before you pay, and there are no other fees. " + availability,
          offer
        ]
      }
    ],
    faqs: [
      { question: "How much does a virtual dating assistant cost?", answer: "It depends on whether you hire a person or use software, and on the hours involved. Get the total in writing, and see NoSwipe's price on its pricing page." },
      { question: "Is NoSwipe's price on the site?", answer: "Yes. The pricing page shows what is charged today and when, before you pay." },
      { question: "Can I get a refund?", answer: "Refunds are covered in the refund policy, and you can email support@noswipe.app." },
      faqAvailability,
      faqConsent
    ],
    related: [
      { href: "/hire-a-dating-assistant", label: "Hire a dating assistant" },
      { href: "/pricing", label: "NoSwipe pricing" },
      { href: "/refunds", label: "Refund policy" },
      { href: "/dating-app-management-service", label: "Dating app management service" },
      { href: "/terms", label: "Terms, including dating-app risk" }
    ]
  },
  {
    path: "/dating-profile-manager",
    metaTitle: "Dating Profile Manager: Created and Kept Fresh",
    h1: "Dating profile manager: someone to build it and keep it fresh",
    eyebrow: "Dating profile manager",
    description: "A dating profile manager creates your profiles and keeps them current. What ongoing management covers and how NoSwipe does it from your real details.",
    answer: "A dating profile manager creates your dating profiles and keeps them current, so they never look abandoned. NoSwipe does that from your real photos and details, then runs the chats too, and you just show up.",
    publishedIso: published,
    steps: [
      "You share your real photos, a few facts and what you want.",
      "We create the profiles and keep photo order, bio and prompts fresh.",
      "We run the chats. You show up to the dates."
    ],
    sections: [
      {
        title: "A profile is not a one-off",
        paragraphs: [
          "People write a profile once and leave it for a year. Photos date, prompts go stale and the bio still describes who you were. A manager treats it as a living page you check on, not a document you finish."
        ]
      },
      {
        title: "What ongoing management covers",
        paragraphs: ["The same few jobs, repeated."],
        bullets: [
          "Swapping in recent photos and keeping a clear first photo",
          "Rewriting prompts so each has one specific detail",
          "Keeping the bio short, current and easy to message",
          "Matching what you say you want with who gets swiped",
          "Pausing or closing a profile when you ask"
        ]
      },
      {
        title: "Real photos, only your own profile",
        paragraphs: [
          "We use your real photos and never create a fake version of you. NoSwipe only works on profiles that belong to you, with your explicit consent.",
          offer
        ]
      }
    ],
    faqs: [
      { question: "What does a dating profile manager do?", answer: "It creates your profile and keeps the photos, bio and prompts current, and in NoSwipe's case it also runs the swiping and chats." },
      { question: "Will it use fake or edited photos?", answer: "No. We use your real photos and never create a fake version of you." },
      { question: "Can I change what it writes?", answer: "Yes. You can read everything, ask for changes or pause an app at any time." },
      faqPrivacy,
      faqAvailability
    ],
    related: [
      { href: "/done-for-you-dating-profile", label: "Done-for-you dating profile" },
      { href: "/guides/dating-profile-audit-checklist", label: "Dating profile audit checklist" },
      { href: "/guides/dating-app-photo-order-men", label: "Dating app photo order" },
      privacyLink,
      ...closing
    ]
  },
  {
    path: "/ai-that-chats-for-you-on-dating-apps",
    metaTitle: "AI That Chats for You on Dating Apps",
    h1: "An AI that chats for you on dating apps: what it does and the limits",
    eyebrow: "AI that chats for you",
    description: "An AI that chats for you on dating apps keeps matches warm and moves them toward a date. How it works in your voice, what you control and the limits.",
    answer: "Yes, an AI can chat for you on dating apps, and NoSwipe does it in your voice: opening, replying and moving a good match toward a plan. You can read every chat and take over any one whenever you like.",
    publishedIso: published,
    steps: [
      "You set your tone, your type and your free days.",
      "We chat with your matches in your voice and suggest a plan when it is right.",
      "You read, take over or pause whenever you like, and show up to the date."
    ],
    sections: [
      {
        title: "What chatting for you actually involves",
        paragraphs: [
          "Most chats die at “hey”, so the useful work is small and repetitive: an opener that mentions a real detail, a reply that asks one easy question and a nudge toward a day and place after a few good exchanges.",
          offer
        ]
      },
      {
        title: "How you stay in the chat",
        paragraphs: ["Chatting for you is only acceptable if you can see it and stop it."],
        bullets: [
          "Read every conversation sent in your name",
          "Take over any chat; while you have, nothing is sent for you in it",
          "Pause an app in one tap",
          "Tell us to stop whenever you like"
        ]
      },
      {
        title: "The limits",
        paragraphs: [
          "An AI cannot make someone interested, and some chats will go nowhere. It also cannot replace the date. " + risk
        ]
      }
    ],
    faqs: [
      { question: "Can an AI really chat for me?", answer: "Yes. NoSwipe opens and keeps up conversations in your voice with your permission, and moves good ones toward a date." },
      { question: "Do the people I chat with know?", answer: "The profile and messages are yours, and the privacy page explains how conversations are handled. Be honest about it if someone asks you." },
      { question: "What if a chat goes somewhere I do not want?", answer: "Take it over or pause the app. You can also tell us to stop." },
      faqPrivacy,
      faqAvailability
    ],
    related: [
      { href: "/ai-that-swipes-for-you", label: "Is there an AI that swipes for you?" },
      { href: "/ai-dating-app-openers", label: "AI dating app openers" },
      { href: "/is-using-ai-on-dating-apps-allowed", label: "Is using AI on dating apps allowed?" },
      privacyLink,
      ...closing
    ]
  }
];
