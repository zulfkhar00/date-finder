import type { AiPage } from "@/content/ai-pages";

const published = "2026-11-20";

/** What NoSwipe does, said the same way on every page so the facts never drift. */
const noswipeDoes =
  "NoSwipe swipes on people who match your type, chats in your voice and books the date on your own Tinder, Hinge and Bumble accounts, with your permission. You can read every chat, take over any chat or pause any app at any time.";
const risk =
  "Tinder, Hinge and Bumble restrict automated tools, so an account can be limited, which the terms spell out. Nobody can promise matches, replies or dates.";
const availability =
  "The free tools work anywhere. The paid service is available in the United States, Canada, the United Kingdom, Australia and New Zealand, and the pricing page shows the price before you pay.";

const closing = [
  { href: "/pricing", label: "Pricing and where it is available" },
  { href: "/terms", label: "Terms, including dating-app risk" }
];

/** Ten intent pages, each on a query the existing guides and answer pages do not already target. */
export const intentPages: AiPage[] = [
  {
    path: "/ai-dating-assistant-for-busy-professionals",
    metaTitle: "AI Dating Assistant for Busy Professionals",
    h1: "AI dating assistant for busy professionals",
    eyebrow: "Busy professionals",
    description: "An AI dating assistant for people with no time to swipe. What to hand off, what to keep and how NoSwipe works on your own Tinder, Hinge and Bumble.",
    answer: "If you work long hours, an AI dating assistant is worth it when it does the repetitive parts, which are swiping, replying and scheduling, and leaves you the dates. NoSwipe does those parts on your own Tinder, Hinge and Bumble accounts, while you keep control of every chat.",
    publishedIso: published,
    sections: [
      {
        title: "Why a full diary breaks dating apps",
        paragraphs: [
          "Dating apps reward small, frequent effort: a reply while the match is still warm, a plan suggested in the first few messages, a profile that does not look abandoned. A packed week makes all three hard, so matches go cold and chats stall at “how was your day”.",
          "The problem is rarely your photos. It is that the work has to happen at times you are in meetings, travelling or asleep."
        ]
      },
      {
        title: "What to hand off, and what to keep",
        paragraphs: ["Hand off the parts that need time, not taste. Keep the parts only you can do."],
        bullets: [
          "Hand off: swiping through people who clearly do not fit your type or dealbreakers",
          "Hand off: openers and quick replies that keep a chat moving",
          "Hand off: finding a day and place that works for both diaries",
          "Keep: who you want to meet and what you will not compromise on",
          "Keep: the date itself, and the call on whether to see someone again"
        ]
      },
      {
        title: "A realistic setup for a busy week",
        paragraphs: [
          "Spend one sitting setting your type, dealbreakers, tone and the days you are free for dates. After that, check in a few minutes a day: read the chats you care about, take over any you want to write yourself, pause an app on a heavy week.",
          "If you would rather stay hands-on, the guide on dating with a busy schedule covers the manual version."
        ]
      },
      {
        title: "How NoSwipe works for this",
        paragraphs: [
          noswipeDoes,
          "It fixes the profile first, so the swiping starts from photos in a sensible order and a bio that gives people something to message about. When a match says yes, you get a plan with where, when and who.",
          risk
        ]
      }
    ],
    faqs: [
      { question: "Is an AI dating assistant worth it if I work long hours?", answer: "It can be, if the assistant does the swiping, replying and scheduling and you only go on the dates. If it only suggests lines, you still have to find the time to use them." },
      { question: "How much of my time does NoSwipe need?", answer: "One sitting to set your type, dealbreakers and availability, then a few minutes a day if you want to read chats. You can also leave it running and just check the plan for each date." },
      { question: "Can I still reply myself?", answer: "Yes. You can take over any chat at any time, and while you have taken over, nothing is sent for you in that chat." },
      { question: "Does it work if I travel a lot?", answer: "It keeps conversations moving while you are away, and you tell it which days you are free for dates. Plans are made around those days." },
      { question: "Is it available where I live?", answer: availability }
    ],
    related: [
      { href: "/guides/dating-with-a-busy-schedule", label: "Dating when you work 60 hours a week" },
      { href: "/ai-dating-assistant", label: "AI dating assistant: what it is and what it does" },
      { href: "/dating-app-automation", label: "AI dating app automation" },
      ...closing
    ]
  },
  {
    path: "/bumble-opening-lines",
    metaTitle: "Bumble Opening Lines That Get Replies",
    h1: "Bumble opening lines that get replies",
    eyebrow: "Bumble openers",
    description: "Bumble opening lines that get replies: how to write the first message from her badges and prompts, with examples to adapt and what to avoid.",
    answer: "A Bumble opening line works when it picks up one thing she put on her profile and asks something she can answer in a sentence. Adapt the shapes below rather than pasting them, because a line she has seen before reads as a template.",
    publishedIso: published,
    sections: [
      {
        title: "Check who sends the first message",
        paragraphs: [
          "Bumble has changed how the first message works over the years and the rules can differ by match type, so look at what your app shows you before you plan an opener. If she writes first, your job is a good reply. If you write first, your job is a good opening line.",
          "Either way the same idea holds: use something specific from her profile."
        ]
      },
      {
        title: "Where to find something to say",
        paragraphs: ["Bumble profiles give you more hooks than people use."],
        bullets: [
          "A prompt answer: reply to the actual answer, not the topic",
          "A photo with context: a place, an activity, a pet, a group shot you can ask about",
          "A shared interest or a badge she picked: name the thing and add a detail of your own",
          "A bio line with a clear opinion: agree or disagree with it, kindly"
        ]
      },
      {
        title: "Opening lines by situation",
        paragraphs: ["These are shapes to adapt to what is actually on her profile."],
        bullets: [
          "A travel photo: “That harbour looks unreal. Was it as windy as the photo suggests?”",
          "A prompt about a guilty pleasure: “Reality dating shows is a brave answer. Which one do you defend hardest?”",
          "A pet photo: “He has the face of someone who has stolen a sandwich. What is his worst crime so far?”",
          "A shared hobby: “You hike? I am planning a trip and need a second opinion. Best trail you have done?”",
          "A short bio: “Your bio has two sentences and one of them is a challenge. Pizza or tacos, final answer?”"
        ]
      },
      {
        title: "What to avoid",
        paragraphs: [
          "“Hey”, “hi” and “how is your week going” ask her to do the work. So do two questions in one message, comments only about looks, and questions her profile already answers.",
          "Keep it to two short sentences. If it needs a paragraph, it is a pitch."
        ]
      },
      {
        title: "Or let NoSwipe write them",
        paragraphs: [
          "If writing openers is the part you skip, NoSwipe reads the profile, picks the detail and writes the opener and follow-ups in your voice on your own Bumble account. " + risk
        ]
      }
    ],
    faqs: [
      { question: "What is a good opening line on Bumble?", answer: "One detail from her profile plus an easy question, in two short sentences. Specific beats clever." },
      { question: "Should I use a pickup line?", answer: "Rarely. Pickup lines are generic by design, so they tell her nothing about whether you read her profile." },
      { question: "What do I say if she messages first?", answer: "Answer her question properly, add one thing about yourself and ask her something back so the chat is two-way." },
      { question: "How long should the first message be?", answer: "Two short sentences is plenty. Long first messages read as a pitch." },
      { question: "Can NoSwipe message on Bumble for me?", answer: "Yes. It writes and sends messages in your voice on your own Bumble account with your permission, and you can read or take over any chat. Bumble restricts automated tools, so an account can be limited." }
    ],
    related: [
      { href: "/how-to-get-more-matches-on-bumble", label: "How to get more matches on Bumble" },
      { href: "/bumble-automation", label: "Bumble AI automation" },
      { href: "/ai-dating-app-openers", label: "AI dating app opener examples" },
      ...closing
    ]
  },
  {
    path: "/dating-app-burnout",
    metaTitle: "Dating App Burnout: What Actually Helps",
    h1: "Dating app burnout: what actually helps",
    eyebrow: "Dating app burnout",
    description: "Tired of swiping? What dating app burnout looks like, the habits that make it worse and practical ways to cut the effort without quitting dating.",
    answer: "Dating app burnout is the flat, tired feeling from swiping and chatting without it leading anywhere, and it usually eases when you cut the volume, shorten the chats and move good ones to real plans sooner. If it is affecting your mood beyond dating, talk to someone you trust or a professional.",
    publishedIso: published,
    sections: [
      {
        title: "What it looks like",
        paragraphs: ["Burnout does not feel dramatic. It feels like dread when the app icon shows a notification."],
        bullets: [
          "You open the app out of habit and close it without doing anything",
          "Every chat feels like the same conversation",
          "You stop replying to people you were interested in",
          "You feel worse about yourself after a session than before it"
        ]
      },
      {
        title: "Habits that make it worse",
        paragraphs: [
          "Long sessions of swiping on autopilot, keeping many chats alive at once and treating every match as a decision all drain the same energy. So does chatting for weeks without a plan, because the conversation has nowhere to go.",
          "Most of the effort in dating apps is admin, not connection, and the admin is what wears people out."
        ]
      },
      {
        title: "What helps, in order",
        paragraphs: ["Start with the cheapest changes."],
        bullets: [
          "Set a window: one short session a day, or three a week, then close the app",
          "Narrow the pool: fix your preferences so you swipe on fewer, better matches",
          "Cut chats to the ones you actually like, and let the rest end politely",
          "Suggest a plan after a few good messages instead of chatting for weeks",
          "Take a real break: pause the profile for two weeks and see how you feel"
        ]
      },
      {
        title: "When to hand the admin off",
        paragraphs: [
          "If you still want to meet people but hate the daily grind, handing the admin to a tool can make sense. " + noswipeDoes,
          "It does not remove the point of dating, which is meeting someone. You still go on the dates and decide who you see again. " + risk
        ]
      },
      {
        title: "A note on wellbeing",
        paragraphs: [
          "This page is practical advice, not medical advice. If low mood, anxiety or loneliness is lasting or getting heavier, a doctor, counsellor or someone you trust is a better place to start than any app."
        ]
      }
    ],
    faqs: [
      { question: "What is dating app burnout?", answer: "A tired, negative feeling from spending time on dating apps without results you enjoy. It often shows up as avoiding the app or replying less." },
      { question: "Should I delete the apps?", answer: "A break is fine and often helps. If you want to keep dating, cutting the time you spend, narrowing your preferences and moving chats to plans sooner can work without quitting." },
      { question: "How long should a break be?", answer: "There is no fixed length. Two weeks is long enough to notice how you feel without the apps." },
      { question: "Can an AI assistant help with burnout?", answer: "It can take over the swiping, replying and scheduling, which is the repetitive part. It cannot make a person like you or promise a date." },
      { question: "Is NoSwipe a good fit if I am burnt out?", answer: "It suits people who still want to date but are tired of the daily admin. You can pause any app or take over any chat at any time." }
    ],
    related: [
      { href: "/matches-but-no-dates", label: "Lots of matches but no dates: what to fix" },
      { href: "/guides/dating-with-a-busy-schedule", label: "Dating when you work 60 hours a week" },
      { href: "/ai-dating-assistant", label: "AI dating assistant: what it does" },
      ...closing
    ]
  },
  {
    path: "/best-time-to-use-dating-apps",
    metaTitle: "Best Time to Use Hinge, Tinder and Bumble",
    h1: "Best time to be active on Hinge, Tinder and Bumble",
    eyebrow: "Best time to use dating apps",
    description: "Is there a best time to use Hinge, Tinder or Bumble? What is known, what is guesswork and how to test your own best window in two weeks.",
    answer: "None of the apps publishes an official best time, so any exact hour you read online is a guess, and evenings and weekends are the usual starting point when more people are free. Test your own window for two weeks and keep whichever gives you more replies.",
    publishedIso: published,
    sections: [
      {
        title: "What is actually known",
        paragraphs: [
          "Tinder, Hinge and Bumble do not publish when their users are most active, so claims of a precise best hour are opinion. People are generally more free after work, on weekends and on Sunday evenings, which is a reasonable place to begin.",
          "The time of day matters less than two things you control: replying while a match is still warm and not letting your profile look abandoned."
        ]
      },
      {
        title: "A simple way to test it",
        paragraphs: ["Change one thing at a time so you can tell what worked."],
        bullets: [
          "Pick a window, such as weekday evenings, and use it for one week",
          "Note how many new matches reply within a day",
          "Switch to a different window, such as weekend mornings, for the next week",
          "Keep the window with more real conversations, not just more matches",
          "Use your local time, not where you travelled last week"
        ]
      },
      {
        title: "Replying quickly beats picking the perfect hour",
        paragraphs: [
          "A match that waits a day for your first reply is cooler than one that hears back within a few hours. If you cannot be on the app at the right moment, a faster reply later is better than a perfectly timed slow one.",
          "Consistency also helps. Checking a little every day usually beats one long session at the weekend."
        ]
      },
      {
        title: "If your schedule does not fit any window",
        paragraphs: [
          "Shift workers, people who travel and anyone in long meetings often cannot hit a good window. A tool that replies in your voice means timing stops depending on your diary. " + noswipeDoes,
          risk
        ]
      }
    ],
    faqs: [
      { question: "What is the best time to be on Hinge?", answer: "There is no official answer. Evenings and weekends are a common starting point, and your own two-week test will tell you more than a generic claim." },
      { question: "Is Sunday really the best day for dating apps?", answer: "Many people say so, but the apps do not publish activity data to confirm it. Treat it as a hypothesis to test, not a rule." },
      { question: "Does it matter what time I send the first message?", answer: "Less than sending a specific, easy-to-answer message and replying promptly afterwards." },
      { question: "Should I use my local time zone?", answer: "Yes. Plan around when people near you are free, not where you were last week." },
      { question: "Can NoSwipe reply at good times for me?", answer: "It keeps your chats moving without you being on the app, so timing no longer depends on your diary. It cannot guarantee a reply." }
    ],
    related: [
      { href: "/matches-but-no-dates", label: "Lots of matches but no dates: what to fix" },
      { href: "/how-to-get-more-matches-on-hinge", label: "How to get more matches on Hinge" },
      { href: "/tinder-automation", label: "Tinder automation with AI" },
      ...closing
    ]
  },
  {
    path: "/done-for-you-dating-profile",
    metaTitle: "Done-for-You Dating Profile: What to Expect",
    h1: "Done-for-you dating profile: what you get and what to check",
    eyebrow: "Dating profile service",
    description: "What a done-for-you dating profile includes, what to check before you hand yours over and how NoSwipe builds it on your own Tinder, Hinge and Bumble.",
    answer: "A done-for-you dating profile means someone else chooses your photo order and writes your bio and prompt answers, using your real photos and your real details. NoSwipe does this first, then runs your swiping, chats and dates on your own accounts.",
    publishedIso: published,
    sections: [
      {
        title: "What a good profile service covers",
        paragraphs: ["Look for work on all the parts people judge in the first few seconds."],
        bullets: [
          "Photo selection and order, so the first photo is clear and the rest show your life",
          "A short bio that gives people something to message about",
          "Prompt answers on Hinge and Bumble written around one specific detail each",
          "Wording that sounds like you, not like a template",
          "Your real photos and real details, with nothing invented"
        ]
      },
      {
        title: "What to check before you hand it over",
        paragraphs: ["A profile is the first thing a stranger sees of you, so check the basics."],
        bullets: [
          "Do you approve the final profile before it goes live?",
          "Do they use only your real photos and details?",
          "Is it clear who owns the account and who can see your photos?",
          "Is there a plain statement of the risks and of what they cannot promise?",
          "Can you pause or remove the profile whenever you want?"
        ]
      },
      {
        title: "Why the profile comes first",
        paragraphs: [
          "Swiping and chatting only work as well as the profile they start from. Better photo order and clearer prompts mean more of the right people reply, so a service that skips the profile is working with a handicap.",
          "If you would rather do it yourself, the guides on photo order, bios and Hinge prompts walk through each part."
        ]
      },
      {
        title: "How NoSwipe does it",
        paragraphs: [
          "NoSwipe fixes the profile first: photo order, bio and prompt answers, using your real photos. " + noswipeDoes,
          "Your photos are stored privately, used to build and run your profiles and not used to train AI models; the privacy note has the detail. " + risk
        ]
      }
    ],
    faqs: [
      { question: "What is a done-for-you dating profile?", answer: "A profile where someone else picks the photo order and writes the bio and prompts, using your real photos and facts." },
      { question: "Will it use fake or edited photos?", answer: "No. NoSwipe uses your real photos, and you should be wary of any service that suggests otherwise." },
      { question: "Can I review it before it goes live?", answer: "You can read everything in the app and take over or pause at any time. Check the terms for how approval works." },
      { question: "Is it only for the profile?", answer: "No. After the profile, NoSwipe swipes, chats in your voice and books dates on your own accounts." },
      { question: "Where is it available?", answer: availability }
    ],
    related: [
      { href: "/hire-someone-to-do-my-dating-apps", label: "Can you hire someone to do your dating apps?" },
      { href: "/guides/dating-app-photo-order-men", label: "Dating-app photo order for men" },
      { href: "/dating-app-concierge", label: "What is a dating app concierge?" },
      ...closing
    ]
  },
  {
    path: "/how-many-dating-apps-should-you-use",
    metaTitle: "How Many Dating Apps Should You Use?",
    h1: "How many dating apps should you use?",
    eyebrow: "How many dating apps",
    description: "How many dating apps to use at once: why one or two usually beats five, how to pick them and when it makes sense to add a third.",
    answer: "Two is a good number for most people: enough to reach different kinds of matches and few enough to reply properly to everyone. Add a third only when the first two are running well and you have time for it.",
    publishedIso: published,
    sections: [
      {
        title: "Why more apps rarely means more dates",
        paragraphs: [
          "Every app is another inbox to check, another profile to keep fresh and another set of chats to keep warm. Past two or three, most people spread the same attention thinner and reply later, which loses more matches than the extra apps gain.",
          "Dates come from conversations that turn into plans, not from the number of matches."
        ]
      },
      {
        title: "How to choose",
        paragraphs: ["Pick by what you want, not by popularity."],
        bullets: [
          "Tinder: a large pool and quick decisions, photo first",
          "Hinge: prompts and specific details, a slower, more conversational start",
          "Bumble: a different first-message rhythm; check your app for how it works for you",
          "Pick the apps where the people you want to meet actually are, in your area"
        ]
      },
      {
        title: "When a third app makes sense",
        paragraphs: [
          "Add one if your pool is small where you live, if you travel between places or if the first two are giving you plenty of dates and you want variety. Do not add one because the first two feel slow; fix the profile and the reply speed first."
        ]
      },
      {
        title: "Running several without the admin",
        paragraphs: [
          "If you want the reach of several apps without checking each one, that is the admin a tool can take over. " + noswipeDoes,
          "It covers Tinder, Hinge and Bumble, and you can pause any single app. " + risk
        ]
      }
    ],
    faqs: [
      { question: "How many dating apps is too many?", answer: "When you cannot reply to everyone properly. For most people that is somewhere past two or three." },
      { question: "Which two should I start with?", answer: "Pick the two that fit what you want. Hinge suits conversation and specifics, Tinder gives the largest pool, and Bumble has its own first-message rhythm." },
      { question: "Does using more apps get me more dates?", answer: "Not by itself. Reply speed and a clear plan matter more than the number of apps." },
      { question: "Can I run all three with NoSwipe?", answer: "Yes. It works on Tinder, Hinge and Bumble, and you can pause any app at any time." },
      { question: "What about other dating apps?", answer: "Tell us during signup which other apps you use. NoSwipe works on Tinder, Hinge and Bumble today." }
    ],
    related: [
      { href: "/guides/tinder-vs-hinge-vs-bumble-for-men", label: "Tinder vs Hinge vs Bumble for men" },
      { href: "/dating-app-automation", label: "AI dating app automation" },
      { href: "/matches-but-no-dates", label: "Lots of matches but no dates" },
      ...closing
    ]
  },
  {
    path: "/ai-dating-assistant-privacy",
    metaTitle: "AI Dating Assistant Privacy: Photos and Chats",
    h1: "AI dating assistant privacy: what happens to your photos and chats",
    eyebrow: "Privacy",
    description: "What to ask before you give an AI dating assistant your photos and chats, and how NoSwipe stores, processes and deletes them.",
    answer: "Before you use any AI dating assistant, find out where your photos are stored, which AI provider reads your chats, whether anything is used for training and how you delete it. NoSwipe stores photos privately, sends text to Anthropic's Claude to write your profile and messages, and does not use your photos or messages to train AI models.",
    publishedIso: published,
    sections: [
      {
        title: "Five questions to ask any tool",
        paragraphs: ["A dating assistant sees photos of your face and conversations with other people, so ask first."],
        bullets: [
          "Where are my photos stored, and can anyone else see them?",
          "Which AI provider processes my messages, and under what terms?",
          "Is anything used to train AI models?",
          "Who on the team can see my data?",
          "How do I delete everything, and what stays behind?"
        ]
      },
      {
        title: "What NoSwipe does",
        paragraphs: [
          "Photos go into a private storage bucket that only you and the NoSwipe server can read, and you see them through short-lived links. Your profile details, photos where needed and the text of conversations are sent to Anthropic, which provides the Claude model, over its commercial API to write your profile and your messages.",
          "NoSwipe does not use your photos or messages to train AI models, does not sell your data and limits who sees it to you and the team members who support your account."
        ]
      },
      {
        title: "Deleting your data",
        paragraphs: [
          "You can delete your account from Profile, which removes your profile, photos, preferences, matches, messages and dates from NoSwipe. A profile that already exists on a dating app is governed by that app; you can ask NoSwipe to close it or do it in the app. Payment records that Stripe and the law require are kept.",
          "The privacy note has the full list of what is collected and why."
        ]
      },
      {
        title: "The part that is about the apps, not us",
        paragraphs: [
          "Tinder, Hinge and Bumble have their own rules and may restrict automated or third-party use of an account. " + risk
        ]
      }
    ],
    faqs: [
      { question: "Does NoSwipe use my photos to train AI?", answer: "No. NoSwipe does not use your photos or messages to train AI models, and under Anthropic's commercial terms your data is not used to train its models." },
      { question: "Who can see my photos?", answer: "You and the NoSwipe team members who set up and support your account. Photos are not public." },
      { question: "Which AI does NoSwipe use?", answer: "Anthropic's Claude, through its commercial API, to write your profile and your messages." },
      { question: "How do I delete my data?", answer: "Delete your account in Profile, or email support@noswipe.app. Existing profiles on dating apps are governed by those apps." },
      { question: "Do the people I chat with agree to be on NoSwipe?", answer: "No. Their messages are kept only to run your chats and show them to you, as the privacy note explains." }
    ],
    related: [
      { href: "/is-using-ai-on-dating-apps-allowed", label: "Is using AI on dating apps allowed?" },
      { href: "/ai-dating-assistant", label: "AI dating assistant: what it does" },
      { href: "/dating-app-concierge", label: "What is a dating app concierge?" },
      { href: "/privacy", label: "Full privacy note" },
      ...closing
    ]
  },
  {
    path: "/first-date-safety-from-dating-apps",
    metaTitle: "First Date Safety Checklist for Dating Apps",
    h1: "First date safety from dating apps: a practical checklist",
    eyebrow: "First date safety",
    description: "A practical safety checklist for a first date from a dating app: what to check before, where to meet and what to share with a friend.",
    answer: "Meet in a public place, tell a friend where you are going and keep your own transport, because those three habits cover most of first-date safety. Check that your match is who their profile says before you go, and leave if anything feels off.",
    publishedIso: published,
    sections: [
      {
        title: "Before the date",
        paragraphs: ["A few minutes of checking is cheap."],
        bullets: [
          "Chat for long enough that their story is consistent, or have a short video call",
          "Check that their photos look like the person you have been talking to",
          "Keep your address, workplace and financial details private",
          "Never send money, whatever the reason given",
          "Tell a friend who, where and when, and agree a time to check in"
        ]
      },
      {
        title: "Choosing the place",
        paragraphs: [
          "Pick a busy, public place and get there under your own steam, so you can leave when you want. Coffee, a daytime walk in a popular spot or a busy bar all work. Avoid being collected from home or having your match choose a private location.",
          "Keep the first plan short. An hour is enough to know whether you want a second one."
        ]
      },
      {
        title: "During and after",
        paragraphs: [
          "Keep an eye on your drink, watch how much you have had and trust your instincts. If you are uncomfortable, leave; you do not owe an explanation. Text your friend when you are home.",
          "The apps have report and block tools. Use them if someone behaves badly, and read each app's own safety pages for its current features."
        ]
      },
      {
        title: "When a tool books the date for you",
        paragraphs: [
          "Every item above still applies. " + noswipeDoes,
          "NoSwipe sends you the plan with where, when and who, and you decide whether to go. Treat that plan like any other first date: check in with a friend and keep your own transport. " + risk
        ]
      }
    ],
    faqs: [
      { question: "Where should I have a first date from a dating app?", answer: "Somewhere public and busy, that you travel to yourself, such as a coffee shop or a daytime walk in a popular place." },
      { question: "Should I video call before meeting?", answer: "It helps. A short call confirms the person matches their profile and gives you a feel for them." },
      { question: "Should I tell a friend about the date?", answer: "Yes. Share who, where and when, and agree a time to check in afterwards." },
      { question: "What should I never share?", answer: "Your home address, workplace details and financial information. Never send money." },
      { question: "Can I still go on a date NoSwipe books?", answer: "Yes, and the same safety habits apply. You get the plan, you decide whether to go and you can cancel at any time." }
    ],
    related: [
      { href: "/guides/first-date-planning", label: "First-date planning without the guesswork" },
      { href: "/guides/text-before-first-date", label: "What to text before a first date" },
      { href: "/dating-app-automation", label: "AI dating app automation" },
      ...closing
    ]
  },
  {
    path: "/dating-app-dealbreakers-and-preferences",
    metaTitle: "Dating App Dealbreakers and Preferences",
    h1: "How to set dating app preferences and dealbreakers",
    eyebrow: "Preferences and dealbreakers",
    description: "How to set dating app preferences and dealbreakers so you see fewer wrong people without ruling out good ones: a short framework with examples.",
    answer: "Set a hard filter only for things that would end a relationship, and treat everything else as a preference you can bend. A short list of real dealbreakers keeps your pool big enough while stopping you wasting time on obvious mismatches.",
    publishedIso: published,
    sections: [
      {
        title: "Dealbreaker or preference?",
        paragraphs: [
          "A dealbreaker is something that ends it however well the date goes, such as wanting kids when you do not, or living far apart. A preference is something you would like but could live with, such as a height range or a particular hobby.",
          "Be honest with yourself about which is which. Most people list ten dealbreakers and would drop seven of them for the right person."
        ]
      },
      {
        title: "A test for each one",
        paragraphs: ["Ask this about every item on your list."],
        bullets: [
          "Would I turn down someone I otherwise really liked because of this?",
          "Is it a fact about them, or a style I could get used to?",
          "Would I accept this in a friend?",
          "If I keep it, how many fewer people will I see?"
        ]
      },
      {
        title: "How narrow is too narrow",
        paragraphs: [
          "Age range, distance and what you are looking for are the settings that cut the pool most. Widening distance by a few miles or the age range by a couple of years often adds more good matches than a profile rewrite.",
          "Review your settings every month or two. What you want shifts, and the apps' options change."
        ]
      },
      {
        title: "How NoSwipe uses them",
        paragraphs: [
          "You give NoSwipe your type and up to three dealbreakers, and it swipes on people who match them. That makes the list worth thinking about: two honest dealbreakers beat six loose ones.",
          noswipeDoes + " " + risk
        ]
      }
    ],
    faqs: [
      { question: "What counts as a real dealbreaker?", answer: "Something that would end it however well the date goes, such as a clash on kids, lifestyle or where you want to live." },
      { question: "How many dealbreakers should I have?", answer: "A short list, ideally two or three. Every extra one shrinks your pool." },
      { question: "Is height a dealbreaker or a preference?", answer: "That is for you to decide. Ask whether you would turn down someone you liked because of it." },
      { question: "Should I widen my distance or age range?", answer: "If your pool feels small, widening a little is often the quickest fix before changing your profile." },
      { question: "Does NoSwipe use my dealbreakers?", answer: "Yes. It swipes on people who match your type and dealbreakers, and you can change them at any time." }
    ],
    related: [
      { href: "/guides/why-you-get-no-matches", label: "Why you get no matches on dating apps" },
      { href: "/how-to-get-more-matches-on-hinge", label: "How to get more matches on Hinge" },
      { href: "/tinder-automation", label: "Tinder automation with AI" },
      ...closing
    ]
  },
  {
    path: "/getting-back-on-dating-apps",
    metaTitle: "Getting Back on Dating Apps After a Break",
    h1: "Getting back on dating apps after a break or breakup",
    eyebrow: "Getting back on the apps",
    description: "Ready to date again? How to restart on dating apps after a breakup or a long break: refresh your profile, set a pace and keep it low pressure.",
    answer: "Restart slowly: refresh your photos and bio, set a small daily limit and aim for a couple of low-pressure dates rather than a quick relationship. Give yourself permission to pause again if it stops feeling good.",
    publishedIso: published,
    sections: [
      {
        title: "Check you are ready, not rushed",
        paragraphs: [
          "There is no right amount of time after a breakup. A useful test is whether you are curious about meeting people or just trying to feel better quickly. Curiosity makes for better dates.",
          "Start with the goal of a few pleasant conversations and a coffee, not a verdict on your future."
        ]
      },
      {
        title: "Refresh the profile first",
        paragraphs: ["Old profiles carry old habits."],
        bullets: [
          "Replace photos with ones from the last year, with a clear first photo",
          "Cut anything with an ex in it, cropped or not",
          "Rewrite the bio and prompts around what you are into now",
          "Reset your preferences, because what you want may have changed",
          "Keep everything honest and recent"
        ]
      },
      {
        title: "Set a gentle pace",
        paragraphs: [
          "Choose one app to begin with and a short daily window. Reply to people you are interested in and let the others go without guilt. Suggest a simple first plan after a few good messages: a coffee or a walk keeps the stakes low.",
          "Be honest on the date about where you are. You do not have to share your history, but pretending to be somewhere you are not tends to backfire."
        ]
      },
      {
        title: "If you would rather not do the admin",
        paragraphs: [
          "Returning to the apps can feel like starting a second job. " + noswipeDoes,
          "It fixes the profile first, then keeps the chats moving while you ease back in. " + risk
        ]
      }
    ],
    faqs: [
      { question: "How long should I wait after a breakup before dating apps?", answer: "There is no set time. Start when you are curious about meeting people rather than looking for a quick fix." },
      { question: "Should I mention my ex on my profile?", answer: "No. Remove photos with exes and keep the profile about who you are now." },
      { question: "How many apps should I start with?", answer: "One. Add a second once the first feels manageable." },
      { question: "Should I tell a date I am just out of a relationship?", answer: "Be honest if it comes up, without oversharing. Pretending you are somewhere you are not tends to backfire." },
      { question: "Can NoSwipe help me restart?", answer: "Yes. It rebuilds your profile first, then swipes, chats and books dates on your own accounts while you set the pace. You can pause any app at any time." }
    ],
    related: [
      { href: "/guides/dating-profile-mistakes-men", label: "Dating profile mistakes men make" },
      { href: "/guides/first-date-ideas-not-drinks", label: "First date ideas that are not drinks" },
      { href: "/ai-dating-assistant", label: "AI dating assistant: what it does" },
      ...closing
    ]
  }
];
