import type { Priority, SafetyKind, ServiceType, TimeWindow, Urgency } from "./types";

export const SERVICE_LABEL: Record<ServiceType, string> = {
  leak: "Leak",
  clog: "Clog",
  "water-heater": "Water heater",
  sewer: "Sewer line",
  "fixture-install": "Fixture install",
  "gas-line": "Gas line",
  other: "Other",
};

export const URGENCY_LABEL: Record<Urgency, string> = {
  emergency: "Emergency",
  today: "Today",
  "this-week": "This week",
  flexible: "Flexible",
};

export const PRIORITY_LABEL: Record<Priority, string> = {
  "emergency-safety": "Emergency: safety",
  ...URGENCY_LABEL,
};

export const WINDOW_LABEL: Record<TimeWindow, string> = {
  asap: "As soon as possible",
  morning: "Morning (8-12)",
  afternoon: "Afternoon (12-5)",
  evening: "Evening (5-8)",
  anytime: "Any time",
};

export const SAFETY_LABEL: Record<SafetyKind, string> = {
  gas: "Possible gas leak",
  "carbon-monoxide": "Carbon monoxide alarm",
  "water-electrical": "Water near electrical",
};

/** Lower rank sorts first on the dispatch board. */
export const PRIORITY_RANK: Record<Priority, number> = {
  "emergency-safety": 0,
  emergency: 1,
  today: 2,
  "this-week": 3,
  flexible: 4,
};
