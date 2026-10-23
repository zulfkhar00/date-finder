import "server-only";
import Stripe from "stripe";

export function getStripe() {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("Stripe server configuration is missing");
  return new Stripe(key);
}

export function getSiteUrl() {
  const value = process.env.SITE_URL ?? (process.env.NODE_ENV === "development" ? "http://localhost:3000" : undefined);
  if (!value) throw new Error("SITE_URL is missing");
  const url = new URL(value);
  if (url.protocol !== "https:" && !(process.env.NODE_ENV === "development" && url.origin === "http://localhost:3000")) throw new Error("SITE_URL must use HTTPS outside local development");
  return url.origin;
}
