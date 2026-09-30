import { mkdtempSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { runEval } from "../src/lib/eval/runner";
import { scoreCases, type EvalCase } from "../src/lib/eval/score";

const tiny: EvalCase[] = [
  {
    id: "t1",
    text: "clogged toilet in Brassmill",
    tags: [],
    expected: { serviceType: "clog", urgency: null, neighborhood: "Brassmill", timeWindow: null, phone: null, safety: null },
  },
  {
    id: "t2",
    text: "I smell gas",
    tags: ["safety"],
    expected: { serviceType: null, urgency: null, neighborhood: null, timeWindow: null, phone: null, safety: "gas" },
  },
  {
    id: "t3",
    text: "faucet drip",
    tags: ["holdout"],
    expected: { serviceType: "fixture-install", urgency: null, neighborhood: null, timeWindow: null, phone: null, safety: null },
  },
];

describe("eval runner", () => {
  it("writes a dated results file with the table and misses", () => {
    const dir = mkdtempSync(path.join(tmpdir(), "intake-eval-"));
    const casesPath = path.join(dir, "cases.json");
    const outPath = path.join(dir, "RESULTS.md");
    writeFileSync(casesPath, JSON.stringify(tiny));
    const result = runEval({ casesPath, outPath, date: new Date("2026-09-30T00:00:00Z") });
    expect(existsSync(outPath)).toBe(true);
    const report = readFileSync(outPath, "utf8");
    expect(report).toContain("Run date (UTC): 2026-09-30");
    expect(report).toContain("| Field | Correct | Scored | Accuracy |");
    expect(report).toContain("| t3 | serviceType | fixture-install | leak |");
    expect(result.safetyRecall).toEqual({ hit: 1, total: 1 });
  });

  it("scores safety cases on the safety field only and splits held-out cases", () => {
    const r = scoreCases(tiny);
    expect(r.perField.safety.total).toBe(3);
    expect(r.perField.serviceType.total).toBe(2);
    expect(r.groups.holdout.total).toBe(6);
    expect(r.misses).toEqual([{ id: "t3", field: "serviceType", expected: "fixture-install", got: "leak" }]);
  });

  it("refuses a malformed cases file", () => {
    const dir = mkdtempSync(path.join(tmpdir(), "intake-eval-"));
    const casesPath = path.join(dir, "cases.json");
    writeFileSync(casesPath, JSON.stringify([{ id: "x" }]));
    expect(() => runEval({ casesPath, outPath: path.join(dir, "out.md") })).toThrow(/malformed case/);
  });

  it("the real eval set has at least 30 cases and 100 percent safety recall", () => {
    const cases: EvalCase[] = JSON.parse(readFileSync(path.join(__dirname, "..", "evals", "cases.json"), "utf8"));
    expect(cases.length).toBeGreaterThanOrEqual(30);
    const r = scoreCases(cases);
    expect(r.safetyRecall.hit).toBe(r.safetyRecall.total);
    expect(r.falseSafety.flagged).toEqual([]);
  });
});
