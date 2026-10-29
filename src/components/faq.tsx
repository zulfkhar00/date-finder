"use client";

import * as Accordion from "@radix-ui/react-accordion";
import { Plus } from "lucide-react";

const faqs = [
  { q: "What do I actually do?", a: "Tell us what help you want and share only the photos or screenshots you choose. NoSwipe prepares profile suggestions, message drafts and date plans. You keep your accounts, choose who to like and send every message yourself." },
  { q: "Is it my profile and my photos?", a: "Yes. Your own profiles on Tinder, Bumble and Hinge, with your real photos. We can rank them and suggest edits, but never fake or replace them." },
  { q: "Does NoSwipe access my dating apps?", a: "No. We work from the context you choose to share. We do not log in, swipe, like profiles, send messages or confirm dates for you." },
  { q: "Do you guarantee dates?", a: "No. Profile advice, message drafts and date plans cannot guarantee a match, reply or date. The $1 early-access waitlist fee is refundable." }
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
