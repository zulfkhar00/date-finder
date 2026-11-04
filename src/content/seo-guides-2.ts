import type { Guide } from "@/content/guides";

const TINDER_TERMS = "https://tinder.com/terms/intl/en-GB/";
const HINGE_PROFILE_REFRESH = "https://hinge.co/newsroom/profile-refresh-guide";
const HINGE_HOW_WE_CONNECT = "https://hinge.co/how-we-connect-daters";

export const seoGuidesBatch2: Guide[] = [
  {
    slug: "dating-profile-mistakes-men",
    title: "Dating profile mistakes men make: 12 specific ones and the fix for each",
    eyebrow: "Profile mistakes",
    description:
      "Twelve specific dating profile mistakes men make, from sunglasses selfies to wedding crops and “love X, Y, Z” bios, with one practical fix for each.",
    intro:
      "Most profile problems are small, specific and fixable in an evening. Here are twelve that show up again and again, each with one thing to change. You probably have two or three of them. Most people do.",
    readingTime: "7 min read",
    publishedIso: "2026-10-30",
    sections: [
      {
        title: "Photo mistakes, part one",
        paragraphs: [
          "These are the ones people notice before they read a single word. Each one makes her work to figure out who you are."
        ],
        bullets: [
          "The sunglasses selfie as photo one. Fix: use a shot where your eyes are visible, in daylight.",
          "The crop from a wedding. A stranger's shoulder in the corner and a suit that isn't yours to frame. Fix: take a fresh photo in the same outfit, alone.",
          "A group photo first. She has to guess which one you are. Fix: move it to slot four or later.",
          "Three identical selfies. They add nothing new. Fix: keep the best one and replace the rest with different settings."
        ]
      },
      {
        title: "Photo mistakes, part two",
        paragraphs: [
          "These ones are quieter, but they still shape what she thinks she's agreeing to."
        ],
        bullets: [
          "A fish photo with no context. A big catch is a story, but the photo alone isn't. Fix: put it fourth and say something about it in your bio.",
          "Old photos. If you've changed a lot since, she'll notice on the first date. Fix: use pictures from the last year or so. Hinge's own refresh guide says not to use outdated photos.",
          "Photos that hide your face. Hinge's same guide says no photos that hide your face. Fix: limit hats, helmets and masks to one slot at most.",
          "Heavy filters. They set up a comparison you'll lose in person. Fix: natural light and no filter."
        ]
      },
      {
        title: "Bio mistakes",
        paragraphs: [
          "Bios fail in three main ways: they say nothing, they say too much, or they say what you don't want.",
          "“Love X, Y, Z.” A list of three nouns such as travel, food and fitness gives her nothing to reply to. Fix: pick one and say something specific about it. An empty bio and a wall of text fail in the same way, because neither is easy to respond to. And a list of rules or complaints reads as someone who's already annoyed."
        ],
        example: {
          label: "Example",
          text: "Before: “Love gym, food, travel.” After: “Saturday mornings are for the climbing gym, then eggs somewhere with terrible coffee. Recommend me better coffee.”"
        }
      },
      {
        title: "The ones nobody mentions",
        paragraphs: [
          "Two last mistakes. First, mismatched signals: a profile that looks like a gym ad but a bio that says you're a homebody. She'll believe the photos. Second, forgetting that an app needs to feel safe. Short, clear and honest beats mysterious.",
          "Fix both by checking that the photos, the bio and the person who turns up on Thursday all describe the same man."
        ]
      },
      {
        title: "How to fix them without redoing everything",
        paragraphs: [
          "Don't rebuild all at once. Start with photo one, then replace one repeated photo with a different setting, then rewrite the bio. If you want a fast pass, the five-minute audit checklist walks through the same ground in order.",
          "No fix guarantees more matches. What they do is remove reasons for people to scroll past, which is the part you can control."
        ]
      },
      {
        title: "How to pick which mistakes to fix first",
        paragraphs: [
          "Rank them by how early the viewer meets them. The first photo is seen before anything else, so any problem there beats a problem in the bio. After photos, fix the bio, then the details such as tone and length.",
          "If you only have an hour, replace the first photo and delete one repeated one. That alone changes what the opening of your profile says."
        ]
      },
      {
        title: "Mistakes that look like strengths",
        paragraphs: [
          "Some choices feel clever and read badly. An ironic bio that jokes about being a catch can sound defensive. A photo with an expensive car can suggest the car is the point. A long list of hobbies implies none of them is real.",
          "Ask yourself what a stranger would infer from each choice, not what you intended. The gap between those two is where most of these mistakes live."
        ]
      }
    ],
    checklist: [
      "My first photo shows my face, in daylight, alone",
      "No wedding crops or someone else's arm in frame",
      "Group photo is not first",
      "No more than one photo that hides my face",
      "Photos are recent and unfiltered",
      "Bio contains something specific she could ask about"
    ],
    faqs: [
      {
        question: "What is the most common dating profile mistake for men?",
        answer:
          "Hiding or obscuring the face in the first photo, usually with sunglasses, a group or distance. Fixing it is often the biggest single improvement."
      },
      {
        question: "Is a fishing photo a bad idea?",
        answer:
          "Not automatically. A fish photo with no context is hard to read. Put it later and give it a line in your bio."
      },
      {
        question: "Can NoSwipe tell me which of these apply to me?",
        answer:
          "Yes. NoSwipe reviews your profile, fixes what applies and sets up the new version. You can change anything yourself."
      }
    ],
    sources: [{ label: "Hinge: profile refresh guide", url: HINGE_PROFILE_REFRESH, kind: "platform-context" }],
    relatedSlugs: ["tinder-profile-review", "dating-app-photo-order-men", "dating-profile-audit-checklist"]
  },
  {
    slug: "tinder-vs-hinge-vs-bumble-for-men",
    title: "Tinder vs Hinge vs Bumble: which fits which kind of guy",
    eyebrow: "Tinder vs Hinge vs Bumble",
    description:
      "A qualitative comparison of Tinder, Hinge and Bumble for men: how each is laid out, who tends to message first, and a decision table to pick one.",
    intro:
      "There is no best dating app, only a better match between an app's layout and how you like to meet people. This is a qualitative comparison with no user statistics, because the numbers you see online are mostly marketing.",
    readingTime: "7 min read",
    publishedIso: "2026-10-30",
    sections: [
      {
        title: "How to read this comparison",
        paragraphs: [
          "Apps change features often, so treat each description below as the general shape, not a spec sheet. Open the app and see what it currently offers before you commit time to it. And availability depends on where you live.",
          "What follows is NoSwipe's editorial view of how the products feel to use, not a claim about who gets the most matches."
        ]
      },
      {
        title: "Tinder: fast, photo-first",
        paragraphs: [
          "Tinder is built around quick decisions on photos, with a short bio. That favours men who have strong, clear photos and who are comfortable sending a decent opener fast. It also means fast skimming, so a muddy first photo costs you.",
          "It's a reasonable pick if you want volume and don't mind a lot of silent matches. If you're after a bio-led conversation, it gives you less room."
        ]
      },
      {
        title: "Hinge: prompts and specifics",
        paragraphs: [
          "Hinge alternates photos with written prompts and lets people respond to a specific item. That rewards men who can write one funny or specific line and who like having something concrete to reply to. Hinge describes its recommendation approach on its own page, which is worth reading before assuming anything about how profiles are shown.",
          "It suits you if you'd rather answer a prompt than send a cold opener, and less if you dislike writing about yourself."
        ]
      },
      {
        title: "Bumble: a different rhythm for the first message",
        paragraphs: [
          "Bumble has historically been known for changing who starts the conversation in matches between men and women. Its options have shifted over time, so check what your current app shows you. If you prefer a slower start and don't want to craft cold openers, it may feel more comfortable.",
          "It can be quieter for men who like to initiate, and that is a feature or a bug depending on your temperament."
        ]
      },
      {
        title: "A decision table",
        paragraphs: [
          "Match your habits to the app. This is a rule of thumb, not a prediction."
        ],
        bullets: [
          "You have strong photos and like quick decisions: Tinder",
          "You enjoy writing a sentence or two and want conversation starters: Hinge",
          "You prefer a slower start and don't like cold openers: Bumble",
          "You are short on time: pick one, do it well, don't run three at once",
          "You are unsure: try one for a few weeks, then swap if it doesn't feel right"
        ]
      },
      {
        title: "Common mix-ups",
        paragraphs: [
          "People often assume one app is for hookups and another for relationships, but behaviour varies hugely by city, age and the individual. Treat that kind of labelling as a rumour. The only reliable test is to read profiles in your own area and notice what people say they want.",
          "Another mix-up is expecting to copy a profile across apps. A Tinder bio that works on a quick scroll can look thin on an app built around prompts. Adjust each profile to the format."
        ]
      },
      {
        title: "Switching and combining",
        paragraphs: [
          "If one app isn't working after a few weeks of honest effort, try another rather than doubling down. Delete or pause the old profile rather than leaving a dormant one that people may match with and never hear from.",
          "If you do run two apps, pick a cadence and keep each conversation straight. It's easy to mix up details across chats, and a wrong name or place is worse than a slow reply."
        ]
      }
    ],
    checklist: [
      "I picked an app based on how I like to meet people",
      "I checked the current features in the app itself",
      "I'm not running three apps half-heartedly",
      "My photos and prompts fit the app I chose",
      "I read the app's rules before I started",
      "I plan to review after a few weeks, not a few days"
    ],
    faqs: [
      {
        question: "Which dating app is best for men?",
        answer:
          "It depends on how you like to meet people. Tinder is quick and photo-led, Hinge uses prompts, and Bumble changes who writes first. There is no universal best."
      },
      {
        question: "Should I use all three at once?",
        answer:
          "It's usually better to do one app well than three badly, unless you have time to keep each profile and chat in good shape."
      },
      {
        question: "Does NoSwipe work with all three?",
        answer:
          "Yes. NoSwipe works with Tinder, Hinge and Bumble. You pick the apps, and you can pause any of them at any time."
      }
    ],
    sources: [
      { label: "Hinge: how we connect daters", url: HINGE_HOW_WE_CONNECT, kind: "platform-context" },
      { label: "Tinder Terms of Use", url: TINDER_TERMS, kind: "platform-context" }
    ],
    relatedSlugs: ["how-to-get-more-tinder-matches", "how-to-get-more-hinge-matches", "bumble-bio-for-men"]
  },
  {
    slug: "dating-with-a-busy-schedule",
    title: "Dating when you work 60 hours a week",
    eyebrow: "Dating while busy",
    description:
      "A 20-minute-a-week dating routine for busy men: batching replies, planning with a backup, and rescheduling politely when work wins.",
    intro:
      "If you work long hours, the problem isn't that you have no time. It's that dating asks for small bursts of attention at the worst moments. A routine that fits in about twenty minutes a week beats a burst of effort that fades by Thursday.",
    readingTime: "6 min read",
    publishedIso: "2026-10-30",
    sections: [
      {
        title: "Twenty minutes, split in three",
        paragraphs: [
          "Pick fixed slots instead of checking the app whenever you feel guilty. Something like ten minutes on a weekday evening, five on your commute, and five on Sunday. Put them in your calendar like any other meeting.",
          "The idea is to turn a vague worry into a small, finished task."
        ],
        bullets: [
          "Weekday evening, ten minutes: look at new profiles and reply to open chats",
          "Commute or lunch, five minutes: answer one or two messages",
          "Sunday, five minutes: pick the plan for the week"
        ]
      },
      {
        title: "Batch your replies",
        paragraphs: [
          "Answering every message the moment it arrives eats your day and trains you to treat the app as a notification. Reply in batches instead. Most people don't expect instant answers, and a thoughtful reply at 8pm beats a rushed one at 2pm.",
          "If you're stuck on what to say, a draft from a tool can get you unstuck, as long as you edit it and send it yourself."
        ]
      },
      {
        title: "Propose a plan early",
        paragraphs: [
          "Long chats cost time, and with a packed week they tend to fizzle. Once you've had a few exchanges, suggest a specific time. One date with a backup is worth ten weeks of messages.",
          "Offer two options so she isn't left to organise it. The first-date planning guide covers choosing a place."
        ],
        example: {
          label: "Example",
          text: "“I'm slammed this week but free Thursday after 7 or Sunday afternoon. Either work for a coffee near you?”"
        }
      },
      {
        title: "Plan with a backup",
        paragraphs: [
          "Work will overrun at least once. Build in a fallback when you set the plan: a second day, or a place close to the office. And decide ahead what you'll do if a meeting runs long, so you're not improvising by text from the lift.",
          "Don't schedule dates the night before a deadline. You'll be distracted and she'll notice."
        ]
      },
      {
        title: "Rescheduling without burning the match",
        paragraphs: [
          "If you have to move a plan, tell her as early as you can and give a real reason in one sentence. Offer a specific new time in the same message. Once is fine. Twice and it starts to look like a pattern, so be honest with yourself if the schedule won't allow dating right now.",
          "Being clear about your limits is better than overpromising and dropping out."
        ],
        example: {
          label: "Example",
          text: "“Really sorry, a client call has run into tonight. Could we do Saturday at 4 instead? Happy to pick the place.”"
        }
      },
      {
        title: "A realistic week",
        paragraphs: [
          "Monday you open the app for ten minutes during dinner and reply to two people. Wednesday on the train you answer one message and suggest a time to someone you've been chatting to. Sunday you take five minutes to look at the plan for Thursday and confirm the place.",
          "That's about twenty minutes, one date per week at most, and no guilt. Some weeks nothing happens. That's fine; the routine is what keeps you moving."
        ]
      },
      {
        title: "When work really is too much",
        paragraphs: [
          "There are seasons when long hours leave no room for anyone. It's honest to pause the apps rather than let chats drift. You can tell an active match, “I'm swamped for a couple of weeks, but I'd like to pick this up after.” Some will wait. Some won't. Both outcomes are fine.",
          "Better to be clear for a short while than to promise dates you'll cancel."
        ]
      },
      {
        title: "Choosing where to spend limited energy",
        paragraphs: [
          "When you have twenty minutes, spend them on people who already write back. A thoughtful reply to one engaged match beats five openers sent to people who may never see them. Put new swiping at the bottom of the list.",
          "That also protects your mood. A few real conversations feel better than a long scroll through profiles, and they move toward a date faster."
        ]
      }
    ],
    checklist: [
      "I blocked three short slots in my calendar",
      "I reply in batches rather than all day",
      "I suggest a specific time within a few messages",
      "Every plan has a backup day or location",
      "I give notice early if work changes things",
      "I reschedule at most once without a hard conversation"
    ],
    faqs: [
      {
        question: "How much time does dating need?",
        answer:
          "The messaging side can fit in a routine of around twenty minutes a week. Dates themselves take more, so plan for those separately."
      },
      {
        question: "Is it rude to reschedule?",
        answer:
          "Once, with early notice and a new time, is usually fine. Repeating it suggests dating isn't a priority right now."
      },
      {
        question: "Can NoSwipe save me time?",
        answer:
          "Yes. It swipes, opens chats and keeps them going as you, so you spend your time on the dates. You can read every chat and take over any time."
      }
    ],
    relatedSlugs: ["first-date-planning", "when-to-ask-her-out", "she-cancelled-first-date"]
  },
  {
    slug: "text-before-first-date",
    title: "How to text before a first date",
    eyebrow: "Texting before a date",
    description:
      "What to send before a first date: a short confirmation, a useful location detail, what not to send and how to handle a late “running 10 mins.”",
    intro:
      "The messages between agreeing a plan and meeting should do one job: make the meeting easy. They aren't the place for big jokes or deep conversation. Short, clear and warm is the target.",
    readingTime: "5 min read",
    publishedIso: "2026-10-30",
    sections: [
      {
        title: "The confirmation message",
        paragraphs: [
          "Send one the day before or the morning of, depending on when you made the plan. It confirms the time and place and gives her an easy chance to flag a problem. It also tells her you're real and reliable.",
          "Keep it light. Don't ask whether she's still coming in a way that sounds anxious."
        ],
        example: {
          label: "Example",
          text: "“Still good for 7 at the cafe on Mill Street tomorrow? Looking forward to it.”"
        }
      },
      {
        title: "A location detail that helps",
        paragraphs: [
          "If the place is hard to find, add a detail: which entrance, what you're wearing, where you'll be sitting. It spares both of you a few awkward minutes of looking around. Be specific but brief.",
          "If she's travelling a long way, offer to meet somewhere more convenient for her."
        ],
        example: {
          label: "Example",
          text: "“I'll be at the table by the window. Green jacket, so easy to spot.”"
        }
      },
      {
        title: "What not to send",
        paragraphs: [
          "Skip long nervous paragraphs, jokes that depend on tone, and anything that tries to preview the whole evening. Don't send a run of messages the day of. Don't ask for photos to “check” it's her. And avoid anything that adds pressure, such as plans for afterwards.",
          "If you feel the urge to send more, ask whether it makes the meeting easier. If it doesn't, save it for the table."
        ]
      },
      {
        title: "Handling “running 10 mins late”",
        paragraphs: [
          "Reply with something calm and short. Don't sulk, don't joke about it, and don't ask why. Ten minutes is common. If she's later than that or doesn't say how late, check in once, politely.",
          "Use the time to settle in. Order a drink, find the table, and don't spend it re-reading the chat."
        ],
        example: {
          label: "Example",
          text: "“No worries, I'll grab a table. See you soon.”"
        }
      },
      {
        title: "If plans change on the day",
        paragraphs: [
          "If you need to move the time, tell her as early as you can. If she does, take her at her word. More on that in the guide on handling cancellations. Keep your own messages the same tone, whatever happens."
        ]
      },
      {
        title: "A full example of the exchange",
        paragraphs: [
          "Plans are set on Monday for Thursday. On Thursday morning you send the confirmation. She replies with a thumbs-up and says she might be a few minutes late because of the bus. You answer once and leave it.",
          "That's the entire pre-date conversation: three messages. Everything else can wait until you're face to face, which is where the conversation is easier anyway."
        ],
        example: {
          label: "Example",
          text: "You: “Still on for 7 at the cafe on Mill Street? I'll be at the window table.” Her: “Yes! Might be 5 mins late, bus.” You: “No worries, see you there.”"
        }
      },
      {
        title: "Nerves are normal",
        paragraphs: [
          "If you feel the urge to send something clever to warm things up, resist. A message that tries hard can raise the stakes before the date has started. Do something else instead: go for a short walk, eat something, and arrive on time.",
          "If she seems anxious, a plain kind line helps more than a joke."
        ],
        example: {
          label: "Example",
          text: "“Looking forward to it. Nothing fancy, just a coffee and a chat.”"
        }
      },
      {
        title: "Safety and practicalities",
        paragraphs: [
          "It's reasonable for either of you to tell a friend where you'll be. It's also reasonable to arrive and leave on your own. You don't need to message her about any of this beyond the plan itself, but if she mentions she's sharing her location with a friend, take it in your stride.",
          "If you're driving, say roughly how long you'll be. If you're running late, tell her as soon as you know, with an honest time. A short, early message is always better than a long apology afterwards."
        ]
      }
    ],
    checklist: [
      "I sent one short confirmation",
      "I mentioned a useful location detail",
      "I didn't send a stream of messages that day",
      "I replied calmly if she was late",
      "I have the final place and time written down",
      "I wrote the day-of messages myself"
    ],
    faqs: [
      {
        question: "Should I text before a first date?",
        answer:
          "One short confirmation is usually enough. It checks the plan and gives her an easy way to flag problems."
      },
      {
        question: "How late is too late?",
        answer:
          "Ten minutes is common. If she's much later or hasn't said how long, one polite check-in is reasonable."
      },
      {
        question: "Can NoSwipe draft the confirmation?",
        answer:
          "Yes. NoSwipe confirms plans as you in the chat, and you can take over to say it yourself."
      }
    ],
    relatedSlugs: ["first-date-planning", "when-to-ask-her-out", "she-cancelled-first-date"]
  },
  {
    slug: "she-cancelled-first-date",
    title: "What to do when she cancels or reschedules a first date",
    eyebrow: "Cancelled first date",
    description:
      "How to reply calmly when she cancels, offer one new time, spot the signal in repeated reschedules and avoid taking it personally.",
    intro:
      "You booked the table, picked the shirt, and then the message arrived. It stings, but how you answer matters more than the cancellation does. Calm, brief and open to a new time is the whole playbook.",
    readingTime: "5 min read",
    publishedIso: "2026-10-30",
    sections: [
      {
        title: "First, the reply you want to send",
        paragraphs: [
          "Wait a few minutes before answering. Then keep it short and kind. Acknowledge, offer one new time, and leave it with her. You don't need to ask why or show how disappointed you are."
        ],
        example: {
          label: "Example",
          text: "“No problem, thanks for letting me know. If you'd still like to meet, I'm free Saturday afternoon. No pressure either way.”"
        }
      },
      {
        title: "Offer one new time, not three",
        paragraphs: [
          "One specific suggestion makes it easy to say yes. A list of options turns it into homework. If she replies with a different time, take it. If she doesn't reply, don't push for an answer.",
          "Keep the place the same unless she wants to change it."
        ]
      },
      {
        title: "How to read a reschedule",
        paragraphs: [
          "One cancellation is just life: illness, work, a friend in crisis. Two begin to look like a signal, especially if neither comes with a new time from her. That doesn't make her a bad person. It suggests she's less sure than you are.",
          "Decide in advance how many reschedules you're willing to accept. Two is a common limit, and that's your call."
        ]
      },
      {
        title: "Not taking it personally",
        paragraphs: [
          "Cancellations rarely tell you anything about your worth. People get nervous, double-book, or realise they're not ready. It stings because you'd invested a bit of hope, not because you did anything wrong.",
          "Do something with the evening. Meet a friend, go for a run, cook the dinner you were going to skip. And keep other conversations alive so one plan doesn't carry all the weight."
        ]
      },
      {
        title: "What not to send",
        paragraphs: [
          "Skip guilt (“I rearranged my whole day”), sarcasm, and the long message about how you feel. If she comes back later, it will be to the version of you who stayed relaxed.",
          "If you want help with tone, the guide on texting before a date covers the same calm register."
        ]
      },
      {
        title: "A worked example of a reschedule",
        paragraphs: [
          "She cancels an hour before: “So sorry, I'm not feeling well. Can we do another day?” You reply with a short line wishing her well and suggest next week. She picks Wednesday and you confirm it. The date happens, and the cancellation never comes up again.",
          "That's the common version. It works because nobody made it into an event."
        ]
      },
      {
        title: "If she stops replying",
        paragraphs: [
          "Sometimes a cancellation is followed by silence. Send one friendly message a few days later with a specific new time. If you don't hear back, stop. The guide on matches who go quiet covers the follow-up in more detail.",
          "Don't delete the memory of the plan out of frustration, and don't take it as a statement about you. Just move to the next conversation."
        ]
      },
      {
        title: "Telling a real reason from a soft no",
        paragraphs: [
          "Real reasons usually come with a new suggestion or an offer to find another time. Soft noes tend to be vague: “things are crazy, will let you know.” You can't be sure, and you don't have to be. Treat the offer to reschedule as sincere if she makes one, and treat silence as an answer if she doesn't.",
          "Your own comfort matters too. If a cancellation tells you she's not as keen as you hoped, it's fine to step back. You don't owe anyone endless patience, and you don't owe them a speech either."
        ]
      },
      {
        title: "Keeping your own plans",
        paragraphs: [
          "Don't clear your whole evening for a date that might move. Keep a book, a friend or a gym session in your back pocket so a cancellation just redirects the night. It also helps your reply: you're more relaxed when the evening isn't riding on one yes.",
          "If you'd travelled somewhere for it, treat the trip as something to enjoy anyway. Walk around, eat somewhere you like, and head home."
        ]
      }
    ],
    checklist: [
      "I waited a few minutes before replying",
      "My reply is short and kind",
      "I offered one new time",
      "I didn't ask her to justify it",
      "I set my own limit for reschedules",
      "I kept other chats going"
    ],
    faqs: [
      {
        question: "Should I reschedule after she cancels?",
        answer:
          "Offering one new time is reasonable. If she doesn't respond, let it go."
      },
      {
        question: "How many reschedules are too many?",
        answer:
          "That's up to you. Many people draw the line at two, especially if she doesn't suggest the new times."
      },
      {
        question: "Can NoSwipe draft a reply to a cancellation?",
        answer:
          "Yes. NoSwipe replies as you, graciously, and offers a new time. You can take over the chat."
      }
    ],
    relatedSlugs: ["first-date-planning", "when-to-ask-her-out", "text-before-first-date"]
  },
  {
    slug: "dating-bio-for-introverts",
    title: "Dating bio for introverts: say something real, not “I'm shy”",
    eyebrow: "Bio for introverts",
    description:
      "Why “I'm shy” reads as a disclaimer, three rewrites that show quiet confidence, and how to use a quiet hobby as a conversation hook.",
    intro:
      "If you're quiet, you'll be tempted to say so up front. “I'm shy, but...” Understandable, but it works like an apology. Show what a good evening with you looks like and let the quiet speak for itself.",
    readingTime: "5 min read",
    publishedIso: "2026-10-30",
    sections: [
      {
        title: "Why “I'm shy” backfires",
        paragraphs: [
          "It tells her what to expect before she's met you, and it turns your first impression into a warning label. She may take it kindly, but she has no reply to it. What do you say to “I'm shy”? “That's okay”?",
          "Being introverted isn't a flaw to explain. It's a style, and it comes with strengths: attention, listening, depth. Write from those."
        ]
      },
      {
        title: "Three rewrites",
        paragraphs: [
          "Each one swaps the disclaimer for a detail she can respond to."
        ],
        bullets: [
          "Example: “I'm shy until you get to know me” becomes “Best conversations happen on long walks. Bring a podcast recommendation.”",
          "Example: “Introvert, don't like crowds” becomes “Happiest with four friends and one very good board game.”",
          "Example: “Not good at small talk” becomes “Skip the weather. Tell me what you'd cook if you had to impress someone.”"
        ]
      },
      {
        title: "Use a quiet hobby as a handle",
        paragraphs: [
          "Reading, baking, climbing, a small garden, a long-running game with friends: these are all good hooks because they belong to you and invite questions. Name the specific thing, not the category."
        ],
        example: {
          label: "Example",
          text: "“Third attempt at a sourdough that doesn't collapse. Currently losing, but it tastes fine.”"
        }
      },
      {
        title: "Let the profile do the extroverted work",
        paragraphs: [
          "If starting conversations is draining, make your profile start them for you. A clear question in the bio gives her an easy way in. Add one prompt answer that shows humor. The more she can learn from the page, the less you have to perform in the first messages.",
          "That also lets you save your energy for the date itself."
        ]
      },
      {
        title: "Be honest about pace",
        paragraphs: [
          "You don't need to announce it, but you can mention what suits you in plain, positive terms: a quiet cafe over a loud bar, a walk over a party. When you plan the date, pick that. For ideas, the first-date planning guide has low-pressure settings.",
          "Meeting people who enjoy that pace is the goal, not winning everyone."
        ]
      },
      {
        title: "What a quiet strength sounds like",
        paragraphs: [
          "Good listener, patient, thoughtful, loyal: these are common introvert traits, and they're hard to claim without sounding like a greeting card. Show them instead. A line about remembering how everyone takes their coffee says it better than the word “thoughtful”.",
          "Pick one trait and give it a small, true scene."
        ],
        example: {
          label: "Example",
          text: "“I remember how you take your coffee after hearing it once. Test me.”"
        }
      },
      {
        title: "Your photos can do the talking",
        paragraphs: [
          "If you're a quiet person, photos in a calm setting can carry your personality: a bookshop, a kitchen, a garden, a small gig. They tell her what an evening with you looks like. Add one photo with friends to show you do have a social side, even if it's small.",
          "Then pick a first-date idea that suits you, so the evening matches the profile."
        ]
      },
      {
        title: "Messages once you match",
        paragraphs: [
          "A good profile helps, but the first messages can still feel like a performance. Keep them short and anchored to something real in her profile. You don't need to be bubbly. A calm, specific question reads as interest, and many people find it a relief after a stream of generic openers.",
          "If long chats drain you, suggest meeting sooner rather than writing essays. A coffee for an hour often goes better than three weeks of texting, and you can always say you prefer talking in person."
        ],
        example: {
          label: "Example",
          text: "“Your bookshelf photo has two copies of the same novel. Is that a favourite or a mistake?”"
        }
      }
    ],
    checklist: [
      "No “I'm shy” or “introvert” as the opening line",
      "My bio names one specific quiet interest",
      "It includes an easy question she can answer",
      "I describe what I enjoy rather than what I avoid",
      "At least one photo shows me doing that interest",
      "My first-date suggestion fits how I like to meet"
    ],
    faqs: [
      {
        question: "Should I mention being introverted in my bio?",
        answer:
          "You can, but it works better as a description of what you enjoy than as a disclaimer. Show it through specific interests."
      },
      {
        question: "What if I'm bad at small talk?",
        answer:
          "Give her a hook in your bio so conversations start with something real, and suggest a setting where talking is easier."
      },
      {
        question: "Can NoSwipe write a bio for an introvert?",
        answer:
          "Yes. It writes options from what you tell it about your interests, and you can edit the bio any time."
      }
    ],
    relatedSlugs: ["tinder-bio-for-men", "hinge-prompts-for-men", "bumble-bio-for-men"]
  },
  {
    slug: "first-date-ideas-not-drinks",
    title: "First date ideas that aren't drinks: 12 low-pressure plans",
    eyebrow: "First date ideas",
    description:
      "Twelve low-pressure first date ideas beyond drinks, organised by time and budget, with notes on noise, easy exits and backup plans.",
    intro:
      "Drinks are the default because they're easy, not because they're good. A plan with something to look at or do gives you both a topic and an easy exit. Here are twelve, grouped by time and budget.",
    readingTime: "6 min read",
    publishedIso: "2026-10-30",
    sections: [
      {
        title: "What makes a first date plan work",
        paragraphs: [
          "Three things: you can hear each other, you can leave comfortably after an hour, and there's something to talk about that isn't an interview. Public places, daylight or an early evening, and a place both of you can reach on your own."
        ]
      },
      {
        title: "Under an hour, low cost",
        paragraphs: [
          "Short plans take pressure off. If it goes well you can always extend."
        ],
        bullets: [
          "Coffee and a walk through a nearby park",
          "A farmers' market or street market, where you can wander and sample",
          "Ice cream or a bakery run, then sit outside",
          "A bookshop or record shop browse, then a quick coffee"
        ]
      },
      {
        title: "One to two hours, a bit more effort",
        paragraphs: [
          "These give you an activity as the shared focus. Pick one that suits both of you."
        ],
        bullets: [
          "A gallery or small museum with a cafe",
          "Mini golf or a casual arcade",
          "A food hall where each of you picks something",
          "A walk to a viewpoint, with a drink or snack at the end"
        ]
      },
      {
        title: "Longer, only if the chat is going well",
        paragraphs: [
          "Save these for a second date or for when you've talked enough to know it'd be fun."
        ],
        bullets: [
          "A casual cooking class",
          "A short hike with a clear route and a shop at the end",
          "A matinee film, then dinner or coffee afterwards, so you can talk"
        ]
      },
      {
        title: "Noise, exits and a backup",
        paragraphs: [
          "Check the venue's noise level in advance. If it's hard to hear, pick somewhere else. Have a simple way to end it: “I have an early start, this was lovely.” And pick a backup, such as a covered cafe near the park, in case of rain.",
          "Send her a clear time and place afterwards, as described in the guide on texting before a date. When you suggest the plan, offer one idea and let her adjust it."
        ],
        example: {
          label: "Example",
          text: "“Want to wander the Saturday market and grab something to eat? If it rains, there's a coffee place right beside it.”"
        }
      },
      {
        title: "Matching the plan to the conversation",
        paragraphs: [
          "Use what you've learned in the chat. If she mentioned she loves food markets, suggest the market. If she's into books, a bookshop and a coffee next door. A plan that picks up something she said shows you listened, and it makes yes easier.",
          "If you've learned nothing specific, a coffee and a walk is hard to get wrong."
        ],
        example: {
          label: "Example",
          text: "“You said you've been meaning to try the new pottery cafe. Want to go Saturday afternoon? We could just have a coffee if painting a mug sounds like too much.”"
        }
      },
      {
        title: "Budget and logistics",
        paragraphs: [
          "Keep it affordable for both of you and don't make her travel far. If you pay for the first round, do it lightly and without making it a statement. If she offers to split, accept gracefully.",
          "Check opening hours, and look at the weather the day before. Little things going wrong are fine, but a locked door is avoidable."
        ]
      },
      {
        title: "Making the invitation easy to accept",
        paragraphs: [
          "The invitation should name the activity, the place and a time or two. Avoid asking her to design the date. “What do you want to do?” puts the work on her, while “Saturday afternoon at the market, around 2?” is easy to answer yes or no to.",
          "Keep the tone relaxed and leave room to adjust. If she suggests something different, take it as a good sign. She's invested enough to plan."
        ]
      }
    ],
    checklist: [
      "The place is public and I can reach it independently",
      "We can hear each other",
      "There is something to look at or do",
      "I picked a length that's easy to extend or end",
      "I have a backup for weather",
      "I offered one idea and left room for her to change it"
    ],
    faqs: [
      {
        question: "What's a good first date that isn't drinks?",
        answer:
          "A market walk, coffee and a park stroll, a small gallery or a bookshop browse. Public, short and easy to extend."
      },
      {
        question: "How long should a first date be?",
        answer:
          "An hour or two is usually enough. Shorter plans leave room to extend if it goes well."
      },
      {
        question: "Can NoSwipe plan the date?",
        answer:
          "Yes. It suggests a plan from the chat, and when a date is booked it appears in your Dates tab."
      }
    ],
    relatedSlugs: ["first-date-planning", "when-to-ask-her-out", "text-before-first-date"]
  },
  {
    slug: "why-hey-gets-ignored",
    title: "Why “hey” gets ignored (and what to send instead)",
    eyebrow: "Why “hey” fails",
    description:
      "Why a bare “hey” gets ignored on dating apps, three upgrades that cost you ten seconds, and an honest note that no opener guarantees a reply.",
    intro:
      "“Hey” isn't rude. It's just work. It hands her the job of starting the conversation, and most people won't take the job. Three small upgrades fix it without turning you into a stand-up comedian.",
    readingTime: "5 min read",
    publishedIso: "2026-10-30",
    sections: [
      {
        title: "What “hey” costs her",
        paragraphs: [
          "Think of her inbox. A message that says “hey” needs her to think of a reply, guess your tone and come up with something to ask. Multiply that by everyone who sent the same word. A reply that takes effort is the one that gets left until later, and later often means never.",
          "It's not personal, and it's not that she dislikes you. There's simply nothing in the message to grab."
        ]
      },
      {
        title: "Upgrade one: reference something real",
        paragraphs: [
          "Mention one detail from her profile. It proves you looked and gives her a topic. Keep it specific."
        ],
        example: {
          label: "Example",
          text: "“Hey, the cat in photo three looks like he's judging the photographer. Does he judge you too?”"
        }
      },
      {
        title: "Upgrade two: ask one easy question",
        paragraphs: [
          "Make the question answerable in a sentence. Questions like “what do you do for fun?” sound like a form. Pick a narrow one with a clear answer, and a slightly playful angle if it fits."
        ],
        example: {
          label: "Example",
          text: "“Quick one: best thing you've eaten this month?”"
        }
      },
      {
        title: "Upgrade three: show a bit of you",
        paragraphs: [
          "Give a small opinion or a one-line joke, so she gets a sense of your voice. Don't try to be the funniest person she's met. You're only showing that someone real is on the other end.",
          "For more patterns tied to specific photos, the opener examples guide is a good companion."
        ],
        example: {
          label: "Example",
          text: "“Controversial take: pineapple belongs on pizza, and your hiking photos belong on a poster. Where was the third one taken?”"
        }
      },
      {
        title: "An honest note",
        paragraphs: [
          "A better opener raises the odds a little, but it won't guarantee a reply. Plenty of good messages go unanswered because she's busy, not checking the app, or has moved on. Judge your openers over a handful of chats, not one.",
          "If several well-built openers get nothing, check your profile before rewriting your messages."
        ]
      },
      {
        title: "A before-and-after",
        paragraphs: [
          "Before: “hey”. After: “Hey, the lake photo looks freezing. Was the swim voluntary?” The second takes ten seconds to write and gives her something to answer in a line.",
          "Notice what changed: a detail from her profile, a tiny joke, an easy question. None of it is clever. It just proves a person read her profile."
        ],
        example: {
          label: "Example",
          text: "Before: “Hey”. After: “Hey, is that a real Aga in the background or a very convincing prop?”"
        }
      },
      {
        title: "Why not just go with “hi, how are you?”",
        paragraphs: [
          "It has the same problem in a politer form. “Fine, you?” is the only reply, and then you're both stuck. Starting with a question about her life in general makes her do the work of choosing what to say.",
          "A narrower question with a visible reason behind it is almost always easier to answer."
        ]
      },
      {
        title: "What if she answers “hey” anyway?",
        paragraphs: [
          "Sometimes a bare “hey” gets a reply, and that's fine. It doesn't mean the opener was good, it means she was in a chatty mood. You'll still need to carry the conversation, and now you're starting from nothing.",
          "Treat any reply as a chance to be more specific on your next message. Pick something from her profile and ask about it, the way you would have in the first place."
        ]
      },
      {
        title: "How long it should take",
        paragraphs: [
          "A good opener should take about as long to write as it takes to read: under a minute. If you're agonising over it, it's probably too clever. Pick one detail, one question, send it, and move on to the next conversation.",
          "Spending your energy across several chats beats polishing one message for an hour."
        ]
      }
    ],
    checklist: [
      "I mention one real detail from her profile",
      "I ask one question she can answer in a sentence",
      "There's a small hint of my own voice",
      "The message is short",
      "I'm not copying a line from the internet",
      "I judge results over several chats"
    ],
    faqs: [
      {
        question: "Is it bad to open with “hey”?",
        answer:
          "It isn't offensive, but it asks her to do all the work. A short message with a specific detail and a question usually gets more attention."
      },
      {
        question: "Does a better opener guarantee a reply?",
        answer:
          "No. It makes replying easier, but she may be busy, inactive or uninterested."
      },
      {
        question: "Can NoSwipe suggest openers?",
        answer:
          "Yes. It opens chats as you, from their profile. You can read and take over."
      }
    ],
    relatedSlugs: ["first-message-after-match", "dating-message-help", "opener-examples-by-photo"]
  },
  {
    slug: "double-texting-dating-apps",
    title: "Double texting on dating apps: when it's fine",
    eyebrow: "Double texting",
    description:
      "When a second message makes sense on a dating app, when it reads as pressure, and a clearly-labelled opinion on how long to wait.",
    intro:
      "“Never double text” is advice that sounds firm and falls apart in real life. The better question is whether your second message gives her something new. If it does, send it. If it only repeats the first, don't.",
    readingTime: "5 min read",
    publishedIso: "2026-10-30",
    sections: [
      {
        title: "What double texting actually is",
        paragraphs: [
          "It's sending another message before she has answered the last one. On its own that's neutral. Friends do it constantly. It becomes a problem when the second message exists to ask why she hasn't replied.",
          "So the useful test is purpose, not timing."
        ]
      },
      {
        title: "When a second message makes sense",
        paragraphs: [
          "Send one when you have something new to add. That might be a plan, a detail you forgot, or a link to the thing you were talking about."
        ],
        bullets: [
          "You're proposing a specific plan you hadn't mentioned yet",
          "You remembered the answer to something she asked",
          "A relevant new detail came up, such as the band she mentioned is playing nearby",
          "The first message was a question and the second corrects an obvious mistake"
        ],
        example: {
          label: "Example",
          text: "First message: “That ramen place is on my list.” Second, later: “Update: they're open Sundays now. Want to go this weekend?”"
        }
      },
      {
        title: "When it reads as pressure",
        paragraphs: [
          "A second message that says “??”, “hello?” or “did you see my message?” asks her to account for her time. So does the third in a row. Even a friendly tone can't hide that you're counting.",
          "If you find yourself checking the chat after sending, you're about to send the wrong one."
        ]
      },
      {
        title: "A 48-hour rule of thumb (opinion)",
        paragraphs: [
          "This is NoSwipe's opinion, not a rule from any app or study. If she hasn't answered and you want to follow up with something new, waiting around two days feels natural to most people. A shorter wait is fine if you're making a plan; a longer one can make the message feel random.",
          "Adjust for your own situation. If you've been messaging all day and she goes quiet for an hour, don't count that."
        ]
      },
      {
        title: "After the second message",
        paragraphs: [
          "If she answers, great. If not, let it be. The guide on matches who stop replying covers what to do next, including how to leave the chat without drama."
        ]
      },
      {
        title: "Double texting after a first date",
        paragraphs: [
          "After a date, a second message is much less of a problem. If you had a good time, say so, and if you'd like to see her again, suggest it. If she hasn't replied after a day or two, one gentle message is still fine.",
          "What isn't fine is repeated check-ins. If you've said you enjoyed it and suggested a plan, you've done your part."
        ],
        example: {
          label: "Example",
          text: "“Had a good time on Thursday. Want to do the market next weekend?”"
        }
      },
      {
        title: "How to avoid sending a message you regret",
        paragraphs: [
          "If you're tempted to send a second one out of anxiety, write it in your notes app and leave it for an hour. If it still adds something new, send it. If not, delete it.",
          "Notice how often the urge fades by itself. Most of the time the message was for you, not for her."
        ]
      },
      {
        title: "Context changes the rule",
        paragraphs: [
          "On a dating app, people check in and out. Someone might open the app once a day or once a week, and some only reply when they're at a desk. A second message from you won't be seen any sooner, so there's rarely a reason to send it quickly.",
          "If she tends to answer within the hour and then goes silent for a day, that's a change worth noticing but not worth chasing. Use the extra time for something else and let the next move be hers."
        ]
      },
      {
        title: "If you're the one being double texted",
        paragraphs: [
          "It works both ways. If a match sends a second message before you answer, you don't owe an instant reply. Take it as interest, not pressure, unless it turns into a pile of questions about why you haven't answered. You're allowed to say you've been busy and pick up where you left off, or to step away.",
          "Remembering how that feels is the quickest way to calibrate your own habits."
        ]
      }
    ],
    checklist: [
      "My second message adds something new",
      "It doesn't mention that she hasn't replied",
      "I waited a sensible amount of time unless I was making a plan",
      "I didn't send a third message",
      "I'm not checking the chat every few minutes",
      "I'm fine with no response"
    ],
    faqs: [
      {
        question: "Is double texting bad?",
        answer:
          "Not by itself. It's a problem when the second message exists to chase an answer. If it adds something new, it's usually fine."
      },
      {
        question: "How long should I wait before a second message?",
        answer:
          "About two days is a common rule of thumb, and it's only an opinion. A plan can justify a shorter wait."
      },
      {
        question: "Can NoSwipe draft a follow-up?",
        answer:
          "Yes. NoSwipe follows up as you, in your voice, and you can read the chat and take over any time."
      }
    ],
    relatedSlugs: ["first-message-after-match", "when-to-ask-her-out", "match-stopped-replying"]
  }
];
