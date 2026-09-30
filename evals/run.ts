import path from "node:path";
import { runEval } from "../src/lib/eval/runner";
import { formatTable, pct } from "../src/lib/eval/score";

// npm scripts run from the package root.
const dir = path.join(process.cwd(), "evals");
const result = runEval({ casesPath: path.join(dir, "cases.json"), outPath: path.join(dir, "RESULTS.md") });

console.log(formatTable(result));
console.log(`\nSafety recall: ${result.safetyRecall.hit}/${result.safetyRecall.total} (${pct(result.safetyRecall.hit, result.safetyRecall.total)})`);
console.log(`False safety flags: ${result.falseSafety.flagged.length}/${result.falseSafety.total}`);
const { authored, holdout } = result.groups;
console.log(`Authored cases: ${pct(authored.correct, authored.total)}  Held-out cases: ${pct(holdout.correct, holdout.total)}`);
console.log(`Misses: ${result.misses.length}. Details in evals/RESULTS.md`);

// Field accuracy is reported, not gated; a missed or false safety route is a hard failure.
const safetyOk = result.safetyRecall.hit === result.safetyRecall.total && result.falseSafety.flagged.length === 0;
if (!safetyOk) {
  console.error("SAFETY GATE FAILED");
  process.exit(1);
}
