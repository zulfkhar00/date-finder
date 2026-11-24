// Live demo mode: the profile each fictional match shows (bio, the app's own prompts, passions, job, distance). Invented, like everything
// in personas.ts. Hinge shows written prompts, Bumble shows question badges, Tinder shows a bio and passions.
import type { MatchProfile } from "@/lib/app/match-profile";
import type { Persona } from "./personas";

type Extra = { job: string; distanceKm: number; passions: string[]; prompts: { q: string; a: string }[] };

const EXTRA: Record<string, Extra> = {
  maya: { job: "Product designer", distanceKm: 4, passions: [], prompts: [
    { q: "The worst pizza I've ever had", a: "A gas station slice in a thunderstorm. I still think about it." },
    { q: "I'm weirdly good at", a: "Finding the one good ramen place in any city" },
    { q: "The way to win me over is", a: "Bring a plant, or a very strong opinion about noodles" }] },
  priya: { job: "Pediatric nurse", distanceKm: 7, passions: ["Pottery", "Karaoke", "Dogs", "Brunch", "Thrifting"], prompts: [] },
  chloe: { job: "Grad student", distanceKm: 3, passions: [], prompts: [
    { q: "My simple pleasures", a: "First sip of coffee, a good movie nobody's heard of, rain on the window" },
    { q: "I'm looking for", a: "Someone who'll try the weird dish on the menu with me" }] },
  zoe: { job: "Illustrator", distanceKm: 9, passions: ["Climbing", "Vinyl", "Drawing", "Soul music", "Cats"], prompts: [] },
  hannah: { job: "Pastry cook", distanceKm: 6, passions: [], prompts: [
    { q: "A Sunday well spent", a: "Long trail run, then bread, then more bread" },
    { q: "Together we could", a: "Bake something ambitious and eat it before it cools" },
    { q: "My most irrational fear", a: "A sourdough starter that stops bubbling" }] },
  amara: { job: "Marketing lead", distanceKm: 5, passions: [], prompts: [
    { q: "My simple pleasures", a: "A tiny stall, no menu, and whatever the cook hands me" },
    { q: "Two truths and a lie", a: "I've been to 31 countries. I hate spicy food. I once missed a flight on purpose." }] },
  leila: { job: "Architect", distanceKm: 8, passions: [], prompts: [
    { q: "I get along best with people who", a: "Notice the light at 7 a.m. and aren't annoyed that I do" },
    { q: "Typical Sunday", a: "Walk across the city, jazz in the evening, strong opinions about door handles" },
    { q: "I'm overly competitive about", a: "Naming the building on the skyline first" }] },
  jess: { job: "Physical therapist", distanceKm: 11, passions: ["Surfing", "Tacos", "Road trips", "Yoga", "Live music"], prompts: [] },
  sophie: { job: "UX researcher", distanceKm: 2, passions: [], prompts: [
    { q: "My simple pleasures", a: "A new board game, a warm oven, a very long text thread" },
    { q: "I'm looking for", a: "A teammate for game night, someone who loses loudly and laughs" }] },
  camila: { job: "Civil engineer", distanceKm: 6, passions: [], prompts: [
    { q: "Dating me is like", a: "A Thursday night salsa class: a little chaotic, lots of fun" },
    { q: "My love language is", a: "Cooking you my grandmother's rice and beans" },
    { q: "Don't hate me if I", a: "Correct the structure of a bridge in a photo" }] },
  nadia: { job: "Editor", distanceKm: 5, passions: ["Bookshops", "Long walks", "Tea", "Museums", "Poetry"], prompts: [] },
  emily: { job: "Teacher", distanceKm: 4, passions: [], prompts: [
    { q: "My simple pleasures", a: "Saturday farmers market, a perfect peach, my camera roll" },
    { q: "Best travel story", a: "Got lost in a tiny town and ended up at a stranger's family lunch" }] },
  mei: { job: "Data analyst", distanceKm: 7, passions: [], prompts: [
    { q: "I'm weirdly good at", a: "Folding dumplings and winning pub trivia" },
    { q: "Typical Sunday", a: "Tennis in the morning, dumplings by noon" },
    { q: "The key to my heart is", a: "A good rally and a better sauce" }] },
  tara: { job: "Veterinary tech", distanceKm: 10, passions: ["Gardening", "Stand-up", "Cats", "Hiking", "Board games"], prompts: [] }
};

export function profileFor(p: Persona): MatchProfile {
  const x = EXTRA[p.slug];
  return {
    bio: p.bio, job: x.job, distanceKm: x.distanceKm, passions: x.passions, prompts: x.prompts,
    photos: [`demo/${p.slug}.jpg`, `demo/${p.slug}-2.jpg`, `demo/${p.slug}-3.jpg`]
  };
}

/** The same profile with its photo paths moved into the user's own folder (where the owner's signed URLs work). */
export function profileForUser(p: Persona, userId: string): MatchProfile {
  const base = profileFor(p);
  return { ...base, photos: base.photos.map((path) => `${userId}/${path}`) };
}

export const PHOTO_SUFFIXES = ["", "-2", "-3"] as const;
