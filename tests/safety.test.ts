import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import type { EvalCase } from "../src/lib/eval/score";
import { detectSafety } from "../src/lib/safety/detect";
import { SAFETY_INSTRUCTIONS } from "../src/lib/safety/safety-text";

const cases: EvalCase[] = JSON.parse(readFileSync(path.join(__dirname, "..", "evals", "cases.json"), "utf8"));
const safetyCases = cases.filter((c) => c.expected.safety !== null);
const nonSafetyCases = cases.filter((c) => c.expected.safety === null);

describe("safety routing: every safety case in the eval set routes", () => {
  it("has safety cases to check", () => {
    expect(safetyCases.length).toBeGreaterThanOrEqual(15);
  });

  it.each(safetyCases.map((c) => [c.id, c.text, c.expected.safety] as const))("%s routes: %s", (_id, text, kind) => {
    expect(detectSafety(text).kinds).toContain(kind);
  });
});

describe("safety routing: extra phrasings", () => {
  it.each([
    ["I can smell gas in the basement", "gas"],
    ["Gas leak at the meter I think", "gas"],
    ["the gas pipe is hissing", "gas"],
    ["It smells odd in here. Could be gas?", "gas"],
    ["I don't think I smell gas but I'm not sure", "gas"],
    ["CO alarm keeps going off", "carbon-monoxide"],
    ["worried about carbon monoxide from the old water heater", "carbon-monoxide"],
    ["water dripping into an outlet in the laundry room", "water-electrical"],
    ["basement flooded up to the power strip", "water-electrical"],
  ])("flags %s", (text, kind) => {
    expect(detectSafety(text).kinds).toContain(kind);
  });

  it("reports every kind when several apply, in fixed order", () => {
    expect(detectSafety("I smell gas and water is leaking onto the breaker box").kinds).toEqual(["gas", "water-electrical"]);
  });
});

describe("safety routing: near misses are NOT emergency-safety", () => {
  it.each([
    "gas water heater pilot is out, no smell",
    "Need a gas line run to the new stove. No gas smell, nothing leaking.",
    "Electric water heater is leaking from the bottom",
    "the dishwasher drain outlet hose is leaking",
    "toilet keeps hissing and running",
    "basement drain smells like sewage",
    "just installed a new CO detector, now the faucet drips",
    "leak under the sink, not near any outlets",
    "our gas bill went up, can you check the water heater?",
    "I do not smell any gas, the stove just won't light",
  ])("does not flag: %s", (text) => {
    expect(detectSafety(text).kinds).toEqual([]);
  });

  it.each(nonSafetyCases.map((c) => [c.id, c.text] as const))("eval case %s is not flagged: %s", (_id, text) => {
    expect(detectSafety(text).kinds).toEqual([]);
  });
});

describe("safety instructions", () => {
  it("are fixed constants with the required actions", () => {
    expect(Object.isFrozen(SAFETY_INSTRUCTIONS)).toBe(true);
    expect(SAFETY_INSTRUCTIONS.gas).toMatch(/leave the building/i);
    expect(SAFETY_INSTRUCTIONS.gas).toMatch(/gas utility/i);
    expect(SAFETY_INSTRUCTIONS.gas).toMatch(/911/);
    expect(SAFETY_INSTRUCTIONS["carbon-monoxide"]).toMatch(/911 from outside/i);
    expect(SAFETY_INSTRUCTIONS["water-electrical"]).toMatch(/do not touch/i);
    expect(SAFETY_INSTRUCTIONS["water-electrical"]).toMatch(/main breaker only if/i);
  });
});
