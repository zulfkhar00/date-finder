import { ArrowDown, Check, ShieldCheck } from "lucide-react";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { CtaLink } from "@/components/cta-link";
import { HeroPhone } from "@/components/hero-phone";
import { FixMyText } from "@/components/fix-my-text";
import { MatchStack } from "@/components/match-stack";
import { Faq } from "@/components/faq";
import { StickyCta } from "@/components/sticky-cta";
import { Testimonials } from "@/components/testimonials";
import { getLivePaidCount, PUBLIC_COUNT_MIN } from "@/lib/waitlist-count";

const apps = ["Tinder", "Hinge", "Bumble", "Badoo", "Works off screenshots", "You send every message", "No bots, no logins"];

const steps = [
  { title: "Send us your stuff", body: "Your photos, plus screenshots of your profile and the chats that went quiet. Takes five minutes on your phone." },
  { title: "We rebuild your profile and write your texts", body: "Best photos picked and ordered, a bio and prompts that sound like you, and openers and replies for every chat." },
  { title: "You hit send. You go on the date.", body: "Copy, paste, send from your own phone. When it’s time to ask her out, we tell you, and help plan the date." }
];

async function FoundingMembers() {
  const count = await getLivePaidCount();
  const showCount = count !== null && count >= PUBLIC_COUNT_MIN;
  return (
    <section className="section shell" aria-labelledby="founding-title" style={{ paddingTop: 0 }}>
      <div className="founding">
        <div>
          <p className="kicker">Founding members</p>
          <h2 id="founding-title" className="h2" style={{ fontSize: "clamp(36px,7vw,60px)" }}>First in line, first to get a fixed profile.</h2>
          <p className="lede">We’ll start small and do it properly: a first group of guys, with a real person checking every draft. Spots open in the order people joined.</p>
        </div>
        <div>
          {showCount && (
            <p className="counter" style={{ marginBottom: 18 }}>
              <strong>{count.toLocaleString("en-US")}</strong>
              <span>guys already in line</span>
            </p>
          )}
          <ul className="founding-list">
            <li><span className="check-dot"><Check size={14} strokeWidth={3.5} /></span> First concierge spots, in queue order</li>
            <li><span className="check-dot"><Check size={14} strokeWidth={3.5} /></span> Real pricing shown before you pay for anything else</li>
            <li><span className="check-dot"><Check size={14} strokeWidth={3.5} /></span> An email the moment your spot opens</li>
          </ul>
          <div style={{ marginTop: 22 }}><CtaLink location="founding" /></div>
        </div>
      </div>
    </section>
  );
}

export function LandingPage() {
  return (
    <>
      <SiteHeader />
      <main>
        <section className="shell hero" aria-labelledby="hero-title">
          <div className="hero-copy">
            <span className="sticker">For guys on Tinder, Hinge &amp; Bumble</span>
            <h1 id="hero-title"><span className="line">Stop swiping.</span><span className="line">Start <span className="mark">dating.</span></span></h1>
            <p className="hero-sub">Few matches? Chats that die after “haha”? <strong>We rebuild your profile and write your texts.</strong> You hit send and go on the date. We never touch your account.</p>
            <div className="hero-cta" id="hero-cta">
              <CtaLink location="hero" />
              <a href="#demo" className="hero-alt">Try the demo <ArrowDown size={16} strokeWidth={2.5} /></a>
              <p className="fine">$1 one-time waitlist fee, nonrefundable except where required by law. It holds your place in line. It doesn’t buy dates.</p>
            </div>
          </div>
          <div className="hero-art">
            <span className="blob blob-a" aria-hidden="true" />
            <span className="blob blob-b" aria-hidden="true" />
            <span className="sticker float-sticker float-1" aria-hidden="true">no bots</span>
            <span className="sticker float-sticker float-2" aria-hidden="true">you hit send</span>
            <HeroPhone />
          </div>
        </section>

        <div className="strip" aria-hidden="true">
          <div className="strip-track">{[...apps, ...apps].map((item, i) => <span key={i}>{item}</span>)}</div>
        </div>

        <FixMyText />

        <MatchStack />

        <section id="how" className="section shell" aria-labelledby="how-title" style={{ paddingTop: 0 }}>
          <p className="kicker">How it works</p>
          <h2 id="how-title" className="h2">Three steps. <span className="mark">Zero swiping.</span></h2>
          <ol className="how-grid" style={{ listStyle: "none", padding: 0 }}>
            {steps.map((step, i) => (
              <li className="how-card" key={step.title}>
                <span className="how-step">{i + 1}</span>
                <h3>{step.title}</h3>
                <p>{step.body}</p>
              </li>
            ))}
          </ol>
          <div className="promise">
            <ShieldCheck size={30} strokeWidth={2.2} aria-hidden="true" />
            <div>
              <strong>You send every message. We never touch your account.</strong>
              <p>No passwords, no logins, no auto-swiping, no messages sent for you. Screenshots in, drafts out. Your account stays yours, and stays safe.</p>
            </div>
          </div>
        </section>

        <FoundingMembers />

        <Testimonials />

        <section id="pricing" className="section shell" aria-labelledby="pricing-title">
          <p className="kicker">Pricing</p>
          <h2 id="pricing-title" className="h2"><span className="mark">$1</span> to get in line.</h2>
          <div className="price-grid">
            <div className="price-card now">
              <span className="tag">Open now</span>
              <p className="amount">$1<small>one time</small></p>
              <h3>Waitlist spot</h3>
              <p>Holds your place in line. Not a subscription, and it doesn’t buy dates, matches or the service. Nonrefundable, except where required by law.</p>
              <CtaLink location="pricing" className="btn btn-white" />
            </div>
            <div className="price-card planned">
              <span className="tag">Planned</span>
              <p className="amount">$19</p>
              <h3>Profile rebuild</h3>
              <p>Photos picked and ordered, bio and prompts rewritten, for the apps you use.</p>
            </div>
            <div className="price-card planned">
              <span className="tag">Planned</span>
              <p className="amount">$5<small>per date</small></p>
              <h3>Per date you book</h3>
              <p>Openers, replies and the ask-out. You only pay when a date is actually on the calendar.</p>
            </div>
          </div>
          <p className="price-note">Planned pricing may change. We’ll show you the real price when your spot opens, and you decide then. The $1 is the only thing you pay today.</p>
        </section>

        <Faq />

        <section className="section closing" aria-labelledby="closing-title">
          <div className="shell">
            <h2 id="closing-title">Your next date is one good text away.</h2>
            <p>Get on the list for $1. We’ll email you when your spot opens.</p>
            <CtaLink location="closing" className="btn btn-lime" />
          </div>
        </section>
      </main>
      <SiteFooter />
      <StickyCta watchId="hero-cta" />
    </>
  );
}
