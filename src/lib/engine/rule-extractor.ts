import { findPlaceInText } from "../domain/area";
import { findPhoneInText } from "../domain/phone";
import type { Extraction, ServiceType, TimeWindow, Urgency } from "../domain/types";
import type { ExtractContext, ExtractResult, Extractor } from "./extractor";
import { correctToken } from "./fuzzy";
import {
  KEEP,
  OTHER_ANSWER,
  SERVICE_PATTERNS,
  URGENCY_DENIAL,
  URGENCY_PATTERNS,
  VOCAB,
  WINDOW_ANSWER_ANYTIME,
  WINDOW_PATTERNS,
} from "./lexicon";

/** Lowercases, unifies apostrophes and snaps near-miss spellings to the vocabulary. */
export function normalizeText(text: string): string {
  const lowered = text.toLowerCase().replace(/[‘’]/g, "'");
  return lowered.replace(/[a-z']+/g, (token) => correctToken(token, VOCAB, KEEP));
}

export function detectServiceType(norm: string, ctx: ExtractContext): ServiceType | undefined {
  for (const [type, pattern] of SERVICE_PATTERNS) {
    if (pattern.test(norm)) return type;
  }
  if (ctx.awaiting === "serviceType" && OTHER_ANSWER.test(norm)) return "other";
  return undefined;
}

export function detectUrgency(norm: string): Urgency | undefined {
  const withoutDenials = norm.replace(URGENCY_DENIAL, " ");
  for (const [urgency, pattern] of URGENCY_PATTERNS) {
    // Denials like "not urgent" must still count toward flexible, so that pattern sees the full text.
    const haystack = urgency === "flexible" ? norm : withoutDenials;
    if (pattern.test(haystack)) return urgency;
  }
  return undefined;
}

export function detectTimeWindow(norm: string, ctx: ExtractContext): TimeWindow | undefined {
  let best: { window: TimeWindow; index: number } | undefined;
  for (const [window, pattern] of WINDOW_PATTERNS) {
    const match = pattern.exec(norm);
    if (match && (!best || match.index < best.index)) best = { window, index: match.index };
  }
  if (best) return best.window;
  if (ctx.awaiting === "timeWindow" && WINDOW_ANSWER_ANYTIME.test(norm)) return "anytime";
  return undefined;
}

/** First sentence, trimmed, when the message reads like a problem description rather than a bare answer. */
export function summarize(textWithoutPhone: string, ctx: ExtractContext): string | undefined {
  const describing = ctx.awaiting === null || ctx.awaiting === "serviceType" || ctx.awaiting === "summary";
  if (!describing) return undefined;
  const first = textWithoutPhone.split(/(?<=[.!?])\s+|\n/)[0]?.replace(/\s+/g, " ").trim() ?? "";
  if (first.split(" ").length < 3) return undefined;
  return first.length > 140 ? `${first.slice(0, 137).trimEnd()}...` : first;
}

/** Deterministic extraction from one message. Pure, synchronous and offline. */
export function extractWithRules(text: string, ctx: ExtractContext): Extraction {
  const phone = findPhoneInText(text) ?? undefined;
  const withoutPhone = phone ? text.replace(phone, " ") : text;
  const norm = normalizeText(withoutPhone);
  const place = findPlaceInText(withoutPhone);
  const out: Extraction = {};
  const serviceType = detectServiceType(norm, ctx);
  const urgency = detectUrgency(norm);
  const timeWindow = detectTimeWindow(norm, ctx);
  const summary = summarize(withoutPhone, ctx);
  if (serviceType) out.serviceType = serviceType;
  if (urgency) out.urgency = urgency;
  if (timeWindow) out.timeWindow = timeWindow;
  if (place) out.neighborhood = place.name;
  if (phone) out.phone = phone;
  if (summary) out.summary = summary;
  return out;
}

export class RuleExtractor implements Extractor {
  readonly id = "rules" as const;

  async extract(text: string, context: ExtractContext): Promise<ExtractResult> {
    return { extraction: extractWithRules(text, context), engine: "rules" };
  }
}
