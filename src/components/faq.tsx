"use client";

import * as Accordion from "@radix-ui/react-accordion";
import { Plus } from "lucide-react";

const faqs = [
  { q: "Is this a bot?", a: "No. Nothing here talks to her for you. We use AI to help draft your profile, openers and replies, and during the first pilot a real person on our team checks every draft before you see it. You read it, change it if you want, and send it yourself." },
  { q: "Do you log into my Tinder?", a: "Never. We don’t ask for your password, we don’t log in, swipe, or message anyone from your account. You send us screenshots, we send back drafts. That also keeps your account safe: apps ban automation, and we don’t do any." },
  { q: "What’s the $1 for?", a: "It’s a one-time waitlist fee that holds your place in line. It isn’t a subscription and it doesn’t buy dates, matches or the service itself. When your spot opens, we’ll show you the real pricing and you decide whether to join." },
  { q: "Is the $1 refundable?", a: "No. The $1 waitlist fee is nonrefundable, except where required by law." },
  { q: "Does it guarantee me dates?", a: "No. Nobody can honestly promise that. A waitlist spot doesn’t guarantee an invitation date, availability in your city, a match or a date. What we can do is fix the things that are costing you matches and conversations." },
  { q: "Which apps does it work with?", a: "We’re starting with Tinder. Because everything runs off screenshots, Hinge, Bumble and Badoo work the same way, at no extra cost." },
  { q: "What happens to my photos and screenshots?", a: "When your spot opens, we use them only to draft your profile and replies, then delete them. We don’t train on them and we don’t share them. The waitlist itself only asks for your email, city and a few preferences." }
];

export function Faq() {
  return (
    <section id="faq" className="section shell faq-grid" aria-labelledby="faq-title">
      <div>
        <p className="kicker">FAQ</p>
        <h2 id="faq-title" className="h2">Fair questions.</h2>
        <p className="lede">Short answers, no fine-print tricks.</p>
      </div>
      <Accordion.Root type="single" collapsible className="faq-list" defaultValue="item-1">
        {faqs.map((item, index) => (
          <Accordion.Item value={`item-${index}`} key={item.q} className="faq-item">
            <Accordion.Header asChild>
              <h3 style={{ margin: 0 }}>
                <Accordion.Trigger className="faq-trigger">
                  <span>{item.q}</span>
                  <Plus size={22} strokeWidth={2.5} aria-hidden="true" />
                </Accordion.Trigger>
              </h3>
            </Accordion.Header>
            <Accordion.Content className="faq-content"><p>{item.a}</p></Accordion.Content>
          </Accordion.Item>
        ))}
      </Accordion.Root>
    </section>
  );
}
