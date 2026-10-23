"use client";

import * as Accordion from "@radix-ui/react-accordion";
import { Plus } from "lucide-react";

const faqs = [
  { q: "What do I actually do?", a: "Almost nothing. Two minutes now to tell us about you and your type. When your batch starts, you send your real photos. Then we build your profiles, swipe, chat with your matches and book the date. You show up." },
  { q: "Is it my profile and my photos?", a: "Yes. Your own profiles on Tinder, Bumble and Hinge, with your real photos. We pick the best ones and polish them, never fake or swap them." },
  { q: "Does she know?", a: "She’s chatting with your profile: your photos, your real details, written the way you talk. Once she shares her number, it’s you who texts her and you who goes on the date." },
  { q: "What’s the $1, and do you guarantee dates?", a: "We’re onboarding in small batches, and the $1 reserves your spot in the next one. It isn’t a subscription and it doesn’t buy dates, matches or the service. The $1 fee is nonrefundable, except where required by law. We don’t guarantee dates, and nobody honestly can. When your batch starts we confirm the real price (planned: pay only for dates you get) and you decide then." }
];

export function Faq() {
  return (
    <section id="faq" className="section shell faq-grid" aria-labelledby="faq-title">
      <div>
        <p className="kicker">FAQ</p>
        <h2 id="faq-title" className="h2">Fair questions.</h2>
        <p className="lede">Short answers, no fine-print tricks.</p>
      </div>
      <Accordion.Root type="single" collapsible className="faq-list" defaultValue="item-0">
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
