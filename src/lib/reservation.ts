import { z } from "zod";

export const reservationSchema = z.object({
  ageConfirmed: z.literal(true),
  // City is optional in the app flow; the column needs 2+ characters, so a blank one is stored as "Not given".
  city: z.string().trim().max(120).transform((value) => (value.length >= 2 ? value : "Not given")),
  email: z.email().max(254).transform((value) => value.trim().toLowerCase()),
  datingPreference: z.enum(["women", "men", "all_genders", "discuss"]),
  relationshipGoal: z.enum(["committed", "meaningful", "exploring"]),
  dateFrequency: z.enum(["monthly", "twice_monthly", "weekly"]),
  termsAccepted: z.literal(true)
});

export type ReservationInput = z.infer<typeof reservationSchema>;

// Display labels only. The enum keys above are what the database stores; never rename them.
export const datingPreferenceLabels: Record<ReservationInput["datingPreference"], string> = {
  women: "Women", men: "Men", all_genders: "Anyone", discuss: "Rather not say"
};
export const relationshipGoalLabels: Record<ReservationInput["relationshipGoal"], string> = {
  committed: "A relationship, something serious", meaningful: "Something real, see where it goes", exploring: "Dating around for now"
};
export const dateFrequencyLabels: Record<ReservationInput["dateFrequency"], string> = {
  monthly: "One good date a month", twice_monthly: "A couple a month", weekly: "Every week, let’s go"
};

// Onboarding answers collected before the $1 step. Stored as one JSON column (onboarding) so the
// schema stays small; validated here, never logged.
export const DATING_APPS = ["tinder", "bumble", "hinge"] as const;
export type DatingApp = (typeof DATING_APPS)[number];
export const datingAppLabels: Record<DatingApp, string> = { tinder: "Tinder", bumble: "Bumble", hinge: "Hinge" };

export const onboardingSchema = z.object({
  name: z.string().trim().max(60),
  age: z.number().int().min(18).max(99).optional(),
  apps: z.array(z.enum(DATING_APPS)).max(3).transform((apps) => [...new Set(apps)]),
  ageMin: z.number().int().min(18).max(99),
  ageMax: z.number().int().min(18).max(99),
  interests: z.string().trim().max(300),
  telegram: z.string().trim().regex(/^@?[A-Za-z0-9_]{5,32}$/).transform((value) => value.replace(/^@/, "")).optional()
}).refine((value) => value.ageMin <= value.ageMax, { path: ["ageMax"] });

export type Onboarding = z.infer<typeof onboardingSchema>;
