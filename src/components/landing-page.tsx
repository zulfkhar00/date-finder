"use client";

import Image from "next/image";
import Link from "next/link";
import * as Accordion from "@radix-ui/react-accordion";
import { motion } from "motion/react";
import { ArrowDown, ArrowRight, ArrowUpRight, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SiteHeader } from "@/components/site-header";
import { ConciergeDemo } from "@/components/concierge-demo";

const faqs = [
  { q: "Can I use the concierge now?", a: "Early-access reservations are open now. Concierge invitations will be offered separately as availability opens. A waitlist reservation does not start the service or guarantee an invitation date." },
  { q: "What does the $1 pay for?", a: "It is a one-time, nonrefundable fee to reserve a place on the early-access waitlist. It is not a subscription or payment toward concierge service. We will share service pricing before you decide whether to join." },
  { q: "Does reserving a spot guarantee dates?", a: "No. A reservation does not guarantee an introduction, a date, a match, or service availability in your city. We will contact people as capacity and geography allow." },
  { q: "Is the $1 refundable?", a: "No. The $1 reservation fee is nonrefundable, except where required by law. You can decide separately whether to join the concierge if you receive an invitation." },
  { q: "What happens to my answers?", a: "We use them to understand interest in early access and to contact you if concierge access becomes available. They are stored privately and are not shown to other visitors. See our privacy note for more detail." }
];

const fadeUp = { initial: { opacity: 0, y: 24 }, whileInView: { opacity: 1, y: 0 }, viewport: { once: true, amount: 0.2 }, transition: { duration: 0.7, ease: [0.22, 1, 0.36, 1] as const } };

export function LandingPage() {
  const reveal = fadeUp;
  return (
    <>
      <SiteHeader />
      <main>
        <div className="hero-wrap">
          <section className="hero section-shell" aria-labelledby="hero-title">
            <div className="hero-copy">
              <motion.p className="eyebrow" {...reveal}><span className="eyebrow-line" /> Dating, thoughtfully arranged</motion.p>
              <motion.h1 id="hero-title" {...reveal}>Skip the swiping.<br /><em>Show up</em> for the date.</motion.h1>
              <motion.div className="hero-subrow" {...reveal}>
                <div className="hero-index">01 <span>/</span> THE IDEA</div>
                <div className="hero-intro"><p>A private dating concierge designed for busy adults: considered introductions, permission at every step, and more time for real connection. Early-access reservations are open.</p><Button asChild><Link href="/reserve">Reserve my spot <ArrowUpRight size={19} strokeWidth={1.5} /></Link></Button><span className="hero-note">$1 one-time, nonrefundable waitlist fee. Concierge access is separate.</span></div>
              </motion.div>
            </div>
            <motion.div className="hero-art" {...reveal}>
              <Image src="/images/morrow-editorial.jpg" alt="Two sculptural burgundy forms facing one another across a warm stone plinth" fill priority sizes="(max-width: 900px) 100vw, 42vw" className="hero-image" />
              <div className="art-label"><span>THE ART OF</span><strong>meeting</strong><span>IN PERSON</span></div>
              <div className="art-caption">FIG. 01 — A BETTER BEGINNING</div>
            </motion.div>
            <a className="scroll-cue" href="#how"><span>Discover the idea</span><ArrowDown size={16} /></a>
          </section>
        </div>

      <div className="statement-band"><span>LESS BROWSING</span><span className="statement-star">✳</span><span>MORE BELONGING</span><span className="statement-star">✳</span><span>MORE REAL LIFE</span></div>

      <section id="how" className="how-section section-shell">
        <motion.div className="section-heading" {...reveal}><p className="eyebrow"><span className="eyebrow-line" /> The idea</p><h2>Less searching.<br /><em>More meeting.</em></h2><p>A more considered way to date begins with understanding you. When concierge access opens, the details are handled with care and every meaningful choice stays yours.</p></motion.div>
        <div className="how-list">
          {[
            ["01", "A real understanding", "Tell us about yourself, your intentions, and the kind of connection you’re open to. Nuance matters more than a polished profile."],
            ["02", "Introductions with permission", "If invited to the concierge, you receive considered possibilities. An introduction only moves forward when you want it to."],
            ["03", "Dates worth showing up for", "If interest is mutual, the concierge is designed to arrange the details so the first meeting feels simple, calm, and human."]
          ].map(([num, title, body]) => <motion.div className="how-row" key={num} {...reveal}><span className="how-num">{num} /</span><h3>{title}</h3><p>{body}</p><ArrowUpRight size={24} strokeWidth={1.2} /></motion.div>)}
        </div>
      </section>

      <section className="why-section">
        <div className="why-main"><div className="why-kicker"><span className="eyebrow-line" /> Why Morrow</div><motion.h2 {...reveal}>Your time is valuable.<br /><em>Your love life should feel that way too.</em></motion.h2></div>
        <div className="why-aside"><p>Made for people with full lives and room for something meaningful.</p><div className="why-points"><span>01 — Fewer endless conversations</span><span>02 — More personal context</span><span>03 — Your consent at every step</span></div><Link href="/reserve">Be first to hear <ArrowUpRight size={18} /></Link></div>
      </section>

      <ConciergeDemo />

      <section id="pricing" className="pricing-section section-shell">
        <div className="pricing-top"><p className="eyebrow"><span className="eyebrow-line" /> Early access, clearly priced</p><span>01 / RESERVATION</span></div>
        <div className="pricing-grid"><div><h2>A place for<br /><em>what’s next.</em></h2><p>Reserve a place on the early-access waitlist. Concierge invitations and separate service pricing will follow as availability opens.</p></div><div className="price-panel"><div><span>ONE-TIME RESERVATION</span><strong>$1</strong></div><p>For a place on the early-access waitlist only. No recurring charge. No guaranteed date, introduction, invitation date, or availability in your city.</p><p>The $1 fee is nonrefundable, except where required by law.</p><Button asChild><Link href="/reserve">Reserve my spot <ArrowUpRight size={18} /></Link></Button></div></div>
      </section>

      <section className="faq-section section-shell" id="faq"><div className="faq-heading"><p className="eyebrow"><span className="eyebrow-line" /> The details</p><h2>Good questions.<br /><em>Clear answers.</em></h2></div><Accordion.Root type="single" collapsible className="faq-list">{faqs.map((item, index) => <Accordion.Item value={`item-${index}`} key={item.q} className="faq-item"><Accordion.Header><Accordion.Trigger className="faq-trigger"><span>{String(index + 1).padStart(2, "0")}</span><strong>{item.q}</strong><Plus size={21} strokeWidth={1.4} /></Accordion.Trigger></Accordion.Header><Accordion.Content className="faq-content"><p>{item.a}</p></Accordion.Content></Accordion.Item>)}</Accordion.Root></section>

      <section className="closing-section"><div className="section-shell closing-inner"><p className="eyebrow eyebrow-light"><span className="eyebrow-line" /> The next chapter starts here</p><h2>Less almost.<br /><em>More actually.</em></h2><div className="closing-row"><p>Make room for a different way to meet. Reserve early access for $1.</p><Button asChild variant="light"><Link href="/reserve">Reserve my spot <ArrowRight size={19} /></Link></Button></div></div></section>
      </main>
      <footer className="site-footer section-shell"><div className="footer-top"><Link href="/" className="wordmark">morrow<span>.</span></Link><p>Dating, thoughtfully arranged.<br />Currently accepting early-access reservations.</p><a href="#hero-title">Back to top ↑</a></div><div className="footer-bottom"><span>© {new Date().getFullYear()} Morrow</span><div><Link href="/privacy">Privacy</Link><Link href="/terms">Reservation terms</Link><Link href="/#faq">FAQ</Link></div></div></footer>
    </>
  );
}
