import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { runEval } from "../src/lib/eval/runner";
import { pct } from "../src/lib/eval/score";

const root = path.join(__dirname, "..");
// Write to a temp file so the test never rewrites the committed evals/RESULTS.md.
const result = runEval({
  casesPath: path.join(root, "evals", "cases.json"),
  outPath: path.join(mkdtempSync(path.join(tmpdir(), "intake-eval-pin-")), "RESULTS.md"),
});
const readme = readFileSync(path.join(root, "README.md"), "utf8");
const results = readFileSync(path.join(root, "evals", "RESULTS.md"), "utf8");

// The published numbers. If the engine or the cases change, update README.md and evals/RESULTS.md with them.
const PINNED = {
  cases: 62,
  overall: { correct: 279, total: 287 },
  safetyRecall: { hit: 17, total: 17 },
  falseFlags: 0,
  nonSafety: 45,
  authored: { correct: 197, total: 199, pct: "99.0%" },
  holdout: { correct: 82, total: 88, pct: "93.2%" },
};

describe("pinned eval numbers", () => {
  it("the eval produces exactly the published counts", () => {
    expect(result.cases).toBe(PINNED.cases);
    expect(result.overall).toEqual(PINNED.overall);
    expect(result.safetyRecall).toEqual(PINNED.safetyRecall);
    expect(result.falseSafety).toEqual({ flagged: [], total: PINNED.nonSafety });
    const { authored, holdout } = result.groups;
    expect({ ...authored, pct: pct(authored.correct, authored.total) }).toEqual(PINNED.authored);
    expect({ ...holdout, pct: pct(holdout.correct, holdout.total) }).toEqual(PINNED.holdout);
  });

  it("README quotes the same numbers", () => {
    const { overall, authored, holdout } = PINNED;
    expect(readme).toContain(`Measured with \`npm run eval\` on ${PINNED.cases} cases`);
    expect(readme).toContain(`| **overall** | **${overall.correct}** | **${overall.total}** | **${pct(overall.correct, overall.total)}** |`);
    expect(readme).toContain(`**Safety recall:** ${PINNED.safetyRecall.hit} of ${PINNED.safetyRecall.total}.`);
    expect(readme).toContain(`False safety flags: ${PINNED.falseFlags} of ${PINNED.nonSafety} non-safety cases.`);
    expect(readme).toContain(`${authored.pct.replace("%", " percent")} (${authored.correct} of ${authored.total} fields)`);
    expect(readme).toContain(`${holdout.pct.replace("%", " percent")} (${holdout.correct} of ${holdout.total} fields)`);
  });

  it("evals/RESULTS.md quotes the same numbers", () => {
    const { overall, authored, holdout } = PINNED;
    expect(results).toContain(`Cases: ${PINNED.cases}`);
    expect(results).toContain(`| **overall** | **${overall.correct}** | **${overall.total}** | **${pct(overall.correct, overall.total)}** |`);
    expect(results).toContain(`${authored.correct}/${authored.total} fields (${authored.pct})`);
    expect(results).toContain(`${holdout.correct}/${holdout.total} fields (${holdout.pct})`);
    expect(results).toContain(`Safety recall: ${PINNED.safetyRecall.hit} of ${PINNED.safetyRecall.total} (100.0%)`);
    expect(results).toContain(`False safety flags on non-safety cases: ${PINNED.falseFlags} of ${PINNED.nonSafety}`);
  });
});
