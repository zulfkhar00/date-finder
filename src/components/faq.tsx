"use client";

import * as Accordion from "@radix-ui/react-accordion";
import { Plus } from "lucide-react";
import { faqs } from "@/content/faq";


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
