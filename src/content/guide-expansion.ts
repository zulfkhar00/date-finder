import type { Guide } from "@/content/guides";

const TINDER_TERMS = "https://tinder.com/terms/intl/en-GB/";
const BUMBLE_PHOTOS = "https://support.bumble.com/hc/en-us/articles/28523708029341-Uploading-profile-photos-and-videos";
const BUMBLE_STAND_OUT = "https://support.bumble.com/hc/en-us/articles/28938370080925-Standing-out-on-Bumble";
const BUMBLE_TERMS = "https://bumble.com/en-us/terms/";
const HINGE_REFRESH = "https://hinge.co/newsroom/profile-refresh-guide";
const HINGE_PROMPTS = "https://hinge.co/newsroom/prompt-feedback";
const HINGE_CONVERSATIONS = "https://hinge.co/newsroom/convo-starters";
const HINGE_RECOMMENDATIONS = "https://hinge.co/how-we-connect-daters";
const HINGE_TERMS = "https://files.hinge.co/cd9501b29851b78fdef767d2376e278db1232c93.pdf";
const PEW_ONLINE_DATING = "https://www.pewresearch.org/short-reads/2023/02/02/key-findings-about-online-dating-in-the-u-s/";

export const expandedGuides: Guide[] = [
  {
    slug: "how-to-get-more-tinder-matches",
    title: "How to get more Tinder matches without gaming the app",
    eyebrow: "More Tinder matches",
    description:
      "A practical Tinder checklist for diagnosing settings, improving your first photo, ordering the rest of your profile and using the app intentionally.",
    intro:
      "If Tinder feels quiet, do not change everything at once or look for a swipe hack. Check whether your profile is being shown to the people you want to meet, whether the first photo earns a closer look and whether the rest gives someone a reason to like you.",
    readingTime: "7 min read",
    sections: [
      {
        title: "Check the setup before rewriting the profile",
        paragraphs: [
          "Start with the controls you can verify: discovery is enabled, your age and distance preferences are realistic for where you live, your location is accurate and the profile is complete. A narrow combination of distance, age and other preferences can leave very few eligible people without saying anything about your photos.",
          "Do not try to fix visibility with location spoofing, automation or third-party account tools. Tinder's current terms restrict unauthorized services and automated interaction. Keep the account in your hands and use the product's own controls."
        ],
        bullets: [
          "Confirm discovery and location settings",
          "Review whether every active filter is genuinely important",
          "Complete required profile fields",
          "Use only your own current photos and truthful details"
        ]
      },
      {
        title: "Make photo one instantly understandable",
        paragraphs: [
          "Your first image should make recognition easy at a small size. Use one recent, well-lit photo with your face visible and no uncertainty about which person you are. Save sunglasses, groups, costumes and distant activity shots for later positions.",
          "Then remove near-duplicates. A second close-up should reveal something different from the first, not repeat the same angle, outfit and setting. For a full sequence, use the photo-order framework in our dedicated guide."
        ],
        bullets: [
          "First: clear face and natural expression",
          "Next: full-body or wider context",
          "Then: a real interest, social setting and personal style",
          "Last: another strong, current view—not filler"
        ]
      },
      {
        title: "Give the bio one easy conversation hook",
        paragraphs: [
          "A Tinder bio does not need to tell your life story. It should make you specific enough to remember and easy enough to message. Name a real weekend habit, preference, project or place someone can ask about.",
          "Avoid a list of complaints, demands or generic claims such as “fluent in sarcasm.” If you want examples and a rewrite process, use the Tinder bio guide rather than copying a viral line that does not sound like you."
        ],
        example: {
          label: "Simple bio structure",
          text: "Real detail + what spending time with you looks like + an easy hook. “Learning to make proper ramen, usually outside on Sunday, and always open to a better bookstore recommendation.”"
        }
      },
      {
        title: "Use Tinder deliberately and review one variable at a time",
        paragraphs: [
          "Like people you would genuinely want to meet instead of treating the app as a speed test. Read enough of the profile to make an intentional choice, and respect the other person's stated intent and boundaries.",
          "When you revise, change one major element and give yourself enough normal use to judge it. Start with the first photo, then the sequence, then the bio. No profile change can guarantee matches because local availability, preferences and mutual choice still determine the result."
        ]
      }
    ],
    checklist: [
      "Discovery, location and filters reflect who you can realistically meet",
      "The first photo clearly shows your face",
      "Each later photo adds new information",
      "The bio contains at least one true, answerable detail",
      "The profile is free of complaints and copied lines",
      "You choose likes yourself and avoid third-party account tools"
    ],
    faqs: [
      {
        question: "Should I buy a Tinder boost when I get no matches?",
        answer:
          "A visibility feature cannot repair an unclear first photo or empty profile. Review the profile and settings first, then decide whether a paid Tinder feature fits your own budget and goals."
      },
      {
        question: "Does swiping right on everyone help?",
        answer:
          "It does not help you make good choices. Read profiles and like people you would actually want to meet; a match only matters if there is genuine mutual interest."
      },
      {
        question: "Can NoSwipe run my Tinder account?",
        answer:
          "No. NoSwipe can critique the screenshots and photos you provide and draft bio or message options. You control the account, choose every like and send every message yourself."
      }
    ],
    sources: [
      { label: "Tinder Terms of Use", url: TINDER_TERMS },
      { label: "Pew Research Center: key findings about online dating in the U.S.", url: PEW_ONLINE_DATING }
    ],
    relatedSlugs: ["tinder-profile-review", "dating-app-photo-order-men", "tinder-bio-for-men"]
  },
  {
    slug: "how-to-get-more-bumble-matches",
    title: "How to get more Bumble matches with a clearer profile",
    eyebrow: "More Bumble matches",
    description:
      "Improve a Bumble profile with stronger photos, specific profile details, realistic filters and an easy path into conversation.",
    intro:
      "A stronger Bumble profile reduces guesswork. Someone should quickly understand what you look like, what your life contains and what they could ask you about. Start with official profile controls and clear evidence, not tricks or outcome promises.",
    readingTime: "7 min read",
    sections: [
      {
        title: "Use Bumble's profile tools completely and honestly",
        paragraphs: [
          "Bumble's own help center emphasizes using profile photos and details to help people understand you. Fill the fields that matter to your dating intent, and make sure filters and preferences match the people you can realistically meet.",
          "Verification or a complete profile is not a guarantee of attention. It simply removes avoidable uncertainty. Do not use account automation, location manipulation or someone else's identity; Bumble's terms govern how the service may be used."
        ],
        bullets: [
          "Use a current main photo",
          "State relationship intent honestly",
          "Add specific interests rather than broad labels",
          "Review distance and age preferences",
          "Keep every image and claim authentic"
        ]
      },
      {
        title: "Build a photo set with distinct jobs",
        paragraphs: [
          "Lead with a solo image where your face is easy to see. Follow it with wider context: full-body appearance, a real activity, a social setting where you remain obvious and a photo that shows style or warmth.",
          "Bumble's public photo guidance is the right place to check current upload and moderation rules. Within those rules, prioritize clarity over heavy editing. A profile should prepare someone to recognize you in person."
        ],
        example: {
          label: "A useful sequence",
          text: "Clear portrait → full-body context → interest in action → social setting → personal style or relaxed candid. Remove any image that repeats a job."
        }
      },
      {
        title: "Write details that support the first exchange",
        paragraphs: [
          "Bumble's standing-out guidance encourages a complete, distinctive profile. Translate that into specific material: the meal you make for friends, the neighborhood ritual you repeat or the small opinion you can defend without turning hostile.",
          "Answer profile questions in your normal voice. If every answer sounds like a résumé or a performance, replace one with a concrete scene that makes a reply easier."
        ],
        bullets: [
          "One detail about your week",
          "One interest shown with evidence",
          "One low-pressure question or choice",
          "No complaints about matches or dating apps"
        ]
      },
      {
        title: "Separate profile problems from conversation problems",
        paragraphs: [
          "If few people match, review settings, first-photo clarity and profile completeness. If matches arrive but conversations stall, the bottleneck may be the available hooks or how you respond after the match.",
          "That distinction prevents endless photo changes when the real issue is messaging. Use the first-message guide for a concrete opener framework, and remember that no rewrite can force another person to match or reply."
        ]
      }
    ],
    checklist: [
      "Your main photo is solo, recent and easy to read",
      "The remaining photos show different parts of your life",
      "Profile fields and intent are complete and truthful",
      "At least one detail invites a natural question",
      "Filters leave a realistic local pool",
      "You operate the account and make every choice yourself"
    ],
    faqs: [
      {
        question: "What should my first Bumble photo be?",
        answer:
          "Use a recent solo photo with clear lighting, visible eyes and a natural expression. The viewer should not need to crop, zoom or guess who you are."
      },
      {
        question: "Are Bumble prompts more important than photos?",
        answer:
          "They do different jobs. Photos establish recognition and context; written details provide personality and conversation material. Review both instead of expecting one section to carry the profile."
      },
      {
        question: "Will NoSwipe swipe or message on Bumble for me?",
        answer:
          "No. NoSwipe can rank the materials you share and draft profile or message options. You choose who to like, send each message and confirm every plan yourself."
      }
    ],
    sources: [
      { label: "Bumble Support: uploading profile photos and videos", url: BUMBLE_PHOTOS },
      { label: "Bumble Support: standing out on Bumble", url: BUMBLE_STAND_OUT },
      { label: "Bumble Terms and Conditions", url: BUMBLE_TERMS }
    ],
    relatedSlugs: ["dating-app-photo-order-men", "first-message-after-match", "why-you-get-no-matches"]
  },
  {
    slug: "how-to-get-more-hinge-matches",
    title: "How to get more Hinge matches with better profile hooks",
    eyebrow: "More Hinge matches",
    description:
      "A Hinge-specific profile review for photos, prompt answers, comments, preferences and the recommendation controls you can actually verify.",
    intro:
      "Hinge gives photos and prompt answers equal responsibility: each item can become the reason someone responds. Build a profile with several true, easy openings, then use preferences and likes intentionally rather than searching for an algorithm trick.",
    readingTime: "8 min read",
    sections: [
      {
        title: "Review preferences before blaming the profile",
        paragraphs: [
          "Hinge explains publicly that recommendations use the preferences you set and other signals described in its How We Connect Daters material. Check that your location, distance, age range and dealbreakers reflect who you can realistically meet.",
          "A preference can be valid and still narrow the available pool. Decide which constraints are truly non-negotiable instead of changing them only to chase more activity. Hinge also explains that choosing “prefer not to say” for a compatibility field excludes you from people who have set a dealbreaker around that factor. Answer honestly rather than selecting a response just to reach more people."
        ],
        bullets: [
          "Confirm location and distance",
          "Review each dealbreaker deliberately",
          "Keep relationship intentions accurate",
          "Use the app's own settings rather than workarounds"
        ]
      },
      {
        title: "Give every photo or prompt a reason to receive a like",
        paragraphs: [
          "Hinge's official Profile Refresh Guide recommends reviewing the complete profile rather than letting old material sit indefinitely. For each photo and answer, ask what new information it adds and what someone could say about it.",
          "Lead with clear recognition, then mix appearance, interests, social context and personality. Captions or prompt answers should add meaning instead of explaining away a confusing image."
        ],
        example: {
          label: "The hook test",
          text: "Can a stranger respond without inventing a topic? “Nice photo” is not much of a path; a real place, opinion, ritual or story gives them one."
        }
      },
      {
        title: "Replace generic prompt answers with specific scenes",
        paragraphs: [
          "Hinge's Prompt Feedback work focuses on helping daters improve prompt responses. Apply the same principle manually: replace “I love travel” with a real trip habit, or “I like food” with the dish you are learning and why.",
          "Use different prompt jobs: one answer can show everyday life, one can reveal a preference and one can open an easy exchange. The dedicated prompt guide includes examples and a rewrite process."
        ],
        bullets: [
          "Lifestyle someone can picture",
          "Opinion someone can answer",
          "Story with one memorable detail",
          "Wording you would actually say aloud"
        ]
      },
      {
        title: "Send intentional likes with grounded comments",
        paragraphs: [
          "When you comment, respond to the actual photo or prompt. Add a short thought of your own and, when useful, one answerable question. Avoid generic compliments that could be pasted onto any profile.",
          "Keep control of the account. Hinge's terms apply to account access and use, and NoSwipe does not log in or interact with profiles for you. A thoughtful profile and comment create opportunity; the other person's choice still decides whether a match happens."
        ]
      }
    ],
    checklist: [
      "Preferences and dealbreakers match your real priorities",
      "The first photo makes recognition easy",
      "Every profile item adds distinct information",
      "Prompt answers contain true, concrete details",
      "Comments respond to something specific",
      "You send every like and comment yourself"
    ],
    faqs: [
      {
        question: "What gets more attention on Hinge: photos or prompts?",
        answer:
          "Either can start the interaction. Use photos for recognition and lived context, and prompts for voice, values and easy conversation hooks. The strongest profile does not leave one side empty or generic."
      },
      {
        question: "Should I leave a comment with every Hinge like?",
        answer:
          "Comment when you have something genuine and specific to say. A forced line is not automatically better than a clear, intentional like."
      },
      {
        question: "Can NoSwipe send Hinge likes or comments for me?",
        answer:
          "No. NoSwipe can critique the profile materials you share and draft comment options. You decide who to like, edit the words and send them yourself."
      }
    ],
    sources: [
      { label: "Hinge: How We Connect Daters", url: HINGE_RECOMMENDATIONS },
      { label: "Hinge Profile Refresh Guide", url: HINGE_REFRESH },
      { label: "Hinge Prompt Feedback", url: HINGE_PROMPTS },
      { label: "Hinge Terms of Service", url: HINGE_TERMS }
    ],
    relatedSlugs: ["hinge-prompt-help", "hinge-prompts-for-men", "dating-app-photo-order-men"]
  },
  {
    slug: "why-you-get-no-matches",
    title: "Why you get no matches on dating apps—and what to check",
    eyebrow: "No matches diagnosis",
    description:
      "Diagnose no-match periods in order: account visibility, realistic preferences, first-photo clarity, profile substance and intentional app use.",
    intro:
      "No matches is a symptom, not a verdict on your attractiveness. The useful question is where the process is breaking: whether the account can be discovered, whether the right people see it, whether the first photo earns a closer look or whether the profile gives enough reason to act.",
    readingTime: "8 min read",
    sections: [
      {
        title: "Start with visibility and eligibility",
        paragraphs: [
          "Before replacing photos, verify the account is active and discoverable, the location is correct and the selected age, distance and preference controls leave a realistic local pool. Review each app's current settings and help material because controls differ and can change.",
          "If you suspect an account or moderation issue, use the app's official support route. Do not use location spoofing, new identities or automation to bypass restrictions; those approaches create platform and trust risks rather than solving the underlying issue."
        ],
        bullets: [
          "Discovery is enabled",
          "Location is accurate",
          "Filters are intentional rather than accidental",
          "Required fields are complete",
          "There is no unresolved support or verification notice"
        ]
      },
      {
        title: "Audit the first-photo decision",
        paragraphs: [
          "The first image is often the only part viewed before a decision. It should clearly show one current person, with the face visible and enough light to read the expression. A group photo, old image, heavy filter or distant shot adds uncertainty immediately.",
          "Ask someone who will be direct to view only the first image for a few seconds. Can they identify you, describe the setting and expect to recognize you in person? If not, fix that before polishing the final photo."
        ],
        example: {
          label: "Useful review question",
          text: "Not “Do I look good?” Ask: “What is confusing, outdated or hard to see, and which single photo would you put first?”"
        }
      },
      {
        title: "Check whether the profile gives a reason to connect",
        paragraphs: [
          "Clear photos can still lead to a thin profile. Repeated selfies, generic adjectives and blank prompts reveal little about what time with you would feel like. Add a real activity, a specific preference and one easy conversation hook.",
          "Avoid building a fictional version of yourself. Generated or materially altered photos and invented stories create a mismatch at the first meeting. The goal is accurate clarity, not universal appeal."
        ],
        bullets: [
          "One recognizable first photo",
          "One wider view",
          "One real interest in context",
          "One specific written detail",
          "One honest statement of intent"
        ]
      },
      {
        title: "Keep the result in context",
        paragraphs: [
          "Online dating outcomes depend on mutual preferences, local availability and how people use each app. Pew Research Center's national findings show varied experiences across online daters; they do not provide a personal benchmark or promise for one profile.",
          "Review one major variable at a time and avoid anyone selling guaranteed matches, secret search-volume numbers or a fixed success rate. If matches arrive but replies do not, move to the messaging guides instead of continuing to rebuild the photos."
        ]
      }
    ],
    checklist: [
      "Account discovery and location are correct",
      "Filters reflect people you can realistically meet",
      "The first photo is current, solo and clear",
      "The profile contains distinct lifestyle evidence",
      "Written details create at least one reply path",
      "You are diagnosing one stage instead of changing everything"
    ],
    faqs: [
      {
        question: "Does getting no matches mean my account is hidden?",
        answer:
          "Not necessarily. Check discovery, location, filters, verification and official support notices first. Profile clarity and the size of the eligible local pool can also affect what you experience."
      },
      {
        question: "How long should I wait after changing my profile?",
        answer:
          "There is no honest universal timetable. Continue normal, intentional use and avoid changing several major elements so quickly that you cannot tell what improved clarity."
      },
      {
        question: "Can NoSwipe guarantee that a review will get matches?",
        answer:
          "No. NoSwipe can identify avoidable profile problems and draft stronger material, but other people make their own choices and no review can guarantee an outcome."
      }
    ],
    sources: [
      { label: "Pew Research Center: key findings about online dating in the U.S.", url: PEW_ONLINE_DATING },
      { label: "Hinge: How We Connect Daters", url: HINGE_RECOMMENDATIONS },
      { label: "Bumble Support: standing out on Bumble", url: BUMBLE_STAND_OUT }
    ],
    relatedSlugs: ["dating-app-photo-order-men", "how-to-get-more-tinder-matches", "how-to-get-more-hinge-matches"]
  },
  {
    slug: "dating-app-photo-order-men",
    title: "Dating-app photo order for men: give every photo a job",
    eyebrow: "Photo order for men",
    description:
      "Order dating-app photos for clear recognition, honest full-body context, lifestyle evidence, social warmth and memorable personality.",
    intro:
      "Photo order is not about hiding weak images behind a strong one. It is about answering the viewer's questions in a sensible sequence: who are you, what do you look like, what does your life include and what could we talk about?",
    readingTime: "8 min read",
    sections: [
      {
        title: "Photo one: clear recognition",
        paragraphs: [
          "Open with a recent solo image where your face is large enough to read, your eyes are visible and the lighting is natural. The background can add style, but it should not compete with you.",
          "Avoid starting with a group, helmet, sunglasses, distant landscape or image that needs a caption. Bumble's public photo guidance and Hinge's Profile Refresh Guide both reinforce the value of current profile material; check each app's current rules before uploading."
        ],
        bullets: [
          "One person in frame",
          "Face visible at thumbnail size",
          "Natural expression",
          "Current hair, facial hair and general appearance",
          "No strong filter or synthetic alteration"
        ]
      },
      {
        title: "Photos two and three: honest context",
        paragraphs: [
          "Use the next positions to show a wider view and a part of your real life. A full-body image can be dressed up or casual; the important part is that posture, outfit and setting feel natural rather than staged around a borrowed prop.",
          "An activity photo works when the viewer can still identify you and understand the activity. If your face disappears or the action needs a paragraph of explanation, it is supporting material, not an early anchor."
        ],
        example: {
          label: "Strong middle sequence",
          text: "Full-body street or event photo → you cooking, climbing, playing music or doing another real interest with your face still visible."
        }
      },
      {
        title: "Later photos: social proof, style and warmth",
        paragraphs: [
          "A social photo can show that you have relationships and a life beyond the app, but the viewer should identify you immediately. One group image is usually enough; repeated groups turn the profile into a guessing task.",
          "Use another slot for style, humor or a relaxed expression not already shown. Pets and travel can add context when they are truly yours, not when they are borrowed because they seem popular."
        ],
        bullets: [
          "Different outfit and setting from photo one",
          "No cropped former partner",
          "No repeated near-identical selfies",
          "No image included only to fill a slot"
        ]
      },
      {
        title: "Edit by subtraction, then test the sequence",
        paragraphs: [
          "Lay every candidate out at once and label its job. Remove duplicates, outdated images and anything that creates more uncertainty than information. A smaller honest set is better than a full set with obvious filler.",
          "Review the order at phone size, not only on a large desktop screen. Then ask a trusted person what they learned in sequence. No photo order guarantees matches; it simply makes your appearance and life easier to understand."
        ]
      }
    ],
    checklist: [
      "Photo one is a current, clear solo image",
      "An early photo shows honest full-body context",
      "At least one image shows a real interest",
      "Any group photo identifies you immediately",
      "Every image has a distinct job",
      "Nothing is generated, misleading or materially altered"
    ],
    faqs: [
      {
        question: "Should a full-body photo be second?",
        answer:
          "It is a useful early position because it adds honest context after the face-first opener. Use the exact order that makes your strongest distinct images easy to understand."
      },
      {
        question: "How many group photos should I use?",
        answer:
          "One can add social context if you are immediately identifiable. Skip group images entirely if the available options are confusing, outdated or full of cropped people."
      },
      {
        question: "Can NoSwipe retouch or generate dating photos?",
        answer:
          "NoSwipe's public promise is to critique and rank the real materials you provide. It does not need synthetic identities or misleading edits; you choose and upload the final photos yourself."
      }
    ],
    sources: [
      { label: "Bumble Support: uploading profile photos and videos", url: BUMBLE_PHOTOS },
      { label: "Hinge Profile Refresh Guide", url: HINGE_REFRESH }
    ],
    relatedSlugs: ["tinder-profile-review", "why-you-get-no-matches", "how-to-get-more-bumble-matches"]
  },
  {
    slug: "hinge-prompts-for-men",
    title: "Hinge prompts for men that make replying easy",
    eyebrow: "Hinge prompts for men",
    description:
      "Choose Hinge prompts with different jobs, replace generic answers with specific details and create natural openings without copying viral lines.",
    intro:
      "The best Hinge prompt answer is not the cleverest sentence on the internet. It is a true, specific answer that sounds like you and gives the right person an obvious way into a conversation.",
    readingTime: "8 min read",
    sections: [
      {
        title: "Assign each answer a different job",
        paragraphs: [
          "Before writing, decide what each prompt needs to reveal. One can show what everyday time with you looks like, one can reveal a value or preference and one can create a low-pressure invitation to respond.",
          "Hinge's Prompt Feedback and Profile Refresh materials encourage daters to revisit generic answers. Repetition is the first thing to remove: three jokes about travel, food or sarcasm still reveal only one dimension."
        ],
        bullets: [
          "Lifestyle: a real routine or interest",
          "Perspective: a specific opinion or value",
          "Invitation: a recommendation, choice or shared plan",
          "Voice: wording you would say in person"
        ]
      },
      {
        title: "Turn adjectives into evidence",
        paragraphs: [
          "Do not announce that you are adventurous, funny or ambitious. Show the small evidence: the route you ride before work, the meal you keep improving or the project that has occupied your weekends.",
          "Specific does not mean exposing private information. One concrete detail is enough to create texture while keeping addresses, workplaces and other sensitive facts off the profile."
        ],
        example: {
          label: "Before → after",
          text: "“I'm adventurous” → “Current project: learning enough salsa to stop counting every step out loud.”"
        }
      },
      {
        title: "Use answerable hooks instead of interview questions",
        paragraphs: [
          "A reply path can be a small choice, a recommendation request or a playful claim. It should not feel like a screening form. Ask for one easy response, then let the conversation become mutual.",
          "Avoid answers that rely on negativity, sexual pressure or insulting a group of people. A boundary can be stated plainly, but prompt space is usually more useful when it shows what you welcome."
        ],
        example: {
          label: "Three usable patterns",
          text: "“Teach me something about…” · “Choose our first stop…” · “A hill I'll defend…” followed by a real detail that you can discuss."
        }
      },
      {
        title: "Check that the prompt matches the rest of the profile",
        paragraphs: [
          "A prompt about climbing adds little if several photos already show climbing. Use the written space to add a new side of your life or explain why an interest matters to you.",
          "Read every answer aloud and remove wording you would never use. NoSwipe can draft alternatives from the context you provide, but you choose and enter the final text in Hinge yourself."
        ]
      }
    ],
    checklist: [
      "Each prompt answer reveals something different",
      "Generic adjectives have been replaced with evidence",
      "At least one answer offers a natural reply path",
      "The tone is positive and respectful",
      "The details are true and safe to share publicly",
      "The wording sounds natural when read aloud"
    ],
    faqs: [
      {
        question: "What are the best Hinge prompts for men?",
        answer:
          "Choose prompts that let you provide specific, true information about daily life, values and an easy shared topic. The answer matters more than finding one universally best prompt."
      },
      {
        question: "Should Hinge prompt answers be funny?",
        answer:
          "Only when humor is natural to you. A sincere, specific answer can be more memorable than a joke that sounds copied or hides what you actually mean."
      },
      {
        question: "Will NoSwipe edit my Hinge profile directly?",
        answer:
          "No. NoSwipe can review screenshots and draft options. You decide which wording is accurate and enter it into your own account."
      }
    ],
    sources: [
      { label: "Hinge Prompt Feedback", url: HINGE_PROMPTS },
      { label: "Hinge Profile Refresh Guide", url: HINGE_REFRESH },
      { label: "Hinge Terms of Service", url: HINGE_TERMS }
    ],
    relatedSlugs: ["hinge-prompt-help", "how-to-get-more-hinge-matches", "first-message-after-match"]
  },
  {
    slug: "tinder-bio-for-men",
    title: "Tinder bio for men: specific, short and easy to message",
    eyebrow: "Tinder bio for men",
    description:
      "Write a Tinder bio with a true detail, a picture of everyday life and an easy conversation hook—without clichés, demands or copied lines.",
    intro:
      "A Tinder bio should help the right person understand you after the photos catch their attention. Use a few concrete details that create recognition and conversation, not a résumé or a list of rules.",
    readingTime: "7 min read",
    sections: [
      {
        title: "Decide what the photos do not already say",
        paragraphs: [
          "Review the photo sequence first. If it already shows hiking, travel and your dog, the bio should not merely repeat those facts. Add voice, a weekly ritual, a specific preference or what you hope to share with someone.",
          "Keep every claim current and true. Tinder's terms apply to how accounts and content are used, and a bio is public-facing profile material—not a place for someone else to impersonate you."
        ],
        bullets: [
          "A real detail from daily life",
          "A preference that reveals taste",
          "A simple picture of time together",
          "An honest statement of intent when useful"
        ]
      },
      {
        title: "Use a compact three-part structure",
        paragraphs: [
          "Start with one memorable detail, add what your normal life looks like and finish with an easy hook. This creates enough shape to respond without turning the bio into a long autobiography.",
          "You do not need all three parts when one or two strong sentences work. Cut any phrase that could describe almost anyone, especially “love to laugh,” “work hard, play hard” and unexplained claims about sarcasm."
        ],
        example: {
          label: "Example",
          text: "“Building a small record collection and a much larger list of noodle shops. Sundays are for a long walk and cooking for friends. Give me one album to add.”"
        }
      },
      {
        title: "State intent without pressure or ambiguity",
        paragraphs: [
          "If relationship intent matters, say it in plain language. Honest casual intent is better than pretending to want commitment; serious intent is better expressed as what you welcome than as demands about a stranger's behavior.",
          "Avoid sexual spam, negging and complaints about previous matches. A bio can be confident without framing dating as a contest or treating other people as a problem to solve."
        ],
        example: {
          label: "Direct but low-pressure",
          text: "“Open to a relationship if it develops naturally; mostly here to meet someone thoughtful and see whether we enjoy the same room.”"
        }
      },
      {
        title: "Edit for spoken voice and an honest handoff",
        paragraphs: [
          "Read the bio aloud. Remove words you would never use, jokes that need explanation and details you cannot discuss naturally. The final version should help the first conversation, not create a character you must maintain.",
          "NoSwipe can draft options from the details you provide, but you choose, edit and paste the final bio. No bio can guarantee matches because the other person's preferences and choices remain their own."
        ]
      }
    ],
    checklist: [
      "The bio adds information not obvious from the photos",
      "At least one detail is concrete and true",
      "There is an easy topic to message about",
      "Intent is honest and respectful",
      "There are no complaints, demands or copied clichés",
      "The final wording sounds like you"
    ],
    faqs: [
      {
        question: "How long should a Tinder bio be?",
        answer:
          "Long enough to add useful information and short enough to read easily on a phone. A few specific sentences usually do more work than a long list of adjectives."
      },
      {
        question: "Should I put my height in my Tinder bio?",
        answer:
          "Use profile space for information you consider relevant and are comfortable sharing. Do not let one measurement replace the details that show personality, intent and everyday life."
      },
      {
        question: "Can NoSwipe write and publish my bio?",
        answer:
          "NoSwipe can draft bio options from truthful context you share. You review the wording, choose what represents you and update the account yourself."
      }
    ],
    sources: [
      { label: "Tinder Terms of Use", url: TINDER_TERMS },
      { label: "Pew Research Center: key findings about online dating in the U.S.", url: PEW_ONLINE_DATING }
    ],
    relatedSlugs: ["tinder-profile-review", "how-to-get-more-tinder-matches", "first-message-after-match"]
  },
  {
    slug: "first-message-after-match",
    title: "First message after a match: detail, thought, question",
    eyebrow: "First message after matching",
    description:
      "Write a first message from one profile detail, add a genuine thought and make the reply easy—without copied lines, pressure or impersonation.",
    intro:
      "The first message does not need to be extraordinary. It needs to prove that you noticed the person, offer a little of your own personality and create an easy next step for a real conversation.",
    readingTime: "8 min read",
    sections: [
      {
        title: "Choose one piece of real context",
        paragraphs: [
          "Start with a photo, prompt, bio detail or stated interest. Choose something you genuinely want to discuss, not a fact you selected only because it seems like an opening technique.",
          "Hinge's public conversation-starter guidance centers profile context. The same principle transfers across apps: attention is more useful than a line that could be sent unchanged to every match."
        ],
        bullets: [
          "A place you recognize",
          "An activity you also enjoy or want to understand",
          "A specific opinion in a prompt",
          "A detail with an obvious story behind it"
        ]
      },
      {
        title: "Use detail + thought + answerable question",
        paragraphs: [
          "Name the detail, add a short reaction or connection of your own and ask one question that can be answered without an essay. You are contributing to the exchange rather than assigning the other person an interview task.",
          "Not every message needs a question mark. A playful observation can work when it clearly invites a response, but do not make the other person guess what you mean."
        ],
        example: {
          label: "Example",
          text: "“That ceramics photo looks dangerously convincing. I tried one class and made a very uneven bowl—what's the piece you're proudest of?”"
        }
      },
      {
        title: "Adapt the structure to the app and profile",
        paragraphs: [
          "On Hinge, respond directly to the photo or prompt that created the match. On Tinder or Bumble, use the strongest available detail from the full profile. If the profile is sparse, ask about a visible setting or offer a simple choice instead of inventing familiarity.",
          "Keep the message proportionate. One or two sentences usually leave more room for a reply than a paragraph covering several topics. Bumble's standing-out guidance and Hinge's conversation material are useful current references, but your words should remain your own."
        ],
        example: {
          label: "Sparse-profile option",
          text: "“Quick choice: neighborhood coffee or a walk somewhere with a view? I keep changing my answer depending on the weather.”"
        }
      },
      {
        title: "Protect consent, accuracy and your own voice",
        paragraphs: [
          "Do not open with sexual pressure, invasive research, an invented shared interest or a copied insult. If there is no reply, repeated messages do not turn silence into consent.",
          "NoSwipe can draft options from the context you choose to share. Read, edit and send the final message yourself. The goal is assistance without impersonation, and no opener can guarantee a reply."
        ]
      }
    ],
    checklist: [
      "The opener refers to one real profile detail",
      "You add a thought rather than only asking a question",
      "Any question is easy and relevant",
      "The length fits a first exchange",
      "Nothing is sexual, invasive, deceptive or copied",
      "You review and send the message yourself"
    ],
    faqs: [
      {
        question: "What if the profile gives me nothing to message about?",
        answer:
          "Use a visible setting, a simple preference choice or a straightforward greeting with one specific question. Do not invent knowledge about the person or investigate private information."
      },
      {
        question: "Should I compliment her appearance in the first message?",
        answer:
          "A respectful compliment can be genuine, but a profile detail often gives the conversation more room to continue. Avoid sexual comments or language that could be pasted onto anyone."
      },
      {
        question: "Will NoSwipe send the first message for me?",
        answer:
          "No. NoSwipe drafts message options from the screenshots or context you provide. You decide what is accurate, edit it and press send yourself."
      }
    ],
    sources: [
      { label: "Hinge Conversation Starters", url: HINGE_CONVERSATIONS },
      { label: "Bumble Support: standing out on Bumble", url: BUMBLE_STAND_OUT },
      { label: "Hinge Terms of Service", url: HINGE_TERMS },
      { label: "Bumble Terms and Conditions", url: BUMBLE_TERMS }
    ],
    relatedSlugs: ["dating-message-help", "when-to-ask-her-out", "hinge-prompts-for-men"]
  },
  {
    slug: "when-to-ask-her-out",
    title: "When to ask her out on a dating app",
    eyebrow: "When to ask her out",
    description:
      "Recognize mutual engagement, make a specific low-pressure invitation and handle yes, no or silence respectfully without relying on a fixed message count.",
    intro:
      "There is no universal number of messages before asking someone out. The better signal is whether the exchange is mutual, specific enough to support a plan and comfortable enough that a direct invitation feels like the next step rather than a sudden demand.",
    readingTime: "8 min read",
    sections: [
      {
        title: "Look for mutual participation, not a timer",
        paragraphs: [
          "Useful signs include answers with substance, questions coming back to you, shared humor and a topic that could naturally continue in person. A few engaged messages can contain more connection than days of one-word replies.",
          "Do not treat friendliness as an obligation. If you are carrying every topic, receiving repeated non-answers or seeing a stated wish to stay on the app longer, slow down and respect that pace."
        ],
        bullets: [
          "Both people contribute details",
          "Questions or curiosity move both ways",
          "The conversation has a natural shared topic",
          "There is no unresolved boundary or hesitation"
        ]
      },
      {
        title: "Make the invitation complete and easy to answer",
        paragraphs: [
          "A clear invitation names the activity, suggests a public place or area and offers a realistic time window. Connect it to the conversation when possible so the plan feels considered rather than copied.",
          "Leave room to adjust. A complete suggestion reduces planning work; flexibility shows that the other person's travel, schedule and comfort matter too."
        ],
        example: {
          label: "Example",
          text: "“I'm enjoying this. Want to continue it over coffee at [place] this weekend? I can do Saturday afternoon or Sunday morning, and I'm happy to pick another area if that's easier.”"
        }
      },
      {
        title: "Respond well to yes, no, maybe or silence",
        paragraphs: [
          "If the answer is yes, agree the final place and time, then confirm without over-managing. If they suggest another time, treat that as useful planning information. If they decline without an alternative, accept it plainly.",
          "Silence is not a negotiation. One normal follow-up may be appropriate when plans were already being discussed, but repeated nudges or guilt do not create consent. No message framework can guarantee a date."
        ],
        example: {
          label: "Respectful responses",
          text: "Yes: confirm the details. Maybe: offer one adjustment. No: “No worries—thanks for being clear.” Silence: leave room instead of escalating."
        }
      },
      {
        title: "Keep the plan public, accurate and user-confirmed",
        paragraphs: [
          "Check current opening hours, price level, accessibility and travel before naming a venue. A public, easy-to-leave first meeting gives both people control over their own arrival and departure.",
          "NoSwipe can draft the invitation and help compare date-plan options from the context you provide. You verify the real details, send the invitation and personally confirm the plan."
        ]
      }
    ],
    checklist: [
      "The conversation shows mutual participation",
      "The invitation connects to something you discussed",
      "The activity and time window are specific",
      "The venue is public and practical for both people",
      "The wording leaves room to decline or adjust",
      "You send and confirm every detail yourself"
    ],
    faqs: [
      {
        question: "How many messages should I send before asking her out?",
        answer:
          "Use mutual engagement rather than a fixed count. Ask when both people are contributing and you have enough context to suggest a simple, relevant plan."
      },
      {
        question: "Should I ask for her number before the date?",
        answer:
          "You can offer to exchange numbers for logistics, but keep the app available if she prefers it. A date does not require moving the conversation off-platform before she is comfortable."
      },
      {
        question: "Can NoSwipe book or confirm the date for me?",
        answer:
          "No. NoSwipe can draft a plan and invitation. You verify the venue, send the message and agree every detail directly with the other person."
      }
    ],
    sources: [
      { label: "Hinge Conversation Starters", url: HINGE_CONVERSATIONS },
      { label: "Pew Research Center: key findings about online dating in the U.S.", url: PEW_ONLINE_DATING },
      { label: "Tinder Terms of Use", url: TINDER_TERMS },
      { label: "Bumble Terms and Conditions", url: BUMBLE_TERMS }
    ],
    relatedSlugs: ["first-message-after-match", "dating-message-help", "first-date-planning"]
  }
];
