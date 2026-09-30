import type { SafetyKind } from "../domain/types";

/**
 * Safety rules. They run on every customer message before any extractor, and their verdict
 * cannot be changed by an extractor. The boundary (documented in the README):
 *   gas: a gas word with a smell word, "rotten egg"/sulfur smell, a gas leak phrase, or hissing near a gas word
 *   carbon monoxide: a CO/carbon monoxide alarm that is sounding, or any other carbon monoxide mention
 *   water-electrical: a water word near a panel, breaker, fuse box, outlet, socket, wiring or sparks
 * A match is ignored only when a plain negation sits right before it ("no gas smell") and the
 * customer did not also sound unsure ("not sure", "I think", "maybe"). Doubt always flags.
 */
export interface SafetyResult {
  kinds: SafetyKind[];
  evidence: string[];
}

const NEGATORS = new Set([
  "no", "not", "don't", "dont", "doesn't", "doesnt", "didn't", "didnt", "never", "without",
  "zero", "none", "isn't", "isnt", "aren't", "arent", "can't", "cant", "cannot", "nor", "nothing",
]);

const UNSURE = /\b(?:not sure|unsure|maybe|might|think|possibly|probably|could be|i guess|wondering|worried)\b/;

const GAS_WORD = /\b(?:gas+|propane|natural\s+gas)\b/;
const SMELL_WORD = /\b(?:sme+l+(?:s|ed|ing|y|t)?|odou?rs?|stink\w*|stank|stench|fumes?|reek\w*|whiffs?|scents?)\b/g;
const ROTTEN_EGG = /\b(?:rotten[\s-]*eggs?|sulfur|sulphur)\b/g;
const GAS_LEAK = /\bgas+\s+(?:(?:line|pipe|meter|valve|stove|range|dryer|fitting|hookup)\s+)?(?:is\s+|was\s+|seems\s+(?:to\s+be\s+)?|might\s+be\s+)?leak\w*|\bleak\w*\s+(?:of\s+)?gas+\b/g;
const HISS = /\bhiss\w*/g;

const CO_DEVICE = /\b(?:co|carbon\s*mon\w*)\s*(?:alarm|detector|monitor|sensor)s?\b/g;
const CO_ACTIVE = /\b(?:going off|goes off|went off|gone off|go off|keeps? going|beep\w*|chirp\w*|sound\w*|alarm\w*|ring\w*|trigger\w*|flash\w*|screech\w*|blar\w*|shriek\w*|buzz\w*)\b/g;
const CO_MENTION = /\bcarbon\s*mon\w*/g;

// Plumbing parts that contain the word "outlet" but are not electrical.
const PLUMBING_OUTLET = /\b(?:drain|dishwasher|disposal|sink|tub|toilet|washer|pump|heater)\s+outlets?\b|\boutlets?\s+(?:hose|pipe|line|valve|fitting|port|tube)s?\b/g;
const ELECTRICAL_WORD = /\b(?:electrical|electric\s+panel|breaker\s*(?:box|panel)?s?|fuse\s*(?:box|panel)s?|service\s+panel|outlets?|sockets?|power\s*strips?|extension\s*cords?|wiring|live\s+wires?|exposed\s+wires?|spark(?:s|ing|ed)?)\b/g;
const WATER_WORD = /\b(?:water|wet|leak\w*|flood\w*|drip\w*|puddl\w*|pool\w*|soak\w*|spray\w*|gush\w*|pour\w*|seep\w*|damp|overflow\w*|submerged)\b/;
const DISTANCE_NEGATION = /\b(?:away from|far from|nowhere near|not near|not close to|nowhere close to)\s*$/;

function normalize(text: string): string {
  // Hyphens and underscores become spaces so "carbon-monoxide" and "gas-smell" match like the spaced forms.
  return text.toLowerCase().replace(/[‘’]/g, "'").replace(/[-_]+/g, " ").replace(/\s+/g, " ");
}

/** Each sentence, plus each adjacent pair so "It smells odd. Could be gas." still links up. */
function windows(text: string): string[] {
  const sentences = normalize(text)
    .split(/[.!?;\n]+/)
    .map((s) => s.trim())
    .filter(Boolean);
  const out = [...sentences];
  for (let i = 0; i + 1 < sentences.length; i++) out.push(`${sentences[i]} ${sentences[i + 1]}`);
  return out;
}

/** True when one of the three words before `index` is a negator. */
function isNegated(window: string, index: number): boolean {
  const before = window.slice(0, index);
  if (DISTANCE_NEGATION.test(before)) return true;
  const tokens = before.split(/[^a-z']+/).filter(Boolean).slice(-3);
  return tokens.some((t) => NEGATORS.has(t));
}

/** Finds the first match of `pattern` in `window` that is not negated, honoring the doubt override. */
function liveMatch(window: string, pattern: RegExp): string | null {
  const unsure = UNSURE.test(window);
  for (const m of window.matchAll(pattern)) {
    if (unsure || !isNegated(window, m.index ?? 0)) return m[0];
  }
  return null;
}

function detectGas(w: string): string | null {
  if (GAS_WORD.test(w)) {
    const smell = liveMatch(w, SMELL_WORD);
    if (smell) return `gas + ${smell}`;
    const hiss = liveMatch(w, HISS);
    if (hiss) return `gas + ${hiss}`;
  }
  const leak = liveMatch(w, GAS_LEAK);
  if (leak) return leak;
  return liveMatch(w, ROTTEN_EGG);
}

function detectCarbonMonoxide(w: string): string | null {
  const devices = w.match(CO_DEVICE);
  const stripped = w.replace(CO_DEVICE, " device ");
  if (devices) {
    const active = liveMatch(stripped, CO_ACTIVE);
    if (active) return `${devices[0]} + ${active}`;
  }
  return liveMatch(stripped, CO_MENTION);
}

function detectWaterElectrical(w: string): string | null {
  const stripped = w.replace(PLUMBING_OUTLET, " fitting ");
  if (!WATER_WORD.test(stripped)) return null;
  const electrical = liveMatch(stripped, ELECTRICAL_WORD);
  return electrical ? `water + ${electrical}` : null;
}

const CHECKS: ReadonlyArray<[SafetyKind, (w: string) => string | null]> = [
  ["gas", detectGas],
  ["carbon-monoxide", detectCarbonMonoxide],
  ["water-electrical", detectWaterElectrical],
];

export function detectSafety(text: string): SafetyResult {
  const kinds: SafetyKind[] = [];
  const evidence: string[] = [];
  const ws = windows(text);
  for (const [kind, check] of CHECKS) {
    for (const w of ws) {
      const hit = check(w);
      if (hit) {
        kinds.push(kind);
        evidence.push(hit);
        break;
      }
    }
  }
  return { kinds, evidence };
}
