import type { Guide } from "@/content/guides";

const TINDER_TERMS = "https://tinder.com/terms/intl/en-GB/";
const BUMBLE_TERMS = "https://bumble.com/en-us/terms/";
const HINGE_TERMS = "https://hinge.co/terms";
const HINGE_PROFILE_REFRESH = "https://hinge.co/newsroom/profile-refresh-guide";

const termsSources: NonNullable<Guide["sources"]> = [
  { label: "Tinder Terms of Use", url: TINDER_TERMS, kind: "platform-context" },
  { label: "Bumble Terms and Conditions", url: BUMBLE_TERMS, kind: "platform-context" },
  { label: "Hinge Terms of Use", url: HINGE_TERMS, kind: "platform-context" }
];

export const seoGuidesBatch1: Guide[] = [
  {
    slug: "do-ai-dating-assistants-work",
    title: "Do AI dating assistants actually work? What they can and can't do",
    eyebrow: "AI dating assistants",
    description:
      "A plain look at the three kinds of AI dating tools, what each can realistically do, and how to tell a drafting tool from one that puts your account at risk.",
    intro:
      "“AI dating assistant” covers three very different products, and mixing them up is how people end up banned or disappointed. Here is what each type can do, what none of them can do, and the one question that sorts good tools from risky ones.",
    readingTime: "6 min read",
    publishedIso: "2026-10-30",
    sections: [
      {
        title: "Three kinds of tool wearing the same label",
        paragraphs: [
          "The first kind is a coach: you describe your situation, it gives advice. Think of a chatbot you ask about your bio or about what a reply meant. The second is a drafting tool: you hand it some text, it hands back options, and you decide what to use. The third is an auto-swipe bot, which connects to your account and taps for you.",
          "People lump these together because all three say “AI” on the landing page. They are not the same thing, and the risks are not close to the same. A coach can give you a bad suggestion. A bot can cost you the account."
        ],
        bullets: [
          "Coach: advice only, nothing touches your account",
          "Drafting tool: you share context, you get text back, you send it",
          "Auto-swipe bot: needs your login and acts as you inside the app"
        ]
      },
      {
        title: "What a coach or drafting tool can actually do",
        paragraphs: [
          "They are good at the unglamorous stuff. A second opinion on photo order. Three ways to reword a bio that reads like a CV. A reply that sounds friendlier than the one you were about to send at midnight. They save the time you would spend staring at a blank message box, and they are useful when you're too close to your own profile to see it.",
          "They are bad at knowing the person on the other end. A tool sees the words in the chat, not the tone of voice, the history or the way she laughed when you met. That part stays yours, and it's the reason every draft needs your edit before it goes anywhere."
        ],
        example: {
          label: "Example",
          text: "You share a match's bio that mentions a half-finished sourdough starter. A drafting tool can suggest “Does the starter have a name yet?” You decide whether that sounds like you, rewrite it, and send it yourself."
        }
      },
      {
        title: "What nothing can do",
        paragraphs: [
          "No tool can promise matches, replies or dates. Who sees your profile depends on the app, your location, your settings and who else is around that week. Anyone selling a guaranteed number is selling a story.",
          "No tool can fix a profile built on photos that don't look like you. If the first date feels like a surprise to her, the wording was never the problem. And no tool can make you interested in someone you aren't. It can help you write to people you actually like."
        ]
      },
      {
        title: "Why auto-swipe bots are a different animal",
        paragraphs: [
          "Dating apps write their rules down, and those rules are blunt about this. Tinder's terms list using a “robot, crawler” or other automatic device among prohibited actions, and separately bar third-party applications that interact with the service without written consent, naming AI and machine learning systems. Hinge's terms use nearly the same wording. Bumble's terms restrict software, scripts and robots in the app.",
          "All three also reserve the right to suspend or terminate accounts, and Tinder and Hinge say that can happen without a refund. Terms change, so read the current text yourself (links are below) rather than trusting a summary, including this one."
        ]
      },
      {
        title: "The one question that sorts them out",
        paragraphs: [
          "Ask: does this tool need my login? If a product wants your username and password, an access token or a browser session, it is acting as you, and that is what the terms above are written against. A tool that only drafts text for you to paste never touches the app.",
          "NoSwipe is in the third group by design: with your permission it runs your accounts and chats as you, so the risk above applies to it too, and an app may limit or suspend a profile. You can pause any app or take over any chat at any time. Whatever tool you pick, that single question will tell you more than its marketing page."
        ]
      },
      {
        title: "A fair way to test any tool for yourself",
        paragraphs: [
          "Before you pay for anything, run a small experiment. Take one real situation, such as a bio you've never liked or a reply you can't find words for, and see what comes back. Judge it on three things: is it specific to your situation, does it sound like something you'd say, and did it ask you for anything it didn't need?",
          "If the output could have been written for anyone, the tool is filling space. If it asks for your password, stop there. A good tool makes you faster at something you already wanted to do and leaves the decisions with you."
        ]
      }
    ],
    checklist: [
      "I know which of the three types a tool is before I try it",
      "It never asks for my dating-app password or session",
      "It doesn't promise matches, replies or dates",
      "I read and edit every draft before it goes anywhere",
      "I've skimmed the current terms of the app I use",
      "I'd be comfortable if the other person knew how I wrote the message"
    ],
    faqs: [
      {
        question: "Do AI dating assistants work?",
        answer:
          "Drafting and coaching tools can help with clarity, tone and ideas, which saves time. None can promise matches or dates, because that depends on the people involved and the app itself."
      },
      {
        question: "Is it safe to give a dating tool my login?",
        answer:
          "Tinder, Hinge and Bumble all restrict automated tools and account sharing in their terms, so handing over a login puts your account at risk. Tools that only draft text avoid that; tools that run your account, NoSwipe included, carry it."
      },
      {
        question: "Does NoSwipe use my dating-app account?",
        answer:
          "Yes. With your permission, NoSwipe runs your profile on the apps you pick: it swipes, chats as you and books dates. You can pause any app or take over any chat at any time. The apps' terms restrict automated tools, so an account can be limited or suspended."
      }
    ],
    sources: termsSources,
    relatedSlugs: ["dating-message-help", "first-message-after-match", "ai-dating-messages-ok"]
  },
  {
    slug: "ai-dating-messages-ok",
    title: "Is it okay to use AI to write dating app messages?",
    eyebrow: "AI and dating messages",
    description:
      "An honest take on using AI to write dating messages: a simple would-you-say-it-out-loud test, editing rules, and the moments when you should write it yourself.",
    intro:
      "Short answer: it's fine to get help with words, and it's not fine to let words you wouldn't say do the talking. The line between those two is easier to find than it sounds.",
    readingTime: "5 min read",
    publishedIso: "2026-10-30",
    sections: [
      {
        title: "Nobody writes alone anyway",
        paragraphs: [
          "You've asked a friend what to say. You've re-read a message six times and deleted the joke. Using a tool to get unstuck is the same habit with less waiting for your friend to reply.",
          "What people dislike is not help. It's being talked to by someone who isn't there. If she meets you after a week of witty messages and you turn out to be quiet and kind, nothing is wrong, as long as the messages were still recognisably you."
        ]
      },
      {
        title: "The out-loud test",
        paragraphs: [
          "Before you send a draft, read it out loud in your normal voice. If you stumble, cringe or would never use that word at a bar, change it. If you feel faintly embarrassed, delete it.",
          "This catches most of the obvious problems: the over-polished compliment, the paragraph where a sentence would do, the sudden poetry. A message that survives the test might still be an average message, but at least it's an honest one."
        ],
        example: {
          label: "Example",
          text: "Draft: “Your serene mountain photo radiates an adventurous spirit.” Out loud, that is a robot. Edit: “Which mountain is that? I've been trying to decide on a hike for Saturday.”"
        }
      },
      {
        title: "Edit rules that keep it yours",
        paragraphs: [
          "Treat a draft as a rough cut. Take the idea, then cut and swap until it matches how you actually type. If you never use exclamation marks, remove them. If you'd say “ha” rather than “That's hilarious,” say “ha.”"
        ],
        bullets: [
          "Cut every sentence you wouldn't say to her face",
          "Shorten it until it's about as long as your usual messages",
          "Replace big adjectives with a real detail from her profile",
          "Keep one question, not three",
          "Leave your own typos if that's how you write"
        ]
      },
      {
        title: "When to write it yourself",
        paragraphs: [
          "Some messages shouldn't come from a tool. Anything about logistics on the day: where, when, “I'm running late,” “I'm outside.” Anything emotional, including an apology, a decline or telling someone you aren't feeling it. And anything where the other person has shared something personal.",
          "In those moments a plain, slightly clumsy sentence in your own words beats a tidy one. People can tell the difference more often than the tool's makers would like."
        ]
      },
      {
        title: "What about being upfront?",
        paragraphs: [
          "You don't owe anyone a disclosure about spellcheck, and you don't owe a note about asking a friend. If someone asks you straight out how you wrote something, don't lie. “I got help with the wording but I meant it” is an honest answer and usually lands fine.",
          "Tools that draft and leave the sending to you keep this honest by design, because you're the one who read it, changed it and pressed send. The words are a starting point. The decision is yours."
        ]
      },
      {
        title: "A worked edit, start to finish",
        paragraphs: [
          "Say a draft comes back as: “It's wonderful to connect with someone who shares such a passion for cooking. What inspires your culinary adventures?” Read it out loud and it already fails. Nobody says “culinary adventures” unless they're being ironic.",
          "Start by finding the one useful thing in it, which is that she cooks and you're curious. Then rebuild it in your own words, shorter, with something she actually mentioned."
        ],
        example: {
          label: "Example",
          text: "Draft: “What inspires your culinary adventures?” Edited: “You said you make your own pasta. Is it the kind that takes all Sunday, or the kind that actually works on a Tuesday?”"
        }
      },
      {
        title: "Who the tool is for",
        paragraphs: [
          "Drafting help is most useful when you freeze, not when you're fluent. If you already know what to say, say it. If you've been looking at a chat for twenty minutes and sent nothing, a few options to react to can break the loop.",
          "It is also useful for people writing in a second language, where the worry is tone rather than grammar. Even then, the final read-through is yours, because only you know how she'll hear it."
        ]
      }
    ],
    checklist: [
      "I read every draft out loud before sending",
      "I cut anything I wouldn't say in person",
      "The message references something real from her profile",
      "It's about as long as my normal messages",
      "I wrote the day-of logistics myself",
      "I can answer honestly if someone asks how I wrote it"
    ],
    faqs: [
      {
        question: "Is using AI for dating messages dishonest?",
        answer:
          "Not by itself. It becomes a problem when the messages don't sound like you, or when you lie about it if asked. Edit drafts into your own voice and answer honestly."
      },
      {
        question: "Will she be able to tell?",
        answer:
          "Sometimes. Overly polished, generic or oddly formal messages stand out. Specific details and your normal phrasing make drafts much harder to spot."
      },
      {
        question: "Does NoSwipe send messages for me?",
        answer:
          "Yes. NoSwipe chats as you, in your voice, and you can read every chat and take over any time."
      }
    ],
    relatedSlugs: ["dating-message-help", "first-message-after-match", "do-ai-dating-assistants-work"]
  },
  {
    slug: "dating-app-swipe-bots-banned",
    title: "Dating app auto-swipe bots: why they get accounts banned",
    eyebrow: "Auto-swipe bots",
    description:
      "What Tinder, Hinge and Bumble say in their own terms about bots and third-party tools, what can happen to an account, and what to do instead of a swipe bot.",
    intro:
      "A swipe bot is tempting when you're tired of swiping. It's also the kind of tool the apps' terms are written against. Here is what the terms actually say, in their own words, and what is left once you drop the bot.",
    readingTime: "6 min read",
    publishedIso: "2026-10-30",
    sections: [
      {
        title: "What a swipe bot does",
        paragraphs: [
          "A swipe bot logs in as you, or borrows your session, and taps like or pass on a schedule. Some add canned openers. Some claim to “learn your type.” Under the hood they all do one thing: send actions to the app from something that isn't you holding the phone.",
          "That's the whole risk. The app sees an account behaving in ways a thumb doesn't, from places a person doesn't."
        ]
      },
      {
        title: "What the terms say",
        paragraphs: [
          "Tinder's Terms of Use list among prohibited actions using “any robot, crawler, site search/retrieval application, proxy or other manual or automatic device, method or process,” and using or developing third-party applications or services that directly interact with Tinder without written consent, including AI and machine learning systems. They also bar sharing your account with another person.",
          "Hinge's terms contain near-identical language on robots, third-party services and account sharing. Bumble's terms restrict developing, supporting or using software, scripts or robots in connection with the app, and say it can't allow you to share your account.",
          "These are summaries of long documents. They change, so read the originals linked at the bottom of the page before you rely on any detail."
        ]
      },
      {
        title: "What can happen to an account",
        paragraphs: [
          "Each app reserves the right to suspend or terminate accounts it believes broke the rules. Tinder's terms say it may delete an account without warning, and that it can ban an account without a refund. Hinge's say a violation can mean being banned without a refund. Bumble reserves the right to suspend or terminate an account without notice.",
          "None of that says every bot user gets caught. It says the risk is the user's, and you'd be putting your photos, matches and any paid subscription on the line to save a few minutes of tapping."
        ]
      },
      {
        title: "The part people miss: your login",
        paragraphs: [
          "Most swipe bots ask for access to your account. Even before the terms come into it, that is a lot to hand a stranger. Your account links to your phone number, your photos and your conversations with other people who never agreed to be seen by a third-party service."
        ],
        example: {
          label: "Example",
          text: "A tool promises 200 likes a day if you paste in your session token. If the tool gets breached or sold, the token doesn't come back with a refund."
        }
      },
      {
        title: "Safer ways to spend less time swiping",
        paragraphs: [
          "Most of the time swiping eats is a profile problem. If your first photo is unclear, you'll swipe more because fewer people stay. Fix the profile and the same effort lands better. Then set a time box: ten minutes, twice a day, and stop.",
          "For messages, a drafting tool that only gives you text means nothing logs in as you: you open the app and send it yourself. NoSwipe works the other way. It runs your account with your permission, so the account risk described above applies to it."
        ]
      },
      {
        title: "Why “everyone does it” isn't a plan",
        paragraphs: [
          "You'll see forum threads where someone says they ran a bot for months with no trouble. That's one account's story, and nothing in it tells you what the app will do next. Apps can change their detection and enforcement without announcing it, and the terms give them wide room to act.",
          "Think about what you stand to lose against what you gain. The gain is a little less tapping. The loss could be an account with months of matches and conversations, and in some cases a paid subscription."
        ]
      },
      {
        title: "What to do if you've already used one",
        paragraphs: [
          "If you've connected a third-party tool to your account, disconnect it and change your password. If the tool had your login, treat that password as exposed anywhere you've reused it. Then remove any browser extensions that click for you.",
          "After that, review your account in the app. If it's been restricted, use the app's own appeal and support routes rather than another tool. Don't open a second account to get around a ban; the terms address that too."
        ]
      }
    ],
    checklist: [
      "I never give a tool my dating-app password or session",
      "I've read the bot and third-party sections of my app's terms",
      "My first photo and bio are clear before I swipe more",
      "I set a swipe time box instead of chasing volume",
      "I use drafting tools that only give me text to paste",
      "I've checked a browser extension isn't clicking for me"
    ],
    faqs: [
      {
        question: "Do dating apps ban swipe bots?",
        answer:
          "Their terms prohibit bots and unapproved third-party tools and allow suspension or termination of accounts. How often they enforce it is not something the terms tell you."
      },
      {
        question: "Is a browser extension that auto-likes the same as a bot?",
        answer:
          "It acts on your account without you tapping, which is what the terms address. Read your app's current terms rather than assuming a friendly extension is exempt."
      },
      {
        question: "What's a safer alternative?",
        answer:
          "Improve photos and bio, set swipe time limits, and use drafting tools that only give you text to paste, so nothing logs in as you."
      }
    ],
    sources: termsSources,
    relatedSlugs: ["how-to-get-more-tinder-matches", "why-you-get-no-matches", "do-ai-dating-assistants-work"]
  },
  {
    slug: "she-replied-haha",
    title: "How to reply when she sends just “haha”",
    eyebrow: "Replying to “haha”",
    description:
      "What a one-word “haha” usually means and three ways to answer: add a take, change the subject with a hook, or move toward a plan, plus when to let it go.",
    intro:
      "You sent something you thought was decent. She sent back “haha.” Now you're staring at the screen. It isn't a verdict. It's an opening, and there are three reasonable ways to use it.",
    readingTime: "5 min read",
    publishedIso: "2026-10-30",
    sections: [
      {
        title: "What “haha” usually means",
        paragraphs: [
          "Most of the time, it means she found it funny and had nothing to add. Sometimes she's busy and acknowledging you. Occasionally it's polite fading. You can't tell from one word, and you don't need to.",
          "What you can control is whether your next message gives her something easy to answer. “Haha” is a closed door only if you answer it with another closed door."
        ]
      },
      {
        title: "Reply type one: add a take",
        paragraphs: [
          "Build on the joke with a small opinion. Opinions are easier to answer than statements because they invite agreement or pushback. Keep it short, one idea."
        ],
        example: {
          label: "Example",
          text: "She replied “haha” after you said you lost a bet and now have to wear a banana costume. You: “Worst part is it's the cheap kind. Zero structure. I look like a sad yellow sock.”"
        }
      },
      {
        title: "Reply type two: change the subject with a hook",
        paragraphs: [
          "If the joke has run its course, move on to something from her profile. Pick one specific detail and ask one question about it. This reads as curious, not as an escape from a dead end."
        ],
        example: {
          label: "Example",
          text: "“Totally unrelated, but your third photo. Is that the ferry to the island, or are you somewhere else?”"
        }
      },
      {
        title: "Reply type three: propose the plan",
        paragraphs: [
          "If you've been talking a few days and the mood is warm, a “haha” is a decent moment to be direct. A specific, low-pressure suggestion beats “we should hang out sometime.” Offer one day and one kind of place, and leave room for her to counter.",
          "If you want help phrasing it, the guide on asking her out covers timing and wording."
        ],
        example: {
          label: "Example",
          text: "“I'm going to prove the banana costume thing with photos. Coffee Thursday after work? I know a place with good pastries.”"
        }
      },
      {
        title: "When to let it go",
        paragraphs: [
          "If most of her replies are a word or two and you're doing all the work, stop steering. One more message with a real hook is reasonable. After that, the pattern is the answer. You don't need to send a sad question or ask if she's still interested.",
          "Nobody owes you a conversation, and nobody owes you an explanation for ending one. Let it sit, and spend that energy on someone who writes back in full sentences."
        ]
      },
      {
        title: "Matching her energy without mirroring it",
        paragraphs: [
          "If she writes one word, it doesn't follow that you should too. Mirroring a dull message gives you a dull chat. But a long paragraph back to “haha” is a mismatch in the other direction. Aim for one or two lines that carry a little more than hers did.",
          "The goal is to make replying cost her almost nothing. A question with an obvious answer, or a small opinion she can push back on, usually does that."
        ],
        example: {
          label: "Example",
          text: "She: “haha”. You: “Okay but be honest, is it a good bet or a bad bet when the other side gets to pick the forfeit?”"
        }
      },
      {
        title: "Reading the pattern over a few days",
        paragraphs: [
          "One “haha” is noise. A week of them is information. Look at what she does when you ask a direct question: does she answer, ask something back, or send another reaction? If she answers and asks, the conversation is alive, and your job is just to keep it easy.",
          "If she only reacts, you can make one clear, friendly suggestion to meet and see what she says. A yes or a no is better than weeks of ambiguous replies."
        ]
      }
    ],
    checklist: [
      "My reply gives her something easy to answer",
      "I picked one of the three types, not all at once",
      "If I changed topic, I used a real detail from her profile",
      "If I proposed a plan, it had a day and a kind of place",
      "I haven't sent more than two messages in a row without a reply",
      "I'm ready to leave it alone if she stays one-word"
    ],
    faqs: [
      {
        question: "Does “haha” mean she's not interested?",
        answer:
          "Not on its own. It usually means she found it funny and had nothing to add. Look at the pattern over several messages rather than one word."
      },
      {
        question: "Should I reply right away to “haha”?",
        answer:
          "There's no rule. Reply when you have something worth saying, not to fill the silence."
      },
      {
        question: "Can NoSwipe write my reply?",
        answer:
          "Yes. NoSwipe replies as you, in your voice, from the conversation. Read along and take over any time."
      }
    ],
    relatedSlugs: ["first-message-after-match", "when-to-ask-her-out", "match-stopped-replying"]
  },
  {
    slug: "match-stopped-replying",
    title: "What to say when a match hasn't replied in three days",
    eyebrow: "No reply after three days",
    description:
      "One calm follow-up with a specific hook, when a second message becomes chasing, what not to send, and how to move on without making it a thing.",
    intro:
      "Three days of silence stings more than it should. You probably get one more message. After that, it's a pattern. Here is how to send that one message without sounding hurt.",
    readingTime: "5 min read",
    publishedIso: "2026-10-30",
    sections: [
      {
        title: "Silence is rarely about you",
        paragraphs: [
          "People get busy, forget the app exists for a week, lose the chat under other notifications, or talk to several people and drop some. A few are just ignoring you. From your side you can't tell which, and guessing keeps you anxious.",
          "So decide the rule before you feel anything: one follow-up, then you stop. A rule made calmly is easier to follow than a decision made at 11pm."
        ]
      },
      {
        title: "The one calm follow-up",
        paragraphs: [
          "Open with a specific hook, not a reference to the silence. A new detail or a fresh question gives her an easy way back in without feeling told off. Keep it light and short."
        ],
        example: {
          label: "Example",
          text: "“Random update: I finally tried that ramen place you mentioned. Verdict: your taste is correct.”"
        },
        bullets: [
          "Pick a detail from her profile or an earlier message",
          "One question at most",
          "No mention of how long it's been",
          "No pressure to answer quickly"
        ]
      },
      {
        title: "When a second one is chasing",
        paragraphs: [
          "A follow-up is polite. Two or three begin to look like pressure, even if each message is friendly. If she hasn't answered the hook message in another few days, treat that as the answer and close the chat in your head.",
          "That doesn't mean she's a bad person. It means you've asked politely and she hasn't taken the opening. You can leave the match in your list. Unmatching is also fine."
        ]
      },
      {
        title: "What not to send",
        paragraphs: [
          "Skip “??”, “hello?”, “so you're ignoring me?”, “wow ok” and anything that makes her feel guilty for being quiet. Also skip the long, wounded paragraph. These never produce a warm reply, and they leave a worse impression if she does come back later.",
          "A dry, bitter joke about the silence counts too. It reads as the same complaint with a smile on it."
        ]
      },
      {
        title: "Moving on without a fuss",
        paragraphs: [
          "Put the energy somewhere useful. Start a conversation with someone new, tighten your profile, or plan something real this week. If three or four matches in a row go quiet after the first message, the opener is the place to look, and the guide on first messages is a good place to start."
        ]
      },
      {
        title: "Why the pause feels so loud",
        paragraphs: [
          "On an app, a conversation has no body language. A normal pause in a real chat is invisible; on screen it's a flat line. Your brain fills that gap with the worst explanation, which is almost always more personal than the truth.",
          "It helps to remember how you treat your own inbox. There are probably chats you meant to answer three days ago and didn't. That's what most silence is."
        ]
      },
      {
        title: "A second example of a follow-up",
        paragraphs: [
          "Hooks come from anywhere that isn't the silence itself. A shared interest, a joke from earlier, something you saw that reminded you of her profile. Short and low-stakes is the whole brief.",
          "Whatever you choose, read it back once and ask whether it sounds like a person who is fine either way. If it sounds like a person waiting by the phone, soften it or skip it."
        ],
        example: {
          label: "Example",
          text: "“Passing a bakery with a sign that says ‘sourdough, sold out’. Thought of your starter. Any news?”"
        }
      },
      {
        title: "Telling silence apart from a slow burn",
        paragraphs: [
          "Some people reply in bursts: nothing for two days, then a long message on a Saturday morning. If her earlier replies were warm and unhurried, a gap may just be her rhythm. If her very first reply was short and the chat never got going, a gap is more likely to be the end.",
          "Look back at the whole chat before you decide how worried to be. Warm and slow is a different situation from lukewarm and then quiet, and your follow-up can be lighter in the first case. In both cases the rule stays the same: one message, then you stop."
        ]
      }
    ],
    checklist: [
      "I waited at least a couple of days before following up",
      "My follow-up has a specific hook, not “hey?”",
      "It doesn't mention that she hasn't replied",
      "I sent one follow-up and then stopped",
      "I didn't send anything I'd regret reading back",
      "I started another conversation instead of watching the chat"
    ],
    faqs: [
      {
        question: "How long should I wait before following up?",
        answer:
          "There's no official number. A couple of days gives people time to see the message without feeling pushed. Choose a rule and stick to it."
      },
      {
        question: "Is it okay to send a second follow-up?",
        answer:
          "Usually not. One follow-up with a real hook is fine. More begins to feel like pressure, and silence after that is likely the answer."
      },
      {
        question: "Can NoSwipe draft the follow-up?",
        answer:
          "Yes. NoSwipe follows up as you, in your voice, and you can read the chat and take over any time."
      }
    ],
    relatedSlugs: ["first-message-after-match", "dating-message-help", "she-replied-haha"]
  },
  {
    slug: "opener-examples-by-photo",
    title: "Dating app opener examples by photo type",
    eyebrow: "Openers by photo",
    description:
      "Opener examples for dog, hiking, travel, group, food, gym mirror and no-face photos, built on one pattern: a detail, a take and an easy question.",
    intro:
      "A good opener starts with something in her photos that other people skip past. The pattern is the same every time: notice one detail, add a small opinion, ask a question that takes five seconds to answer. Below are seven photo types with examples you can adapt in your own words.",
    readingTime: "7 min read",
    publishedIso: "2026-10-30",
    sections: [
      {
        title: "The pattern: detail, take, easy question",
        paragraphs: [
          "Detail proves you looked. A take gives her something to agree or disagree with. An easy question lets her answer without writing an essay. Skip any one and the message gets worse: no detail reads as copy-paste, no take reads as an interview, no question leaves her with nothing to do.",
          "All the examples below are illustrations. Rewrite them so they sound like you, and only mention details actually visible in her profile."
        ]
      },
      {
        title: "Dog and pet photos",
        paragraphs: [
          "Everybody says “cute dog.” Ask something only a person who looked would ask: the breed, the face, the story, or what the dog is doing in the picture."
        ],
        example: {
          label: "Example",
          text: "“That is the look of a dog who knows exactly where the snacks are kept. What's their name?”"
        }
      },
      {
        title: "Hiking and outdoors",
        paragraphs: [
          "Skip “adventurous.” Pick the place, the gear or the weather, then ask about the trail."
        ],
        example: {
          label: "Example",
          text: "“You look unreasonably happy for someone holding a trekking pole in the rain. Was the view worth it?”"
        }
      },
      {
        title: "Travel photos",
        paragraphs: [
          "“Where is this?” is fine if the location isn't labelled. Better is a comparison or a ranking that invites an opinion."
        ],
        example: {
          label: "Example",
          text: "“If you had to eat one meal from that trip again, what would it be?”"
        }
      },
      {
        title: "Group photos",
        paragraphs: [
          "Don't ask which one is her. Comment on the group's vibe or the setting, then ask about the occasion."
        ],
        example: {
          label: "Example",
          text: "“This looks like the best-dressed wedding table in the country. Whose idea was the matching ties?”"
        }
      },
      {
        title: "Food, gym mirror and no-face photos",
        paragraphs: [
          "Food: ask for the recommendation behind the plate. Gym mirror: keep it about the activity, not the body, such as what she's training for. No-face photos: ask about the thing she chose to show instead, or the bio, and don't remark on the missing face."
        ],
        bullets: [
          "Example (food): “That looks like a place with one good dish. What do I order?”",
          "Example (gym mirror): “Are you training for something, or do you just like lifting heavy things on purpose?”",
          "Example (no face): “That's a great view. Is it the one you'd pick for a Sunday morning?”"
        ]
      },
      {
        title: "When none of this fits",
        paragraphs: [
          "If the profile gives you nothing, a simple, honest question about her bio works. A good opener is still not a guarantee she'll reply, because she might not be checking the app. See the guide on first messages for what to do after a match."
        ]
      },
      {
        title: "Adapting an example so it's yours",
        paragraphs: [
          "Take the pattern and swap each piece. The detail has to come from her profile, the take has to be something you actually think, and the question has to be one you'd genuinely like answered. If any of the three is borrowed, the message will read slightly off.",
          "A quick way to check: could this message be sent to anyone else with the same photo type? If yes, find a more specific detail. If a message mentions a book on a shelf or the name written on a mug, it was sent to exactly one person."
        ],
        example: {
          label: "Example",
          text: "Generic: “Nice hike!” Specific: “Is that the ridge before the lake, or did you take the longer loop? I've never found the turn.”"
        }
      },
      {
        title: "What to avoid for any photo",
        paragraphs: [
          "Comments on her body, even flattering ones, put her in a position where she has to respond to your attention instead of your interest. Skip ratings, skip “wow”, and skip anything that could be sent to a stranger on the street. Also skip questions that have no answer, such as “what's your story?”.",
          "If you're not sure whether a line is too forward, imagine reading it out loud to a friend of hers. If it would make the friend wince, rewrite it."
        ]
      }
    ],
    checklist: [
      "I mention a detail that is actually in the profile",
      "I add one opinion or small joke",
      "I end with a question she can answer in a sentence",
      "The message is two or three lines, not a paragraph",
      "I avoided comments about her body",
      "I rewrote any example so it sounds like me"
    ],
    faqs: [
      {
        question: "What makes a good opener?",
        answer:
          "A specific detail from her profile, a small opinion and an easy question. Together they show you paid attention and give her something to answer."
      },
      {
        question: "Should I copy these openers?",
        answer:
          "Treat them as illustrations. Copied lines tend to land flat. Use the pattern and fill it with something real from the profile."
      },
      {
        question: "Can NoSwipe suggest openers for a specific profile?",
        answer:
          "Yes. NoSwipe opens with something specific from their profile, as you. You can read and take over the chat."
      }
    ],
    relatedSlugs: ["first-message-after-match", "dating-message-help", "why-hey-gets-ignored"]
  },
  {
    slug: "hinge-photos-for-men",
    title: "Hinge photo order for men: what each slot should do",
    eyebrow: "Hinge photos for men",
    description:
      "Give each Hinge photo a job, cut the ones that repeat, place a group photo carefully and test one change at a time.",
    intro:
      "Hinge profiles mix photos with prompts, so each photo is doing a small job in a longer scroll. Give every slot a different job and you'll quickly see which ones you can cut.",
    readingTime: "6 min read",
    publishedIso: "2026-10-30",
    sections: [
      {
        title: "Think in jobs, not in your best photos",
        paragraphs: [
          "Most men pick their best photos and load them in. The result is often a row of versions of the same face. A better question for each slot: what does this photo tell someone that the others don't?",
          "Hinge's own profile refresh guide is short on photo advice, but two lines are worth keeping: pass on more than one group photo, and skip photos that hide your face. The slot structure below is NoSwipe's editorial framework, not a Hinge rule."
        ]
      },
      {
        title: "Slot jobs",
        paragraphs: [
          "Because Hinge shows photos between prompts, think of the first photo as the handshake and the rest as a conversation."
        ],
        bullets: [
          "Slot one: your face, clear, natural expression, you alone",
          "Slot two: a wider shot that shows your build and style honestly",
          "Slot three: something you actually do, caught in the middle of doing it",
          "Slot four: a social photo where you're easy to spot",
          "Slot five: a place or detail that works as a conversation hook",
          "Slot six: personality, such as a pet, a joke or a hobby you're proud of"
        ]
      },
      {
        title: "What to cut",
        paragraphs: [
          "Cut anything where your face is hard to see, near-duplicates from the same day, photos with an ex cropped out, and filtered shots that don't look like you. If you aren't sure, ask whether a friend would recognise you from that photo alone.",
          "A smaller set of strong photos beats filling every space. You don't need to use all the slots."
        ]
      },
      {
        title: "Where the group photo goes",
        paragraphs: [
          "Never first. A group photo makes people play “which one is he” before they know whether they like you. Put it fourth or later, and choose one where you're clearly identifiable and the other people aren't dominating the frame.",
          "If you can't tell yourself apart at thumbnail size, a stranger can't either."
        ]
      },
      {
        title: "Test one change at a time",
        paragraphs: [
          "If you swap four photos at once and likes change, you won't know why. Change one thing, wait several days, and note what happens. It won't give you clean data because weekdays, locations and who happens to be active all shift things. It does keep you from rebuilding the whole profile in a panic.",
          "For a fuller walk-through of ordering, see the photo-order guide for men."
        ]
      },
      {
        title: "A worked example of a six-slot profile",
        paragraphs: [
          "Imagine a man with a cluttered set: three similar selfies, a group at a wedding, one hiking photo and a blurry beach shot. Using the jobs above, keep the clearest selfie for slot one. Add a wider, honest full-length photo for slot two. Keep the hiking photo as the activity shot in slot three, move the wedding to slot four, and cut the other two selfies and the beach shot.",
          "That leaves four photos, each different, and no filler. If he then adds one photo of his dog and one from a recent trip, slots five and six have clear jobs. The profile got stronger by losing photos, not by gaining them."
        ]
      },
      {
        title: "How photos and prompts work together",
        paragraphs: [
          "Because prompts sit between photos, your answers can explain what a photo only shows. A climbing photo followed by a prompt about the worst route you've attempted gives her two angles on the same interest. Avoid repeating yourself, though: if a prompt says what the photo already says, one of them is wasting a slot.",
          "Use the next photo to add something new, and let the written answer carry the personality."
        ]
      }
    ],
    checklist: [
      "Photo one shows my face clearly, alone",
      "Every slot does a different job",
      "No near-duplicates from the same shoot",
      "The group photo is fourth or later and I'm easy to spot",
      "Everything looks like me today",
      "I change one thing at a time"
    ],
    faqs: [
      {
        question: "How many photos should I use on Hinge?",
        answer:
          "Use as many as are strong and different from each other. Filling every slot with repeats is worse than fewer good photos."
      },
      {
        question: "Should my first Hinge photo be a smile?",
        answer:
          "A natural expression where your face is visible works best. Forced or heavily posed shots can create an impression you can't keep on a date."
      },
      {
        question: "Can NoSwipe review my Hinge photos?",
        answer:
          "Yes. NoSwipe orders your real photos for your Hinge profile and drops the ones that don't help. You can change the order any time."
      }
    ],
    sources: [{ label: "Hinge: profile refresh guide", url: HINGE_PROFILE_REFRESH, kind: "platform-context" }],
    relatedSlugs: ["dating-app-photo-order-men", "hinge-prompts-for-men", "dating-profile-audit-checklist"]
  },
  {
    slug: "bumble-bio-for-men",
    title: "Bumble bio examples for guys that don't say “love to travel”",
    eyebrow: "Bumble bio for men",
    description:
      "Why “love to travel” gives her nothing to reply to, plus ten specific rewrites and a one-fact, one-opinion, one-hook bio structure.",
    intro:
      "“Love to travel, good vibes, down for anything.” She has read that bio many times, and not one version gave her a question to ask. A bio is a set of handles for a conversation, so give her something to grab.",
    readingTime: "6 min read",
    publishedIso: "2026-10-30",
    sections: [
      {
        title: "Why “love to travel” goes nowhere",
        paragraphs: [
          "It's true for almost everyone, which means it tells her nothing about you. And it asks for nothing back. If she wants to reply she has to invent the question herself, and most people simply move on.",
          "The fix isn't a cleverer line. It's a smaller, more specific one."
        ]
      },
      {
        title: "The structure: one fact, one opinion, one hook",
        paragraphs: [
          "A fact tells her what you do. An opinion shows how you think. A hook is the thing she can answer in a sentence. Three short lines is plenty."
        ],
        example: {
          label: "Example",
          text: "Fact: I fix bikes on weekends. Opinion: Disc brakes are worth the fuss. Hook: Tell me the worst bike you've owned."
        }
      },
      {
        title: "Ten rewrites",
        paragraphs: [
          "Each pair swaps a vague phrase for something she could respond to. Use them as a pattern, not as lines to copy. Only write things that are true for you."
        ],
        bullets: [
          "Example: “Love to travel” becomes “Lisbon was the best city I've been to and I'll argue about it.”",
          "Example: “Foodie” becomes “I judge every town by its cheapest good noodle shop.”",
          "Example: “Gym rat” becomes “Leg day is the only honest day.”",
          "Example: “Love dogs” becomes “Looking after my sister's beagle, who has opinions about the sofa.”",
          "Example: “Down to earth” becomes “Happiest on a Sunday with a long walk and zero plans.”",
          "Example: “Work hard, play hard” becomes “Nurse on nights, so my brunch is your dinner.”",
          "Example: “Music lover” becomes “Currently on week three of one album and not sorry.”",
          "Example: “Funny” becomes “I tell the same two jokes at every party. One lands.”",
          "Example: “Adventurous” becomes “Tried surfing once. Still have the sunburn story.”",
          "Example: “Looking for my partner in crime” becomes “Looking for someone to split a very large pizza with.”"
        ]
      },
      {
        title: "Mistakes that sneak back in",
        paragraphs: [
          "Lists of three adjectives. Lists of things you hate. Lines about what you don't want. Text about being “tired of games.” These do the opposite of a hook. Another common one is length: a block of text is skipped, but two or three short lines get read."
        ]
      },
      {
        title: "Check it against reality",
        paragraphs: [
          "Everything in the bio should be something you'd happily talk about for five minutes. If you wrote that you love Lisbon, expect questions about Lisbon. If you can't answer them, that's your sign to pick a different detail.",
          "For more bio structure ideas on another app, the Tinder bio guide uses a similar pattern."
        ]
      },
      {
        title: "Bios for different kinds of guys",
        paragraphs: [
          "The structure works for any personality, you just fill it differently. A quiet reader might write the fact as a book they keep re-reading. A man who plays five-a-side football might make the opinion about who really owns the goalkeeper's gloves. The hook can be a question, a challenge or a mild complaint.",
          "What matters is that every line could only have been written by you. If a friend could read your bio and not recognise you, rewrite one line until they would."
        ],
        example: {
          label: "Example",
          text: "“I coach under-10s football on Saturdays. Strong opinion: orange slices at half time beat any sports drink. Convince me otherwise.”"
        }
      },
      {
        title: "Editing down",
        paragraphs: [
          "After you write three drafts, read them aloud and keep the line that made you smile. Cut anything that sounds like a dating-app bio, which includes the word “looking” more than once. Read the final version one more time as if you were her, on her phone, between two other chats. Would you stop?",
          "If the answer is no, the fix is almost always a more specific noun. Swap “music” for the band, “food” for the dish, “sports” for the team you suffer with."
        ]
      }
    ],
    checklist: [
      "My bio has one fact, one opinion and one hook",
      "I removed generic words like “adventurous” and “foodie”",
      "Every detail is true and easy to talk about",
      "The whole thing is short enough to read in seconds",
      "There are no lists of what I don't want",
      "A stranger could reply to it with a real question"
    ],
    faqs: [
      {
        question: "What should a guy put in a Bumble bio?",
        answer:
          "A real, specific detail, a small opinion and a hook she can respond to. Keep it short and true."
      },
      {
        question: "Is it okay to leave the bio blank?",
        answer:
          "You can, but a blank bio gives people nothing to open with. Even a couple of specific lines helps."
      },
      {
        question: "Can NoSwipe write my Bumble bio?",
        answer:
          "Yes. NoSwipe writes your Bumble bio from what you tell it and puts it on your profile. You can edit it any time."
      }
    ],
    relatedSlugs: ["tinder-bio-for-men", "how-to-get-more-bumble-matches", "dating-profile-audit-checklist"]
  },
  {
    slug: "move-from-app-to-number",
    title: "How to move from a dating app to a number without being weird",
    eyebrow: "App to number",
    description:
      "Timing signals, the plan-first approach and what to say if she'd rather stay on the app, so moving to texting feels natural rather than pushy.",
    intro:
      "Asking for a number in your second message feels like a request for access. Asking after a plan feels like logistics. The order matters more than the wording.",
    readingTime: "5 min read",
    publishedIso: "2026-10-30",
    sections: [
      {
        title: "Why the timing feels delicate",
        paragraphs: [
          "A phone number is personal. Some people hand it over quickly, others want to meet first, and many prefer to keep chatting inside the app for safety or just habit. None of those is wrong. Your job is to make the request easy to say yes or no to.",
          "Don't ask in the first few messages. Let the conversation have some back and forth first."
        ]
      },
      {
        title: "Signals that it might be time",
        paragraphs: [
          "Look for ease rather than a magic number of messages. She asks you questions back. Replies are getting longer. She mentions something about her week without being asked. Maybe you've already joked about meeting."
        ],
        bullets: [
          "Both of you are asking questions",
          "Replies come fairly regularly, even if not instantly",
          "One of you has mentioned meeting or a place",
          "The tone is warm and not purely polite"
        ]
      },
      {
        title: "Plan first, number second",
        paragraphs: [
          "The easiest route: suggest a specific plan, then mention that texting would be simpler for logistics. The number becomes a means to an end, not a favour you're asking."
        ],
        example: {
          label: "Example",
          text: "“Thursday at 7 for a drink near the station? If that works, easier to swap numbers than do this over the app.”"
        }
      },
      {
        title: "If she'd rather stay on the app",
        paragraphs: [
          "Take it at face value. A good answer is short and relaxed. Then keep the plan going on the app, or revisit the number question after you've met."
        ],
        example: {
          label: "Example",
          text: "“Totally fine, we'll stay here. Does Thursday still work for you?”"
        }
      },
      {
        title: "What not to do",
        paragraphs: [
          "Don't ask for the number as the opening line of your second message. Don't ask again after a no. Don't send a message that makes her feel rude for staying on the app. And don't offer yours with a guilt trip attached. Handing over yours without pressure is fine; expecting an exchange isn't.",
          "The guide on asking her out has more on wording the plan itself."
        ]
      },
      {
        title: "Why some people stay on the app on purpose",
        paragraphs: [
          "An app is a buffer. Matches can unmatch if something feels off, and your phone number can't be unshared. Many people stay in-app until they've met, or until they've seen a bit more of you. That's sensible, not cold.",
          "Respecting it costs you nothing and builds trust. A person who answers “I'd rather stay here for now” with “no problem” has just passed an unspoken test."
        ]
      },
      {
        title: "Sharing yours instead of asking for hers",
        paragraphs: [
          "If you'd like to offer your number, do it casually and without expectation. A short line works, and she can use it or not. Never attach an obligation to it.",
          "Make sure you're happy for her to have it. Only share a number you'd be fine seeing on a message from someone you never end up meeting, and consider whether a separate number is worth setting up."
        ],
        example: {
          label: "Example",
          text: "“If it's easier to text on the day, here's my number. No pressure, we can keep chatting here too.”"
        }
      },
      {
        title: "A short sample conversation",
        paragraphs: [
          "Here is how it can sound when it goes smoothly. You've been chatting for a few days about climbing gyms. You suggest a Thursday coffee near her side of town. She says yes and picks the cafe. You say you'll text her the details on the day if she wants to share a number, and leave the choice open.",
          "Notice that nobody was cornered. The number came after the plan, the choice stayed with her, and the app remained a perfectly good fallback."
        ],
        example: {
          label: "Example",
          text: "You: “There's a bouldering gym on Mill Street with a decent cafe. Thursday at 6?” Her: “Sounds good!” You: “Great. Easier to text on the day, but only if you're happy to swap. Otherwise I'll message here.”"
        }
      }
    ],
    checklist: [
      "We've had a real back-and-forth first",
      "I suggested a specific plan",
      "The number request is about logistics",
      "I phrased it so she can say no easily",
      "I'm fine continuing on the app",
      "I haven't asked twice"
    ],
    faqs: [
      {
        question: "How soon should I ask for her number?",
        answer:
          "No fixed time works for everyone. Wait for a natural back-and-forth and ideally attach the request to a plan."
      },
      {
        question: "What if she says no?",
        answer:
          "Accept it, say something relaxed, and keep chatting on the app. Don't ask again."
      },
      {
        question: "Can NoSwipe help me word the ask?",
        answer:
          "Yes. NoSwipe words the invitation as you from the conversation, and when a date is booked it appears in your Dates tab."
      }
    ],
    relatedSlugs: ["when-to-ask-her-out", "first-date-planning", "text-before-first-date"]
  },
  {
    slug: "dating-profile-audit-checklist",
    title: "Dating profile audit in 5 minutes: a checklist for men",
    eyebrow: "Profile audit checklist",
    description:
      "A five-minute checklist for men to audit a dating profile: first photo, face visibility, an activity photo, the bio, one prompt and a conversation hook.",
    intro:
      "You don't need an hour or a stranger's opinion to find the obvious problems in a profile. Open your own and run through six checks with a timer. Most profiles fail on the first two.",
    readingTime: "5 min read",
    publishedIso: "2026-10-30",
    sections: [
      {
        title: "Minute one: slot one",
        paragraphs: [
          "Look at your first photo at thumbnail size. Can you tell, in half a second, what you look like? One person, face visible, decent light, recent. If it's a group, a hat pulled low, or a long-distance shot, move it.",
          "If you can only fix one thing today, fix this."
        ]
      },
      {
        title: "Minute two: face visible, everywhere",
        paragraphs: [
          "Scroll the rest. Count how many photos show your face clearly. Sunglasses, helmets, masks and far-away shots all hide it. A couple are fine. If more than half of them hide you, people can't tell what they'd be meeting."
        ]
      },
      {
        title: "Minute three: an activity photo",
        paragraphs: [
          "At least one photo should show you doing something real. Cooking, climbing, playing an instrument, walking a dog. It gives people context and gives them something to ask about. It also saves you from a profile made entirely of posed selfies."
        ]
      },
      {
        title: "Minute four: the bio",
        paragraphs: [
          "Read it as a stranger. Is there one specific fact? One opinion? Or is it a list of adjectives? Replace anything vague with something concrete."
        ],
        example: {
          label: "Example",
          text: "Before: “Love to laugh, travel and try new things.” After: “Learning to make proper dumplings. Currently on attempt six. Recipe advice welcome.”"
        }
      },
      {
        title: "Minute five: one prompt, one hook",
        paragraphs: [
          "If your app has prompts, check at least one answer for a conversation hook: something she can reply to in a sentence. If it doesn't have any, make sure your bio contains one.",
          "Then close the app. Swapping photos every hour doesn't help. Make the fixes, leave it a week, and judge it afterwards."
        ]
      },
      {
        title: "A worked audit on a sample profile",
        paragraphs: [
          "Take a profile with a hat-and-sunglasses first photo, two photos from the same beach day, a bio that reads “Chill guy, love music, hit me up” and a single prompt. Run it through the minutes above. Minute one fails: the first photo hides the face. Minute two is borderline. Minute three has no clear activity. Minute four fails: nothing specific. Minute five passes, but only because of the prompt.",
          "Three fixes cover most of it. New first photo with eyes visible, replace one beach photo with something he actually does, and rewrite the bio around one real detail. That's an evening's work."
        ]
      },
      {
        title: "What to leave alone",
        paragraphs: [
          "Don't fiddle with settings you can't judge, and don't keep redoing photos before you've gathered a few days of feedback. If your matches are fine but conversations stall, the problem is probably your messages, not your profile. The guide on first messages is the next stop.",
          "An audit is a way of removing obvious problems, not a promise that the profile will work. People are different, and so are the apps they use."
        ]
      },
      {
        title: "When to ask someone else",
        paragraphs: [
          "A timer helps you find obvious problems, but you can't see yourself the way a stranger does. Show the profile to one friend who'll be honest, and ask a specific question: what's the first thing you'd guess about me? If the answer doesn't match how you'd describe yourself, you've found the gap.",
          "A review from someone outside your circle can also catch things friends are too polite to mention. Whoever you ask, make the changes yourself and keep what feels true."
        ]
      },
      {
        title: "How often to repeat it",
        paragraphs: [
          "Run the audit when something changes: a new photo, a new city, a long gap on the app. Otherwise a quick pass every couple of months is plenty. Constant tinkering makes it hard to tell what helped, and it keeps you on the app longer than you want to be.",
          "Write down what you changed and the date, even in a notes app. A week later you'll be glad you did."
        ]
      }
    ],
    checklist: [
      "First photo: one person, face visible, recent",
      "Most photos show my face clearly",
      "At least one photo shows me doing something real",
      "Bio has a specific fact and an opinion",
      "At least one prompt or bio line gives a conversation hook",
      "Everything is true and looks like me today"
    ],
    faqs: [
      {
        question: "How often should I audit my profile?",
        answer:
          "Every few months, or whenever you change a photo or notice a pattern like matches who never reply."
      },
      {
        question: "Which fix matters most?",
        answer:
          "Usually the first photo. If people can't quickly see what you look like, the rest of the profile doesn't get read."
      },
      {
        question: "Can NoSwipe audit my profile for me?",
        answer:
          "Yes. NoSwipe reviews your real photos and bio, fixes what hurts and sets the profile up for you. You can change anything yourself."
      }
    ],
    relatedSlugs: ["tinder-profile-review", "dating-app-photo-order-men", "dating-profile-mistakes-men"]
  }
];
