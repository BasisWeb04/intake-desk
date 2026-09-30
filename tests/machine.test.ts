import { describe, expect, it } from "vitest";
import type { Extraction } from "../src/lib/domain/types";
import type { ExtractResult, Extractor } from "../src/lib/engine/extractor";
import { RuleExtractor } from "../src/lib/engine/rule-extractor";
import {
  applyExtraction,
  canSubmit,
  createIntake,
  nextMissingField,
  priorityOf,
  processMessage,
  submitTicket,
  type IntakeState,
} from "../src/lib/intake/machine";
import { SAFETY_INSTRUCTIONS } from "../src/lib/safety/safety-text";

const fixed = () => createIntake(new Date("2026-09-30T12:00:00Z"), "CPD-TEST");

/** An extractor that returns whatever it is told, and records that it was called. */
function scripted(extraction: Extraction): Extractor & { calls: number } {
  return {
    id: "llm",
    calls: 0,
    async extract(): Promise<ExtractResult> {
      this.calls += 1;
      return { extraction, engine: "llm" };
    },
  };
}

async function converse(messages: string[]): Promise<IntakeState> {
  let state = fixed();
  const rules = new RuleExtractor();
  for (const m of messages) state = await processMessage(state, m, rules);
  return state;
}

describe("intake state machine", () => {
  it("starts with a greeting and every field missing", () => {
    const s = fixed();
    expect(s.turns).toHaveLength(1);
    expect(nextMissingField(s.ticket)).toBe("serviceType");
  });

  it("asks exactly one follow-up at a time, in field order", async () => {
    let s = await processMessage(fixed(), "my kitchen sink is clogged", new RuleExtractor());
    expect(s.awaiting).toBe("neighborhood");
    s = await processMessage(s, "Brassmill", new RuleExtractor());
    expect(s.awaiting).toBe("urgency");
    s = await processMessage(s, "this week", new RuleExtractor());
    expect(s.awaiting).toBe("timeWindow");
    s = await processMessage(s, "mornings", new RuleExtractor());
    expect(s.awaiting).toBe("phone");
    const lastQuestion = s.turns[s.turns.length - 1];
    expect(lastQuestion.text.match(/\?/g)?.length).toBe(1);
  });

  it("reaches complete with every field and can then be submitted", async () => {
    const s = await converse(["kitchen sink is clogged in Brassmill", "this week", "mornings", "406-555-0142"]);
    expect(s.ticket.status).toBe("complete");
    expect(s.ticket).toMatchObject({ serviceType: "clog", urgency: "this-week", timeWindow: "morning", phone: "(406) 555-0142" });
    expect(s.ticket.summary).toBe("kitchen sink is clogged in Brassmill");
    expect(canSubmit(s)).toBe(true);
    const submitted = submitTicket(s);
    expect(submitted.ticket.status).toBe("submitted");
  });

  it("will not submit an incomplete ticket", async () => {
    const s = await converse(["clogged toilet"]);
    expect(canSubmit(s)).toBe(false);
    expect(submitTicket(s)).toBe(s);
  });

  it("re-asks for the phone with the reason when validation fails", async () => {
    const s = await converse(["clogged sink in Brassmill, today, afternoon", "123-456-7890"]);
    expect(s.ticket.phone).toBeNull();
    expect(s.awaiting).toBe("phone");
    expect(s.turns[s.turns.length - 1].text).toMatch(/cannot start with 0 or 1/);
  });

  it("declines out-of-area addresses with a referral and stops asking", async () => {
    const s = await converse(["leaky faucet in Kestrel Point"]);
    expect(s.ticket.status).toBe("declined");
    expect(s.awaiting).toBeNull();
    expect(s.turns[s.turns.length - 1].text).toMatch(/outside the area/);
    const after = await converse(["leaky faucet in Kestrel Point", "Brassmill then?"]);
    expect(after.ticket.status).toBe("declined");
  });

  it("sets the arrival window to asap for emergencies instead of asking", async () => {
    const s = await converse(["pipe burst, water everywhere, Gantry Yard"]);
    expect(s.ticket.urgency).toBe("emergency");
    expect(s.ticket.timeWindow).toBe("asap");
    expect(s.awaiting).toBe("phone");
  });

  it("falls back to 'other' after two unclassifiable answers about the job type", async () => {
    const s = await converse(["hello", "hmm", "it is weird"]);
    expect(s.ticket.serviceType).toBe("other");
  });

  it("labels each assistant turn with the engine that answered", () => {
    const s = applyExtraction(fixed(), { serviceType: "leak" }, "leak", "llm", "note here");
    const last = s.turns[s.turns.length - 1];
    expect(last.source).toBe("LLM");
    expect(last.note).toBe("note here");
  });
});

describe("safety runs before the extractor and cannot be overridden", () => {
  it("stops intake without calling the extractor", async () => {
    const extractor = scripted({ serviceType: "leak", urgency: "flexible" });
    const s = await processMessage(fixed(), "I smell gas by the stove", extractor);
    expect(extractor.calls).toBe(0);
    expect(s.ticket.status).toBe("safety-stop");
    expect(priorityOf(s.ticket)).toBe("emergency-safety");
    expect(s.turns[s.turns.length - 1].text).toContain(SAFETY_INSTRUCTIONS.gas);
    expect(s.turns[s.turns.length - 1].source).toBe("Safety rules");
  });

  it("keeps the safety flag when a later extractor says flexible", async () => {
    const extractor = scripted({ urgency: "flexible", serviceType: "leak" });
    let s = await processMessage(fixed(), "CO alarm is beeping", extractor);
    s = await processMessage(s, "actually never mind, it is fine, no rush", extractor);
    expect(extractor.calls).toBe(0);
    expect(s.ticket.safety).toEqual(["carbon-monoxide"]);
    expect(priorityOf(s.ticket)).toBe("emergency-safety");
  });

  it("interrupts an intake that is already in progress", async () => {
    const s = await converse(["clogged sink in Brassmill", "wait, water is dripping onto the breaker box"]);
    expect(s.ticket.status).toBe("safety-stop");
    expect(s.ticket.safety).toEqual(["water-electrical"]);
  });

  it("lets a safety ticket go to dispatch even with fields missing", async () => {
    const s = await converse(["smells like gas in here"]);
    expect(canSubmit(s)).toBe(true);
    const submitted = submitTicket(s);
    expect(priorityOf(submitted.ticket)).toBe("emergency-safety");
  });

  it("an extractor cannot set emergency-safety through an off-schema value", () => {
    const hostile = { urgency: "emergency-safety", serviceType: "leak" } as unknown as Extraction;
    const s = applyExtraction(fixed(), hostile, "x", "llm");
    expect(s.ticket.safety).toEqual([]);
    expect(s.ticket.urgency).toBeNull();
    expect(s.ticket.serviceType).toBeNull();
    expect(priorityOf(s.ticket)).toBeNull();
  });
});
