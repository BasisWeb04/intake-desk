import { SERVICE_TYPES, TIME_WINDOWS, URGENCIES, type Extraction } from "./types";

/**
 * JSON schema for extractor output. The LLM tool uses it as input_schema, and every
 * LLM response is re-checked with validateExtraction before the app trusts it.
 */
export const EXTRACTION_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    serviceType: { type: "string", enum: [...SERVICE_TYPES], description: "Kind of plumbing job." },
    urgency: { type: "string", enum: [...URGENCIES], description: "How soon the customer needs service." },
    neighborhood: { type: "string", maxLength: 60, description: "Neighborhood name or 5-digit area code the customer gave." },
    timeWindow: { type: "string", enum: [...TIME_WINDOWS], description: "Preferred arrival window." },
    phone: { type: "string", maxLength: 30, description: "Callback number exactly as the customer wrote it." },
    summary: { type: "string", maxLength: 200, description: "One-sentence problem summary in plain words." },
  },
} as const;

const ALLOWED_KEYS = new Set(Object.keys(EXTRACTION_JSON_SCHEMA.properties));

function isOneOf<T extends string>(list: readonly T[], value: unknown): value is T {
  return typeof value === "string" && (list as readonly string[]).includes(value);
}

function isShortString(value: unknown, max: number): value is string {
  return typeof value === "string" && value.trim().length > 0 && value.length <= max;
}

/** Returns a clean Extraction, or null when anything is off-schema. Null fields are treated as absent. */
export function validateExtraction(input: unknown): Extraction | null {
  if (typeof input !== "object" || input === null || Array.isArray(input)) return null;
  const out: Extraction = {};
  for (const [key, value] of Object.entries(input as Record<string, unknown>)) {
    if (!ALLOWED_KEYS.has(key)) return null;
    if (value === null || value === undefined) continue;
    switch (key) {
      case "serviceType":
        if (!isOneOf(SERVICE_TYPES, value)) return null;
        out.serviceType = value;
        break;
      case "urgency":
        if (!isOneOf(URGENCIES, value)) return null;
        out.urgency = value;
        break;
      case "timeWindow":
        if (!isOneOf(TIME_WINDOWS, value)) return null;
        out.timeWindow = value;
        break;
      case "neighborhood":
        if (!isShortString(value, 60)) return null;
        out.neighborhood = value.trim();
        break;
      case "phone":
        if (!isShortString(value, 30)) return null;
        out.phone = value.trim();
        break;
      case "summary":
        if (!isShortString(value, 200)) return null;
        out.summary = value.trim();
        break;
    }
  }
  return out;
}
