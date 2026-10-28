// Display helpers for admin pages. All dates render in UTC so they match the SQL reports.

const dateTime = new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short", timeZone: "UTC" });
const dateOnly = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });
const integer = new Intl.NumberFormat("en-US");

export function formatDateTime(value: string | null | undefined): string {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : `${dateTime.format(date)} UTC`;
}

export function formatDay(day: string): string {
  return dateOnly.format(new Date(`${day}T00:00:00Z`));
}

export function formatInt(value: number): string {
  return integer.format(value);
}

export function percent(numerator: number, denominator: number): string {
  if (!denominator) return "—";
  const value = (100 * numerator) / denominator;
  return `${value >= 10 ? value.toFixed(1) : value.toFixed(2)}%`;
}

export const STATUS_LABELS: Record<string, string> = { pending: "Pending", paid: "Paid", refunded: "Refunded", expired: "Expired" };
export const STAGE_LABELS: Record<string, string> = { new: "New", contacted: "Contacted", pilot: "Pilot", declined: "Declined" };
export const EVENT_LABELS: Record<string, string> = {
  page_view: "Viewed landing page",
  get_started: "Clicked Get started",
  reserve_start: "Opened onboarding form",
  onboarding_complete: "Finished onboarding answers",
  checkout_created: "Started Stripe Checkout",
  checkout_canceled: "Came back from Checkout without paying",
  paid: "Payment confirmed by Stripe webhook"
};
