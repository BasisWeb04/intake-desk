import { resolvePlace } from "../domain/area";
import { checkNanp } from "../domain/phone";
import type { SafetyKind, ServiceType, TimeWindow, Urgency } from "../domain/types";
import { extractWithRules } from "../engine/rule-extractor";
import { detectSafety } from "../safety/detect";

export const SCORED_FIELDS = ["serviceType", "urgency", "neighborhood", "timeWindow", "phone", "safety"] as const;
export type ScoredField = (typeof SCORED_FIELDS)[number];

export interface ExpectedFields {
  serviceType: ServiceType | null;
  urgency: Urgency | null;
  neighborhood: string | null;
  timeWindow: TimeWindow | null;
  /** Ten NANP digits, or null when no valid number is given. */
  phone: string | null;
  safety: SafetyKind | null;
}

export interface EvalCase {
  id: string;
  text: string;
  tags: string[];
  expected: ExpectedFields;
}

export interface Miss {
  id: string;
  field: ScoredField;
  expected: string | null;
  got: string | null;
}

export interface EvalResult {
  cases: number;
  perField: Record<ScoredField, { correct: number; total: number }>;
  overall: { correct: number; total: number };
  safetyRecall: { hit: number; total: number };
  falseSafety: { flagged: string[]; total: number };
  misses: Miss[];
  /** Field accuracy split: cases written alongside the rules versus cases written after the rules were frozen. */
  groups: { authored: { correct: number; total: number }; holdout: { correct: number; total: number } };
}

/** Runs the same order as the live app: safety rules first, then the rules extractor. */
export function predict(text: string): ExpectedFields {
  const safety = detectSafety(text);
  if (safety.kinds.length > 0) {
    return { serviceType: null, urgency: null, neighborhood: null, timeWindow: null, phone: null, safety: safety.kinds[0] };
  }
  const x = extractWithRules(text, { awaiting: null });
  return {
    serviceType: x.serviceType ?? null,
    urgency: x.urgency ?? null,
    neighborhood: x.neighborhood ? resolvePlace(x.neighborhood)?.name ?? null : null,
    timeWindow: x.timeWindow ?? null,
    phone: x.phone ? checkNanp(x.phone).digits : null,
    safety: null,
  };
}

/** Safety cases stop intake, so only their safety field is scored; every other case scores all six fields. */
export function fieldsToScore(c: EvalCase): readonly ScoredField[] {
  return c.expected.safety ? ["safety"] : SCORED_FIELDS;
}

export function scoreCases(cases: readonly EvalCase[]): EvalResult {
  const perField = Object.fromEntries(SCORED_FIELDS.map((f) => [f, { correct: 0, total: 0 }])) as EvalResult["perField"];
  const misses: Miss[] = [];
  const safetyRecall = { hit: 0, total: 0 };
  const falseSafety = { flagged: [] as string[], total: 0 };
  const groups = { authored: { correct: 0, total: 0 }, holdout: { correct: 0, total: 0 } };
  for (const c of cases) {
    const got = predict(c.text);
    const group = c.tags.includes("holdout") ? groups.holdout : groups.authored;
    for (const field of fieldsToScore(c)) {
      perField[field].total += 1;
      group.total += 1;
      if (got[field] === c.expected[field]) {
        perField[field].correct += 1;
        group.correct += 1;
        continue;
      }
      misses.push({ id: c.id, field, expected: c.expected[field], got: got[field] });
    }
    if (c.expected.safety) {
      safetyRecall.total += 1;
      if (got.safety !== null) safetyRecall.hit += 1;
    } else {
      falseSafety.total += 1;
      if (got.safety !== null) falseSafety.flagged.push(c.id);
    }
  }
  const overall = SCORED_FIELDS.reduce(
    (acc, f) => ({ correct: acc.correct + perField[f].correct, total: acc.total + perField[f].total }),
    { correct: 0, total: 0 },
  );
  return { cases: cases.length, perField, overall, safetyRecall, falseSafety, misses, groups };
}

export function pct(correct: number, total: number): string {
  return total === 0 ? "n/a" : `${((100 * correct) / total).toFixed(1)}%`;
}

export function formatTable(result: EvalResult): string {
  const rows = SCORED_FIELDS.map((f) => {
    const { correct, total } = result.perField[f];
    return `| ${f} | ${correct} | ${total} | ${pct(correct, total)} |`;
  });
  const { correct, total } = result.overall;
  return [
    "| Field | Correct | Scored | Accuracy |",
    "| --- | ---: | ---: | ---: |",
    ...rows,
    `| **overall** | **${correct}** | **${total}** | **${pct(correct, total)}** |`,
  ].join("\n");
}
