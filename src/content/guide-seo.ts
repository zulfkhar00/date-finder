/**
 * One realistic long-tail query per guide. `metaTitle` is the <title> text
 * (the layout template appends " — NoSwipe", so keep it at 50 chars or less
 * to land at 60 or under), `h1` is the on-page heading and `intro` opens with
 * the query phrased naturally. Article bodies are untouched.
 */
export type GuideSeo = {
  query: string;
  metaTitle: string;
  h1: string;
  description: string;
  intro: string;
};

export const guideSeo: Record<string, GuideSeo> = {
  "tinder-profile-review": {
    query: "how to tell if my tinder profile is good",
    metaTitle: "Is My Tinder Profile Good? A Simple Review",
    h1: "Is your Tinder profile good? How to review it yourself",
    description: "Wondering if your Tinder profile is any good? Check your first photo, photo order and bio with this practical review, no fake photos or promises.",
    intro: "If you are wondering whether your Tinder profile is good, ask three things: can someone tell what you look like, can they picture spending time with you, and is there an easy reason to start a conversation? Review the whole sequence, not each photo in isolation."
  },
  "hinge-prompt-help": {
    query: "what to write for hinge prompts",
    metaTitle: "What to Write for Hinge Prompts, With Examples",
    h1: "What to write for your Hinge prompts",
    description: "Not sure what to write for Hinge prompts? Pick prompts that do different jobs and write specific answers in your own voice, with examples.",
    intro: "Not sure what to write for your Hinge prompts? Skip the attempt to summarize your whole personality. Good answers reveal one specific thing, in your natural voice, that hands a match an obvious opening line."
  },
  "dating-message-help": {
    query: "what to text a girl on a dating app",
    metaTitle: "What to Text a Girl on a Dating App",
    h1: "What to text a girl on a dating app",
    description: "What to text a girl on a dating app: a simple way to write openers, replies and the invite from what she actually said, not copied pickup lines.",
    intro: "What do you text a girl on a dating app when you want it to sound like you? Start from the conversation you are actually having, keep her boundaries in mind and write in your own voice. The aim is a clear, human exchange, not a perfect line or a message sent without your say-so."
  },
  "first-date-planning": {
    query: "how to plan a first date",
    metaTitle: "How to Plan a First Date: Place, Time, Invite",
    h1: "How to plan a first date without overthinking it",
    description: "How to plan a first date: pick a simple venue, suggest a time and duration, word a clear invite and confirm the details, plus a short checklist.",
    intro: "Wondering how to plan a first date? You do not need an elaborate surprise. You need a place, a time, a rough duration and an easy way for both people to say yes or suggest a change. Specific enough to feel real, flexible enough to be comfortable."
  },
  "how-to-get-more-tinder-matches": {
    query: "how to get more matches on tinder as a guy",
    metaTitle: "How to Get More Matches on Tinder as a Guy",
    h1: "How to get more matches on Tinder as a guy",
    description: "Getting few matches on Tinder? Check your settings, fix photo one, order the rest of your profile and use the app on purpose. No hacks.",
    intro: "If you want more matches on Tinder as a guy, do not change everything at once or hunt for a swipe hack. Check whether your profile is shown to the people you want to meet, whether the first photo earns a closer look and whether the rest gives someone a reason to like you."
  },
  "how-to-get-more-bumble-matches": {
    query: "how to get more matches on bumble for men",
    metaTitle: "How to Get More Matches on Bumble as a Guy",
    h1: "How to get more matches on Bumble as a guy",
    description: "Want more Bumble matches as a guy? Use the profile tools fully, build photos with distinct jobs, add specific details and keep filters realistic.",
    intro: "To get more matches on Bumble as a guy, make your profile easy to read. Someone should quickly see what you look like, what your life contains and what they could ask you about. Start with the official profile controls and clear evidence, not tricks or promised outcomes."
  },
  "how-to-get-more-hinge-matches": {
    query: "how to get more likes on hinge as a guy",
    metaTitle: "How to Get More Likes on Hinge as a Guy",
    h1: "How to get more likes on Hinge as a guy",
    description: "How to get more likes on Hinge as a guy: review photos, prompt answers, comments and preferences, and use only the controls you can verify.",
    intro: "Hinge gives photos and prompt answers equal weight, so getting more likes on Hinge starts with building several true, easy openings. Each photo or prompt can become the reason someone responds. Then use preferences and likes on purpose rather than searching for an algorithm trick."
  },
  "why-you-get-no-matches": {
    query: "why am i not getting any matches on dating apps",
    metaTitle: "Why Am I Not Getting Any Matches on Dating Apps?",
    h1: "Why am I not getting any matches on dating apps?",
    description: "Not getting any matches on dating apps? Work through account visibility, preferences, the first photo, profile substance and how you use the app.",
    intro: "Why am I not getting any matches? It is a symptom, not a verdict on your looks. The useful question is where the process breaks: whether your account can be found, whether the right people see it, whether the first photo earns a closer look or whether the profile gives enough reason to act."
  },
  "dating-app-photo-order-men": {
    query: "what order should dating app photos be in",
    metaTitle: "What Order Should Dating App Photos Go In?",
    h1: "What order should your dating app photos go in?",
    description: "What order should dating app photos go in? A sequence for men: clear face, honest full-body, lifestyle, social warmth and one memorable photo.",
    intro: "What order should your dating app photos go in? Not an order that hides weak images behind a strong one. Answer the viewer's questions in sequence: who are you, what do you look like, what does your life include and what could we talk about?"
  },
  "hinge-prompts-for-men": {
    query: "best hinge prompts for guys",
    metaTitle: "Best Hinge Prompts for Guys and How to Answer",
    h1: "Best Hinge prompts for guys, and how to answer them",
    description: "The best Hinge prompts for guys are ones with different jobs and specific answers. Replace generic lines with details that make replying easy.",
    intro: "Looking for the best Hinge prompts for guys? The best answer is not the cleverest sentence on the internet. It is a true, specific answer that sounds like you and gives the right person an obvious way into a conversation. Choose prompts that each do a different job."
  },
  "tinder-bio-for-men": {
    query: "good tinder bio for guys",
    metaTitle: "Good Tinder Bio Ideas for Guys",
    h1: "A good Tinder bio for guys: short, specific, easy to message",
    description: "Writing a good Tinder bio as a guy: use one true detail, a picture of everyday life and an easy hook. No clichés, demands or copied lines.",
    intro: "A good Tinder bio for guys helps the right person understand you after the photos catch their attention. Use a few concrete details that create recognition and give her something to reply to, not a résumé or a list of rules."
  },
  "first-message-after-match": {
    query: "what to say in the first message after a match",
    metaTitle: "What to Say in the First Message After a Match",
    h1: "What to say in your first message after a match",
    description: "What to say in the first message after a match: pick one profile detail, add a real thought and ask an easy question. No copied lines or pressure.",
    intro: "Not sure what to say in the first message after a match? It does not need to be extraordinary. It needs to show you noticed her, offer a little of your own personality and make the next step easy. Detail, thought, question."
  },
  "when-to-ask-her-out": {
    query: "when to ask a girl out on a dating app",
    metaTitle: "When to Ask a Girl Out on a Dating App",
    h1: "When to ask a girl out on a dating app",
    description: "When should you ask a girl out on a dating app? Look for mutual engagement, make a specific low-pressure invite and handle yes, no or silence well.",
    intro: "When should you ask a girl out on a dating app? There is no magic number of messages. The better signal is whether the exchange is mutual, specific enough to support a plan and comfortable enough that a direct invitation feels like the next step rather than a sudden demand."
  },
  "do-ai-dating-assistants-work": {
    query: "do ai dating assistants work",
    metaTitle: "Do AI Dating Assistants Actually Work?",
    h1: "Do AI dating assistants actually work?",
    description: "Do AI dating assistants work? A plain look at the three kinds, what each can realistically do and how to spot one that puts your account at risk.",
    intro: "Do AI dating assistants actually work? It depends which of the three kinds you mean, and mixing them up is how people end up banned or disappointed. Here is what each type can do, what none can do, and the one question that sorts good tools from risky ones."
  },
  "ai-dating-messages-ok": {
    query: "is it ok to use ai to write dating app messages",
    metaTitle: "Is It OK to Use AI to Write Dating Messages?",
    h1: "Is it OK to use AI to write dating app messages?",
    description: "Is it OK to use AI to write dating app messages? A would-you-say-it-out-loud test, editing rules and when to write the message yourself.",
    intro: "Is it OK to use AI to write dating app messages? Short answer: getting help with words is fine, and letting words you would never say do the talking is not. The line between the two is easier to find than it sounds."
  },
  "dating-app-swipe-bots-banned": {
    query: "can you get banned for using a tinder swipe bot",
    metaTitle: "Can You Get Banned for Using a Swipe Bot?",
    h1: "Can you get banned for using a Tinder swipe bot?",
    description: "Can you get banned for using a swipe bot? What Tinder, Hinge and Bumble say in their terms about bots, what can happen and what to do instead.",
    intro: "Can you get banned for using a Tinder swipe bot? A bot is tempting when you are tired of swiping, and it is exactly the kind of tool the apps' terms are written against. Here is what the terms say in their own words, and what is left once you drop the bot."
  },
  "she-replied-haha": {
    query: "what to say when she replies haha",
    metaTitle: "What to Say When She Replies Just “haha”",
    h1: "What to say when she replies with just “haha”",
    description: "What to say when she replies “haha”: what it usually means and three ways to answer, add a take, change the subject or suggest a plan, and when to let go.",
    intro: "You sent something you thought was decent and she answered “haha.” What do you say now? It is not a verdict, it is an opening, and there are three reasonable ways to use it."
  },
  "match-stopped-replying": {
    query: "match stopped replying should i message again",
    metaTitle: "Match Stopped Replying? Should You Message Again?",
    h1: "Your match stopped replying: should you message again?",
    description: "Match stopped replying? Send one calm follow-up with a specific hook, know when a second message becomes chasing and move on without making it a thing.",
    intro: "Your match stopped replying and you are wondering whether to message again. After three days of silence you probably get one more message, and after that it is a pattern. Here is how to send that one message without sounding hurt."
  },
  "opener-examples-by-photo": {
    query: "good dating app openers based on her photos",
    metaTitle: "Dating App Openers Based on Her Photos",
    h1: "Dating app openers based on her photos: examples by photo type",
    description: "Good dating app openers based on her photos: examples for dog, hiking, travel, group, food, gym mirror and no-face photos, using one simple pattern.",
    intro: "Looking for good dating app openers based on her photos? Start with something in them that other people skip past. The pattern never changes: notice one detail, add a small opinion, ask a question that takes five seconds to answer. Below are seven photo types with examples to adapt in your own words."
  },
  "hinge-photos-for-men": {
    query: "best photos for hinge men",
    metaTitle: "Best Hinge Photos for Men and the Order to Use",
    h1: "Best Hinge photos for men, and what each slot should do",
    description: "Choosing the best Hinge photos as a man: give each slot a different job, cut repeats, place a group photo carefully and test one change at a time.",
    intro: "Choosing the best Hinge photos as a man is easier when you remember that photos share the scroll with prompts, so each one does a small job. Give every slot a different job and you will quickly see which ones to cut."
  },
  "bumble-bio-for-men": {
    query: "bumble bio examples for guys",
    metaTitle: "Bumble Bio Examples for Guys, Rewritten",
    h1: "Bumble bio examples for guys that give her something to reply to",
    description: "Bumble bio examples for guys: why “love to travel” gives her nothing to reply to, plus ten specific rewrites and a one-fact, one-opinion, one-hook bio.",
    intro: "Most Bumble bio examples for guys read “love to travel, good vibes, down for anything.” She has seen that bio many times and never once had a question to ask. A bio is a set of handles for a conversation, so give her something to grab."
  },
  "move-from-app-to-number": {
    query: "how to ask for her number on a dating app",
    metaTitle: "How to Ask for Her Number From a Dating App",
    h1: "How to ask for her number on a dating app without being weird",
    description: "How to ask for her number on a dating app: timing signals, the plan-first approach and what to say if she prefers to stay in the app.",
    intro: "Wondering how to ask for her number on a dating app? Asking in your second message feels like a request for access, while asking after a plan feels like logistics. The order matters more than the wording."
  },
  "dating-profile-audit-checklist": {
    query: "how to tell if my dating profile is bad",
    metaTitle: "How to Tell if Your Dating Profile Is Bad",
    h1: "How to tell if your dating profile is bad: a 5-minute check",
    description: "Not sure if your dating profile is bad? A five-minute checklist for men: first photo, face visibility, an activity photo, the bio, a prompt and a hook.",
    intro: "You do not need an hour or a stranger's opinion to tell if your dating profile is bad. Open your own and run through six checks with a timer. Most profiles fail on the first two."
  },
  "dating-profile-mistakes-men": {
    query: "dating profile mistakes guys make",
    metaTitle: "12 Dating Profile Mistakes Guys Make, and Fixes",
    h1: "12 dating profile mistakes guys make, and how to fix each",
    description: "Dating profile mistakes guys make, from sunglasses selfies to wedding crops and “love X, Y, Z” bios, with one practical fix for each of the twelve.",
    intro: "The dating profile mistakes guys make are mostly small, specific and fixable in an evening. Here are twelve that show up again and again, each with one thing to change. You probably have two or three of them. Most people do."
  },
  "tinder-vs-hinge-vs-bumble-for-men": {
    query: "tinder vs hinge vs bumble for guys",
    metaTitle: "Tinder vs Hinge vs Bumble: Best App for Guys?",
    h1: "Tinder vs Hinge vs Bumble: which app is best for guys?",
    description: "Tinder vs Hinge vs Bumble for guys: how each app is laid out, who tends to message first and a decision table to help you pick one.",
    intro: "Which is best for guys, Tinder, Hinge or Bumble? There is no single best dating app, only a better match between an app's layout and how you like to meet people. This is a qualitative comparison with no user statistics, because the numbers you see online are mostly marketing."
  },
  "dating-with-a-busy-schedule": {
    query: "how to date when you work long hours",
    metaTitle: "How to Date When You Work Long Hours",
    h1: "How to date when you work long hours",
    description: "How to date when you work long hours: a 20-minute-a-week routine for busy men, with batched replies, backup plans and polite rescheduling.",
    intro: "If you are trying to date while working long hours, the problem is rarely that you have no time. Dating asks for small bursts of attention at the worst moments. A routine that fits in about twenty minutes a week beats a burst of effort that fades by Thursday."
  },
  "text-before-first-date": {
    query: "what to text before a first date",
    metaTitle: "What to Text Before a First Date",
    h1: "What to text before a first date",
    description: "What to text before a first date: a short confirmation, a useful location detail, what not to send and how to handle a late “running 10 mins.”",
    intro: "Not sure what to text before a first date? The messages between agreeing a plan and meeting should do one job: make the meeting easy. Save the big jokes and deep conversation for the date. Short, clear and warm is the target."
  },
  "she-cancelled-first-date": {
    query: "she cancelled our first date what do i say",
    metaTitle: "She Cancelled Our First Date: What Should I Say?",
    h1: "She cancelled our first date: what should I say?",
    description: "She cancelled our first date, what should I say? Reply calmly, offer one new time, read the signal in repeated reschedules and don't take it personally.",
    intro: "She cancelled our first date, what should I say? You booked the table, picked the shirt, and then the message arrived. It stings, but how you answer matters more than the cancellation does. Calm, brief and open to a new time is the whole playbook."
  },
  "dating-bio-for-introverts": {
    query: "dating bio examples for introverts",
    metaTitle: "Dating Bio Examples for Introverts",
    h1: "Dating bio examples for introverts: say something real, not “I'm shy”",
    description: "Dating bio examples for introverts: why “I'm shy” reads as a disclaimer, three rewrites that show quiet confidence and how to use a quiet hobby as a hook.",
    intro: "Writing a dating bio as an introvert, you will be tempted to say so up front. “I'm shy, but...” is understandable, but it works like an apology. Show what a good evening with you looks like and let the quiet speak for itself."
  },
  "first-date-ideas-not-drinks": {
    query: "first date ideas that aren't drinks",
    metaTitle: "First Date Ideas That Aren't Drinks or Dinner",
    h1: "First date ideas that aren't drinks: 12 low-pressure plans",
    description: "First date ideas that aren't drinks: twelve low-pressure plans by time and budget, with notes on noise, easy exits and backup plans.",
    intro: "Looking for first date ideas that are not drinks? Drinks are the default because they are easy, not because they are good. A plan with something to look at or do gives you both a topic and an easy exit. Here are twelve, grouped by time and budget."
  },
  "dating-screenshot-privacy": {
    query: "is it safe to share dating app screenshots with ai",
    metaTitle: "Is It Safe to Share Dating Screenshots With AI?",
    h1: "Is it safe to share dating app screenshots with an AI tool?",
    description: "Is it safe to share dating screenshots with an AI tool? What to blur or crop first (names, faces, numbers, locations) and what to ask about retention.",
    intro: "Is it safe to share dating app screenshots with an AI tool? That depends on what is in the screenshot and what the tool does with it. A dating screenshot contains more than your own details, including another person who never agreed to be shared, so take thirty seconds to trim it first, whichever tool you use, ours included."
  },
  "why-hey-gets-ignored": {
    query: "why does nobody reply to hey on dating apps",
    metaTitle: "Why Nobody Replies to “Hey” on Dating Apps",
    h1: "Why nobody replies to “hey” on dating apps, and what to send instead",
    description: "Why does nobody reply to “hey” on dating apps? It hands her the work. Three ten-second upgrades, and an honest note that no opener guarantees a reply.",
    intro: "Why does nobody reply to “hey” on dating apps? It is not rude, it is just work: it hands her the job of starting the conversation, and most people will not take the job. Three small upgrades fix it without turning you into a stand-up comedian."
  },
  "double-texting-dating-apps": {
    query: "is it ok to double text on a dating app",
    metaTitle: "Is It OK to Double Text on a Dating App?",
    h1: "Is it OK to double text on a dating app?",
    description: "Is it OK to double text on a dating app? When a second message makes sense, when it reads as pressure, and an honest view on how long to wait.",
    intro: "Is it OK to double text on a dating app? “Never double text” sounds firm and falls apart in real life. The better question is whether your second message gives her something new. If it does, send it. If it only repeats the first, don't."
  }
};
