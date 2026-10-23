import testimonials from "@/content/testimonials.json";

type Testimonial = { name: string; age: number; city: string; quote: string; consent: boolean };

/**
 * Renders only real pilot quotes with consent. The JSON ships empty, so this renders nothing
 * until a real member says yes. Never add invented quotes: the FTC's 2024 rule (16 CFR 465)
 * makes fake testimonials a civil-penalty violation.
 */
export function Testimonials() {
  const items = (testimonials as Testimonial[]).filter((item) => item.consent === true && item.quote.trim().length > 0);
  if (items.length === 0) return null;
  return (
    <section className="section shell" aria-labelledby="testimonials-title">
      <p className="kicker">From founding members</p>
      <h2 id="testimonials-title" className="h2">In their words.</h2>
      <div className="quote-grid">
        {items.map((item) => (
          <figure className="quote-card" key={`${item.name}-${item.city}`}>
            <blockquote>“{item.quote}”</blockquote>
            <figcaption>{item.name}, {item.age} · {item.city}</figcaption>
          </figure>
        ))}
      </div>
    </section>
  );
}
