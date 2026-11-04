import { expandedGuides } from "@/content/guide-expansion";
import { guideSeo } from "@/content/guide-seo";
import { seoGuidesBatch1 } from "@/content/seo-guides-1";
import { seoGuidesBatch2 } from "@/content/seo-guides-2";

export type GuideSection = {
  title: string;
  paragraphs: string[];
  bullets?: string[];
  example?: { label: string; text: string };
};

export type Guide = {
  slug: string;
  title: string;
  eyebrow: string;
  description: string;
  intro: string;
  readingTime: string;
  sections: GuideSection[];
  checklist: string[];
  faqs: { question: string; answer: string }[];
  sources?: { label: string; url: string; kind: "guidance" | "platform-context" | "background" }[];
  relatedSlugs?: string[];
  /** Full <title> text (layout appends " — NoSwipe"). Falls back to title. */
  metaTitle?: string;
  /** On-page H1. Falls back to title. */
  h1?: string;
  /** ISO date; defaults to the original launch date. */
  publishedIso?: string;
};

const originalGuides: Guide[] = [
  {
    slug: "tinder-profile-review",
    title: "How to review your Tinder profile",
    eyebrow: "Tinder profile review",
    description:
      "A practical Tinder profile review checklist for photos, ordering and bio—without fake photos, vague advice or guaranteed-match claims.",
    intro:
      "A useful Tinder profile review answers three questions: can someone tell what you look like, can they picture spending time with you, and is there an easy reason to start a conversation? Review the whole sequence, not each photo in isolation.",
    readingTime: "6 min read",
    sections: [
      {
        title: "Start with the first photo",
        paragraphs: [
          "Your first photo has one job: make recognition effortless. Use a recent, clear photo where your face is visible, you are the obvious subject and the lighting looks natural.",
          "Group shots, sunglasses, distant full-body photos and heavy filters create work before the viewer knows anything about you. They can appear later if they add context, but they are weak openers."
        ],
        bullets: [
          "One person in frame",
          "Face visible at thumbnail size",
          "Recent enough to be an honest representation",
          "No text, overlays or dating-app interface graphics baked into the image"
        ]
      },
      {
        title: "Build a sequence, not a pile",
        paragraphs: [
          "The rest of the profile should answer different questions. A useful sequence might show your face, full-body appearance, a real social setting, an interest you actually practice and one photo with personality.",
          "Remove near-duplicates. Three photos from the same shoot do not reveal three new things. A profile usually becomes clearer when every image earns a different role."
        ],
        bullets: [
          "Photo 1: clear recognition",
          "Photo 2: full-body or wider context",
          "Photo 3: social proof without making people guess who you are",
          "Photo 4: a specific interest or place",
          "Photo 5: warmth, humor or style"
        ]
      },
      {
        title: "Make the bio easy to respond to",
        paragraphs: [
          "A bio works better when it contains specific, answerable details. Replace broad labels such as “foodie” or “adventurous” with a real preference, ritual or small disagreement someone can reply to.",
          "Avoid a list of demands. State what your life is like and what kind of connection you want in plain language. The goal is not to impress everyone; it is to give the right person something concrete to use."
        ],
        example: {
          label: "Example",
          text: "Sunday plan: coffee, a long walk and finding the best dumplings in the neighborhood. Tell me the place I am missing."
        }
      },
      {
        title: "Check the promise against reality",
        paragraphs: [
          "The profile should be accurate enough that meeting you feels consistent with swiping on you. Do not use generated faces, old photos that no longer resemble you or borrowed lifestyle props.",
          "No reviewer can honestly promise a match count. Preferences, location, activity and the other person all matter. A review can improve clarity and give conversations better material; it cannot manufacture compatibility."
        ]
      }
    ],
    checklist: [
      "The first photo is clear and recent",
      "Every photo contributes new information",
      "At least one photo shows a real interest or setting",
      "The bio includes a detail someone can answer",
      "Nothing implies a lifestyle you do not live",
      "A stranger can summarize you after one pass"
    ],
    faqs: [
      {
        question: "How many photos should a Tinder profile have?",
        answer:
          "Use enough photos to show your face, appearance and real life without repetition. The exact count matters less than whether every photo adds distinct, current information."
      },
      {
        question: "Should I use a group photo?",
        answer:
          "A group photo can show a social side, but it should not be first and the viewer should identify you immediately. Skip it if it creates a guessing game."
      },
      {
        question: "Can NoSwipe change my Tinder profile for me?",
        answer:
          "Yes, with your permission. NoSwipe works on your own Tinder account to rank your real photos and write and update your profile. You can change anything yourself and pause Tinder at any time."
      }
    ]
  },
  {
    slug: "hinge-prompt-help",
    title: "Hinge prompt help that sounds like you",
    eyebrow: "Hinge prompt help",
    description:
      "Choose stronger Hinge prompts and write specific answers that make starting a real conversation easier, with examples and a review checklist.",
    intro:
      "Good Hinge prompt answers do not try to summarize your entire personality. They reveal one specific thing, in your natural voice, that gives a match an obvious opening line.",
    readingTime: "6 min read",
    sections: [
      {
        title: "Give each prompt a different job",
        paragraphs: [
          "Three answers that all say you like travel, food and humor waste the space. Use each prompt to show a different side: what spending time with you looks like, a belief or preference, and an easy invitation to respond.",
          "Before writing, assign a role to each answer. This prevents repetition and makes the profile feel like one coherent person rather than three unrelated punchlines."
        ],
        bullets: [
          "Lifestyle: a real routine, hobby or weekend",
          "Personality: a specific opinion or harmless quirk",
          "Conversation hook: a choice, recommendation or story request"
        ]
      },
      {
        title: "Use detail instead of adjectives",
        paragraphs: [
          "Words like “funny,” “loyal” and “spontaneous” ask the reader to take your word for it. A small scene demonstrates more. Name the meal you cook, the trail you repeat, the song you overplay or the tiny ritual your friends recognize.",
          "Keep the detail true. A polished answer should still sound like something you could say out loud on a date."
        ],
        example: {
          label: "Before → after",
          text: "“I love cooking” → “My most irrationally serious project is getting crispy potatoes right every time.”"
        }
      },
      {
        title: "Create a low-pressure reply path",
        paragraphs: [
          "A match is more likely to respond when the answer suggests what to say next. A request for one recommendation, a two-option choice or a playful claim can work because the reply requires little invention.",
          "Do not turn every answer into an interview question. One clear opening is enough; the rest can simply make you legible."
        ],
        example: {
          label: "Example",
          text: "Together we could: choose the best croissant in the city. You pick the first contender."
        }
      },
      {
        title: "Remove performance and negativity",
        paragraphs: [
          "An answer can be clever and still be hard to connect with. Read it once for meaning and once for tone. Delete résumé language, generic sarcasm and complaints about dating apps or past matches.",
          "If a boundary matters, state it directly and respectfully. Prompt space is usually better spent showing the life and relationship you want than listing people you reject."
        ]
      }
    ],
    checklist: [
      "Each prompt reveals a different part of you",
      "At least one answer creates an easy reply",
      "Specific details replace generic adjectives",
      "The words sound natural when read aloud",
      "There are no copy-pasted viral answers or invented stories",
      "The tone is positive without pretending to be perfect"
    ],
    faqs: [
      {
        question: "What makes a good Hinge prompt answer?",
        answer:
          "A strong answer is specific, true, easy to understand and gives the reader something natural to respond to. It should also add information that your photos do not already show."
      },
      {
        question: "Should every Hinge prompt be funny?",
        answer:
          "No. Humor can help when it is natural to you, but clarity and specificity matter more. A sincere answer can balance a playful one and reveal more range."
      },
      {
        question: "Does NoSwipe log in and edit my Hinge profile?",
        answer:
          "Yes, with your permission. NoSwipe works on your own Hinge account to set up and edit your profile. You can pause Hinge or change anything yourself at any time. Hinge's terms restrict automated tools, so an account can be limited or suspended."
      }
    ]
  },
  {
    slug: "dating-message-help",
    title: "Dating message help for real conversations",
    eyebrow: "Dating message help",
    description:
      "A practical framework for openers, replies and asking someone out—based on the conversation you actually have, not copied pickup lines.",
    intro:
      "Useful dating-message help should preserve your voice and the other person’s boundaries. The aim is a clear, human conversation—not a perfect line, pressure tactic or message sent without your approval.",
    readingTime: "7 min read",
    sections: [
      {
        title: "Write from available context",
        paragraphs: [
          "The best raw material is already in the profile or conversation. Notice one detail, add a small thought of your own, then leave a simple path to reply. This is more personal than a copied opener and easier to continue later.",
          "Avoid pretending you know more than the profile shows. A message should be attentive, not investigative."
        ],
        example: {
          label: "Simple structure",
          text: "Observation + your reaction + one easy question. “That night-market photo made me hungry. I always go straight for dumplings—what was the best thing you tried?”"
        }
      },
      {
        title: "Match the pace and length",
        paragraphs: [
          "A reply does not need to answer every possible thread. Pick the most interesting one and move it forward. If the other person is writing short, casual messages, a long paragraph can feel like a change in pace.",
          "Matching pace does not mean playing games with reply times. It means keeping the conversation proportionate and giving the other person room to participate."
        ],
        bullets: [
          "Answer what they actually asked",
          "Add one new detail rather than three new topics",
          "Use one clear question when a question helps",
          "Do not double-message repeatedly when there is no reply"
        ]
      },
      {
        title: "Move from chat to a clear invitation",
        paragraphs: [
          "When there is mutual engagement, a direct invitation is kinder than an endless vague chat. Refer to something you discussed, suggest a simple activity and offer a realistic time window.",
          "Make it easy to decline or adjust. A yes should be informed and unpressured; silence or a soft no is not a problem to overcome."
        ],
        example: {
          label: "Example",
          text: "I’m enjoying this. Want to continue it over coffee at [place] this weekend? I’m free Saturday afternoon or Sunday morning."
        }
      },
      {
        title: "Keep the final message yours",
        paragraphs: [
          "A draft is useful only if it represents what you mean. Edit anything you would not say in person, and never claim an experience or intention that is not true.",
          "NoSwipe sends messages as you, in your voice. You can read every chat and take over any time to say something in your own words."
        ]
      }
    ],
    checklist: [
      "The message responds to something specific",
      "It sounds like words you would say aloud",
      "It moves one thread forward",
      "Any question is easy to answer",
      "An invitation includes a place or activity and a time window",
      "There is no pressure, deception or invented detail"
    ],
    faqs: [
      {
        question: "What is a good first message on a dating app?",
        answer:
          "Use one genuine detail from the profile, add a short reaction or connection, and make the reply easy. A specific message usually gives you a better conversation than a line that could be sent to anyone."
      },
      {
        question: "When should I ask for a date?",
        answer:
          "There is no universal message count. Ask when the exchange shows mutual interest and you have enough context to suggest a simple plan. Be direct, specific and comfortable with either answer."
      },
      {
        question: "Will NoSwipe send replies for me?",
        answer:
          "Yes. NoSwipe replies as you, in your voice, and you can read every chat and take over at any time."
      }
    ]
  },
  {
    slug: "first-date-planning",
    title: "First-date planning without the guesswork",
    eyebrow: "First-date planning",
    description:
      "Plan a simple first date with a clear invitation, sensible venue, easy logistics and respectful confirmation—plus a reusable checklist.",
    intro:
      "A strong first-date plan is specific enough to feel real and flexible enough to be comfortable. You do not need an elaborate surprise; you need a place, time, duration and easy way for both people to say yes or suggest a change.",
    readingTime: "6 min read",
    sections: [
      {
        title: "Choose a plan that supports conversation",
        paragraphs: [
          "For a first meeting, favor a public place that is easy to find and easy to leave. Coffee, a casual drink, a market or a short walk in a busy area can all work when they fit your shared interests.",
          "Check opening hours, reservations, noise level and transportation before suggesting it. A famous venue is not useful if it is closed, impossible to hear in or far from both people."
        ],
        bullets: [
          "Public and comfortable",
          "Reasonable travel for both people",
          "Conversation is possible",
          "Clear price level",
          "Simple backup nearby"
        ]
      },
      {
        title: "Make a complete invitation",
        paragraphs: [
          "A vague “we should hang out” creates another planning task. A complete invitation names the activity or venue and offers one or two time windows. It also makes room for a different preference.",
          "Do not disguise the invitation. Clear language helps both people understand that you are proposing a date."
        ],
        example: {
          label: "Template",
          text: "Want to meet for coffee at [place]? I can do Thursday at 6:30 or Saturday around 11. If another area is easier, I’m happy to adjust."
        }
      },
      {
        title: "Confirm without over-managing",
        paragraphs: [
          "Once the plan is agreed, repeat the final place and time so there is one clear version. A short confirmation on the day is usually enough. If details change, say so as early as you can.",
          "If they cancel, take the message at face value. If they offer a new time, continue planning. If they do not, you do not need to chase a replacement plan."
        ],
        example: {
          label: "Day-of confirmation",
          text: "Still good for 6:30 at [place]? Looking forward to seeing you."
        }
      },
      {
        title: "Plan for comfort and safety",
        paragraphs: [
          "Both people should control their own transportation and know where they are meeting. Tell a friend where you are going if that makes you more comfortable. Respect a request to change the venue, shorten the plan or leave.",
          "No plan guarantees chemistry or a second date. The win is a clear, respectful meeting where both people can decide how they feel."
        ]
      }
    ],
    checklist: [
      "The venue is public and currently open",
      "The location is reasonable for both people",
      "The invitation includes activity, place and time options",
      "The final plan is repeated clearly",
      "Both people can arrive and leave independently",
      "There is a simple backup and no pressure to extend the date"
    ],
    faqs: [
      {
        question: "What is a good first-date idea?",
        answer:
          "Choose a public, low-pressure activity that allows conversation and fits what you have discussed. Coffee, a casual drink, a market or a short walk in a busy area are simple starting points."
      },
      {
        question: "Who should choose the first-date location?",
        answer:
          "The person making the invitation can suggest a specific place, but both people should be able to adjust it for travel, comfort, accessibility or preference."
      },
      {
        question: "Can NoSwipe book the date for me?",
        answer:
          "Yes. When a chat turns into a plan, NoSwipe books the date and it appears in your Dates tab with who, where and when, plus a calendar file. Check the real details before you go."
      }
    ]
  }
];

function withSeo(guide: Guide): Guide {
  const seo = guideSeo[guide.slug];
  if (!seo) return guide;
  return { ...guide, metaTitle: seo.metaTitle, h1: seo.h1, description: seo.description, intro: seo.intro };
}

export const guides: Guide[] = [...originalGuides, ...expandedGuides, ...seoGuidesBatch1, ...seoGuidesBatch2].map(withSeo);

const seoSlugSet = new Set([...seoGuidesBatch1, ...seoGuidesBatch2].map((guide) => guide.slug));
export const seoGuides: Guide[] = guides.filter((guide) => seoSlugSet.has(guide.slug));

export const guideSlugs = guides.map((guide) => guide.slug);

export function getGuide(slug: string): Guide | undefined {
  return guides.find((guide) => guide.slug === slug);
}
