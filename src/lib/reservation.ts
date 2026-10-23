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

export const datingPreferenceLabels: Record<ReservationInput["datingPreference"], string> = {
  women: "Women", men: "Men", all_genders: "People of any gender", discuss: "I'd rather discuss"
};
export const relationshipGoalLabels: Record<ReservationInput["relationshipGoal"], string> = {
  committed: "A committed relationship", meaningful: "A meaningful connection", exploring: "Open to exploring"
};
export const dateFrequencyLabels: Record<ReservationInput["dateFrequency"], string> = {
  monthly: "About once a month", twice_monthly: "A couple of times a month", weekly: "Weekly, if it feels right"
};
