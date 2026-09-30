export const SERVICE_TYPES = [
  "leak",
  "clog",
  "water-heater",
  "sewer",
  "fixture-install",
  "gas-line",
  "other",
] as const;
export type ServiceType = (typeof SERVICE_TYPES)[number];

export const URGENCIES = ["emergency", "today", "this-week", "flexible"] as const;
export type Urgency = (typeof URGENCIES)[number];

export const TIME_WINDOWS = ["asap", "morning", "afternoon", "evening", "anytime"] as const;
export type TimeWindow = (typeof TIME_WINDOWS)[number];

export const SAFETY_KINDS = ["gas", "carbon-monoxide", "water-electrical"] as const;
export type SafetyKind = (typeof SAFETY_KINDS)[number];

/** Dispatch priority. emergency-safety is set only by the safety rules, never by an extractor. */
export type Priority = "emergency-safety" | Urgency;

/**
 * Fields an extractor may propose from one customer message. Everything is optional:
 * an extractor reports only what it found. It has no way to express a safety flag.
 */
export interface Extraction {
  serviceType?: ServiceType;
  urgency?: Urgency;
  /** Place name or area code as mentioned; resolved against the service area later. */
  neighborhood?: string;
  timeWindow?: TimeWindow;
  /** Raw phone text as mentioned; validated later. */
  phone?: string;
  summary?: string;
}

export interface Place {
  name: string;
  code: string | null;
  inArea: boolean;
}

export type TicketField = "serviceType" | "neighborhood" | "urgency" | "timeWindow" | "phone" | "summary";

export type TicketStatus = "collecting" | "complete" | "safety-stop" | "declined" | "submitted";

export interface Ticket {
  id: string;
  createdAt: string;
  status: TicketStatus;
  serviceType: ServiceType | null;
  urgency: Urgency | null;
  neighborhood: Place | null;
  timeWindow: TimeWindow | null;
  /** Formatted NANP number, set only after validation passes. */
  phone: string | null;
  summary: string | null;
  safety: SafetyKind[];
}
