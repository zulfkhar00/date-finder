// Constants shared by server data code and admin client components. No data access here.

export const RESERVATION_STATUSES = ["pending", "paid", "refunded", "expired"] as const;
export type ReservationStatus = (typeof RESERVATION_STATUSES)[number];
export const LEAD_STAGES = ["new", "contacted", "pilot", "declined"] as const;
export type LeadStage = (typeof LEAD_STAGES)[number];
