import { z } from "zod";

export const reservationSchema = z.object({
  ageConfirmed: z.literal(true),
  city: z.string().trim().min(2).max(120),
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
