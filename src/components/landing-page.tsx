import { ArrowDown, ShieldCheck } from "lucide-react";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { CtaLink } from "@/components/cta-link";
import { HeroPhone } from "@/components/hero-phone";
import { MatchCards } from "@/components/match-cards";
import { Faq } from "@/components/faq";
import { StickyCta } from "@/components/sticky-cta";
import { Testimonials } from "@/components/testimonials";

const strip = ["Tinder", "Bumble", "Hinge", "We build your profiles", "We swipe", "We chat", "We book the date", "You just show up"];

const steps = [
  { title: "Tell us your type", body: "A two-minute form: who you are, who you want to meet, which apps. Your real photos come later." },
  { title: "We do it all", body: "We build your profiles, swipe on the girls who fit, chat with your matches and plan the date. Not tips. We do it." },
  { title: "You just show up", body: "You get the date: day, time, place and her number. She already said yes." }
];

export function LandingPage() {
  return (
    <>
      <SiteHeader />
      <main>
        <section className="shell hero" aria-labelledby="hero-title">
          <div className="hero-copy">
            <span className="sticker">Done for you. All of it.</span>
            <h1 id="hero-title"><span className="line">We find you dates.</span><span className="line">You just <span className="mark">show up.</span></span></h1>
            <p className="hero-sub">On Tinder, Bumble and Hinge. <strong>We build your profiles, swipe, chat and book the date for you.</strong></p>
            <div className="hero-cta" id="hero-cta">
              <CtaLink location="hero" />
              <a href="#get" className="hero-alt">See what you get <ArrowDown size={16} strokeWidth={2.5} /></a>
              <p className="fine">We’re onboarding in small batches. A $1 fee, nonrefundable except where required by law, reserves your spot in the next one. It doesn’t buy dates.</p>
            </div>
          </div>
          <div className="hero-art">
            <span className="blob blob-a" aria-hidden="true" />
            <span className="blob blob-b" aria-hidden="true" />
            <span className="sticker float-sticker float-1" aria-hidden="true">we chat for you</span>
            <span className="sticker float-sticker float-2" aria-hidden="true">you just show up</span>
            <HeroPhone />
          </div>
        </section>

        <div className="strip" aria-hidden="true">
          <div className="strip-track">{[...strip, ...strip].map((item, i) => <span key={i}>{item}</span>)}</div>
        </div>

        <section id="get" className="section shell" aria-labelledby="get-title">
          <p className="kicker">What you get</p>
          <h2 id="get-title" className="h2">Dates, already booked. <span className="mark">That’s it.</span></h2>
          <p className="lede">For every date we land, you get her first name, the app, what we talked about, what she’s into, when and where, and her number.</p>
          <MatchCards />
        </section>

        <section id="how" className="section shell" aria-labelledby="how-title" style={{ paddingTop: 0 }}>
          <p className="kicker">How it works</p>
          <h2 id="how-title" className="h2">You do one thing. <span className="mark">We do the rest.</span></h2>
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
              <strong>Your real photos. Your real dates.</strong>
              <p>We pick and polish your best photos, never fake ones. We can’t promise how many dates you’ll get, and nobody honestly can. We do all the work to get them.</p>
            </div>
          </div>
        </section>

        <section id="pricing" className="section shell" aria-labelledby="pricing-title" style={{ paddingTop: 0 }}>
          <div className="pay-band">
            <div>
              <p className="kicker">Pricing</p>
              <h2 id="pricing-title" className="h2">Pay only for <span className="mark">dates you get.</span></h2>
            </div>
            <p>Planned: about $5 for each match that turns into a date. No subscription, nothing for swipes or chats that go nowhere. We’ll confirm the price before your batch starts, and you decide then.</p>
          </div>
        </section>

        <Testimonials />

        <Faq />

        <section className="section closing" aria-labelledby="closing-title">
          <div className="shell">
            <h2 id="closing-title">Stop swiping. Just show up.</h2>
            <p>Two minutes to tell us your type. We take it from there.</p>
            <CtaLink location="closing" className="btn btn-lime" />
          </div>
        </section>
      </main>
      <SiteFooter />
      <StickyCta watchId="hero-cta" />
    </>
  );
}
