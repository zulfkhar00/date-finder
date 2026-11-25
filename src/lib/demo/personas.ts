// Live demo mode: fictional matches. Every person here is made up: the names, ages, bios and chats are invented, and the portraits are
// synthetic StyleGAN faces of people who do not exist (see docs/live-demo.md for the source and licence). Pure data, no I/O.
//
// A script is the whole chat, in order, starting with `opener`. The last three turns are always: Miko proposes a time and place, she says
// yes, Miko closes. `{day}`, `{time}` and `{venue}` are filled in from the planned date, so a canned line and the booked date agree.
// These lines are also the fallback when the model is unavailable or the daily cap is hit, and the "direction" the model rewrites.
import type { App } from "@/lib/app/domain";

export type Persona = {
  slug: string; name: string; age: number; app: App; bio: string; interest: string;
  /** Who writes first: her (a match opens the chat) or him (NoSwipe opens it as Miko). */
  opener: "her" | "him";
  script: string[];
};

export const PERSONAS: readonly Persona[] = [
  { slug: "maya", name: "Maya", age: 27, app: "hinge", interest: "ramen and weekend hikes", opener: "her",
    bio: "Product designer. Weekend hiker, ramen snob, owns too many plants.",
    script: [
      "ok your hinge prompt about the worst pizza you've ever had made me laugh out loud",
      "ha, it was truly a crime scene. i'm still recovering. what's your go-to for a good one?",
      "thin crust, nothing on it except basil. i'm very serious about this",
      "respect. i'm more of a ramen person, if i'm honest. do you have a place you swear by?",
      "i've been on a quest for the best tonkotsu for like a year. i'll make you a list",
      "do it. actually, better idea, {day} at {time}? we could try a spot called {venue} and you can rate it",
      "ok deal, {day} {time} works for me. i'm bringing a scoring sheet",
      "perfect, see you at {venue}. i'll save us a table"
    ] },
  { slug: "priya", name: "Priya", age: 26, app: "tinder", interest: "pottery and bad karaoke", opener: "him",
    bio: "Pediatric nurse. Pottery on Sundays, karaoke on bad days.",
    script: [
      "hey priya, the pottery photo got me. is that a mug or a very ambitious bowl?",
      "it was supposed to be a mug. it's a bowl now, we don't talk about it",
      "i respect the pivot. do you make things on purpose or just let the clay decide?",
      "clay decides. my teacher says that's the whole philosophy. also karaoke, which i'm much worse at",
      "now i need to hear a karaoke song. what's your closer?",
      "total eclipse of the heart. no further questions",
      "{day} at {time}, i'd love to hear it in person. a place called {venue}, drinks first and then we see about karaoke",
      "{day} at {time} sounds great. fair warning, i'll pick a power ballad",
      "excellent. {venue} then, i'll be the one clapping loudest"
    ] },
  { slug: "chloe", name: "Chloe", age: 25, app: "bumble", interest: "coffee and indie films", opener: "her",
    bio: "Grad student, coffee person, will recommend you a movie you've never heard of.",
    script: [
      "ok i have to ask, the dog in your third photo, yours or borrowed?",
      "borrowed from a friend for the day, he's a legend though. do you have one?",
      "no, just a very judgmental cat. so what do you do when you're not out with other people's dogs?",
      "mostly work, a bit of cooking, and chasing a good cup of coffee on weekends",
      "same! i know every decent coffee place within two miles. it's a problem",
      "then you have to show me your favorite. {day} at {time}? i'm thinking {venue}",
      "yes, {day} at {time} works. i'll even let you order for me",
      "deal. see you at {venue}, i'll find us a corner"
    ] },
  { slug: "zoe", name: "Zoe", age: 24, app: "tinder", interest: "climbing and vinyl records", opener: "him",
    bio: "Illustrator. Climbing gym regular, vinyl collector, dry sense of humor.",
    script: [
      "hey zoe, climbing and vinyl in the same bio, you've got my attention. what are you spinning lately?",
      "right now it's a lot of old soul records, they make cleaning the apartment feel like a movie",
      "that's the correct way to clean. anything you'd put on for a first date playlist?",
      "ha, bold question. something with horns in it, that's all i'll say",
      "horns it is. i've been trying to get better at climbing, any tips for a total beginner?",
      "trust your feet, not your arms. you'd pick it up fast, i can tell",
      "i'd like to find out. are you free {day} at {time}? there's a place called {venue} I'd like to take you to, then we can plan a climb",
      "sure, {day} at {time}. you're buying the first round for that line",
      "fair. see you at {venue}"
    ] },
  { slug: "hannah", name: "Hannah", age: 29, app: "hinge", interest: "baking and trail running", opener: "her",
    bio: "Pastry cook. Trail runner, sourdough starter named Gerald.",
    script: [
      "your answer about cooking for friends on sundays was weirdly sweet. what's on the menu usually?",
      "ha thanks. usually something with way too much garlic. do you bake at all?",
      "professionally, so i judge everyone's bread a little bit. gently",
      "then i'm going to be nervous, my sourdough has a lot of personality",
      "send a photo, i'll be kind. mostly",
      "you could just bring it. {day} at {time}? i'd like to take you out first though, {venue}",
      "ok that sounds nice. {day} at {time}, and yes i'm bringing opinions",
      "looking forward to it. {venue}, see you there"
    ] },
  { slug: "amara", name: "Amara", age: 28, app: "bumble", interest: "travel and street food", opener: "him",
    bio: "Marketing lead. Always planning the next trip, will follow the smell of street food anywhere.",
    script: [
      "hey amara, last trip you posted looked unreal. where was your favorite meal?",
      "a tiny stall in a night market, no menu, the guy just handed me things. best meal of the year",
      "that's the dream. i'm trying to say yes to more of that, less planning, more wandering",
      "good plan. the best stuff always happens when you stop checking the map",
      "agreed. so i know a spot called {venue}, {day} at {time}, nothing fancy",
      "{day} at {time}... yes, i'm in. i'm hungry already",
      "see you at {venue} then, come hungry"
    ] },
  { slug: "leila", name: "Leila", age: 30, app: "hinge", interest: "architecture walks and jazz", opener: "her",
    bio: "Architect. Walks cities for fun, jazz on weeknights, strong opinions about door handles.",
    script: [
      "i have to know, what's the story behind the bridge photo?",
      "it's my favorite spot on my morning walk, the light is perfect around 7. you into early mornings?",
      "unfortunately yes. it's the only time the city is quiet",
      "same reason i like it. do you ever go to live music in the evenings?",
      "every week when i can, a tiny jazz bar near my place. a bit of a secret",
      "i'd love to hear about it in person. {day} at {time}? we could start at {venue}",
      "you're on, {day} at {time}. i'm picking the route there",
      "perfect, {venue} it is. see you then"
    ] },
  { slug: "jess", name: "Jess", age: 26, app: "tinder", interest: "surfing and tacos", opener: "him",
    bio: "Physical therapist. Surfs badly, eats tacos extremely well.",
    script: [
      "hey jess, the surf photo looks great, how long have you been doing it?",
      "three years and i still spend most of the time falling off. but the mornings are worth it",
      "that's the right attitude. i've been wanting to try for ages",
      "you should, i'd happily laugh at you from the beach",
      "fair enough. okay, important question: best taco order?",
      "al pastor, two limes, no debate. you?",
      "carnitas, strong opinions. let's settle it properly, {day} at {time} at {venue}?",
      "taco summit, {day} at {time}. i'm in",
      "great, see you at {venue}"
    ] },
  { slug: "sophie", name: "Sophie", age: 25, app: "bumble", interest: "board games and baking", opener: "her",
    bio: "UX researcher. Board game nights, chaotic baker, asks too many questions.",
    script: [
      "ok your bio said you lose at board games gracefully, i don't believe it",
      "ha, i lose loudly but then i buy the next round. does that count?",
      "that's the correct answer, you pass. what's your game of choice?",
      "something cooperative, i like winning with other people more than against them",
      "i can't tell if that's sweet or a trick. i'll find out",
      "fair. {day} at {time}, {venue}? i'll bring a game if you bring the competitive spirit",
      "ok {day} at {time}. i'll bring the cards. be afraid",
      "deal. {venue}, see you there"
    ] },
  { slug: "camila", name: "Camila", age: 28, app: "hinge", interest: "salsa and cooking", opener: "him",
    bio: "Civil engineer. Salsa on Thursdays, cooks like her grandmother taught her.",
    script: [
      "hey camila, salsa on thursdays, that's a real commitment. how long have you been dancing?",
      "since college, it started as an excuse to leave the library and never stopped",
      "best reason ever. i have two left feet but i'm willing to be taught",
      "that's a promise, i'm a very patient teacher. mostly",
      "i'll hold you to that. what's your best dish to cook?",
      "my grandmother's rice and beans, nobody's ever beaten it",
      "now i'm hungry and curious. {day} at {time} at {venue}, maybe we start there?",
      "yes, {day} at {time} sounds perfect",
      "see you at {venue}"
    ] },
  { slug: "nadia", name: "Nadia", age: 27, app: "tinder", interest: "bookshops and long walks", opener: "her",
    bio: "Editor. Lives in bookshops, walks everywhere, slow texter, fast talker.",
    script: [
      "hi, your photo outside that bookshop, are you a browser or a buyer?",
      "buyer, every time. my shelf is a disaster. you?",
      "same, i have a stack i keep promising to read. what's the best book you've read this year?",
      "something about a lighthouse, i won't spoil it. what about you?",
      "i'll tell you if you tell me where you'd take someone for a good walk",
      "easy, there's a path by the water that's perfect at sunset. {day} at {time}? we can start at {venue}",
      "{day} at {time}, yes. bring the lighthouse book recommendation",
      "will do. see you at {venue}"
    ] },
  { slug: "emily", name: "Emily", age: 26, app: "bumble", interest: "farmers markets and photography", opener: "him",
    bio: "Teacher. Farmers market on Saturdays, takes photos of everything, laughs easily.",
    script: [
      "hey emily, your photos have a really good eye, is that a hobby or a job?",
      "total hobby, i take way too many pictures of food and sidewalks",
      "sidewalks are underrated. do you have a favorite subject?",
      "strangers' dogs, mostly. they never ask for the pictures back",
      "that's genuinely a great answer. do you go to the market on saturdays?",
      "religiously. the peaches are a personal obsession",
      "i like that. {day} at {time}? there's a place called {venue} that you'd like, then you can tell me about the peaches",
      "{day} at {time} works for me. i'll bring my camera, if that's ok",
      "bring it. see you at {venue}"
    ] },
  { slug: "mei", name: "Mei", age: 29, app: "hinge", interest: "dumplings and tennis", opener: "her",
    bio: "Data analyst. Tennis on weekends, dumpling expert, competitive about trivia.",
    script: [
      "ok i have to ask, the dumpling emoji in your bio, are you actually any good at making them?",
      "decent at folding, terrible at the dough. it's a work in progress",
      "the dough is the whole thing! i'm very serious about this, my family has opinions",
      "now i'm intimidated. do you play any sports, or is it all dumplings?",
      "tennis, mostly badly, with a lot of enthusiasm",
      "love that. {day} at {time}? i'd like to take you for dumplings, {venue}, then you can judge my folding",
      "ok {day} at {time}, i'll be the judge",
      "perfect. {venue}, see you there"
    ] },
  { slug: "tara", name: "Tara", age: 31, app: "tinder", interest: "gardening and stand-up comedy", opener: "him",
    bio: "Veterinary tech. Balcony gardener, stand-up comedy regular, cat person.",
    script: [
      "hey tara, a balcony garden is impressive. what's actually growing?",
      "tomatoes, mint, and a lemon tree that's mostly stubborn. it's my little jungle",
      "a stubborn lemon tree is the best kind. do you go to comedy nights a lot?",
      "most weeks, there's a small club near me. the worst jokes are the best part",
      "i'm in for the worst jokes. who's your favorite comic?",
      "an old special i've watched way too many times, i quote it constantly",
      "that sounds like my kind of person. {day} at {time}, {venue}, and we can swap favorite bits?",
      "yes, {day} at {time}. i'll bring my best quote",
      "see you at {venue}, can't wait"
    ] }
];

/** Venue names are invented on purpose: no real business appears in a demo. Each pairs with a short address line. */
export const VENUES: readonly { name: string; kind: string }[] = [
  { name: "Fern & Co. coffee", kind: "coffee" },
  { name: "The Corner Table", kind: "dinner" },
  { name: "Little Hollow wine bar", kind: "drinks" },
  { name: "Juniper rooftop", kind: "drinks" },
  { name: "Harbor Street Tacos", kind: "dinner" },
  { name: "Paper Crane ramen", kind: "dinner" },
  { name: "Bright Eyes bakery cafe", kind: "coffee" },
  { name: "The Lantern pub", kind: "drinks" }
];
