import { describe, expect, it } from "vitest";
import { findPlaceInText } from "../src/lib/domain/area";
import { editDistance } from "../src/lib/engine/fuzzy";
import { extractWithRules, normalizeText, RuleExtractor } from "../src/lib/engine/rule-extractor";

const cold = { awaiting: null } as const;

describe("RuleExtractor: service type", () => {
  it.each([
    ["the kitchen sink is clogged", "clog"],
    ["pipe burst in the crawlspace", "leak"],
    ["no hot water this morning", "water-heater"],
    ["sewer line backing up", "sewer"],
    ["want a new faucet installed", "fixture-install"],
    ["need a gas line for the new range", "gas-line"],
  ])("%s -> %s", (text, type) => {
    expect(extractWithRules(text, cold).serviceType).toBe(type);
  });

  it("prefers the more specific trade when two issues appear", () => {
    expect(extractWithRules("water heater leaking and a slow drain", cold).serviceType).toBe("water-heater");
  });

  it("maps an unclassifiable answer to other only when that question was asked", () => {
    expect(extractWithRules("something else", cold).serviceType).toBeUndefined();
    expect(extractWithRules("something else", { awaiting: "serviceType" }).serviceType).toBe("other");
  });
});

describe("RuleExtractor: urgency and time window", () => {
  it.each([
    ["water everywhere, pipe burst", "emergency"],
    ["need someone today", "today"],
    ["tomorrow is fine", "this-week"],
    ["no rush at all", "flexible"],
    ["not an emergency, next week works", "flexible"],
  ])("%s -> %s", (text, urgency) => {
    expect(extractWithRules(text, cold).urgency).toBe(urgency);
  });

  it.each([
    ["mornings are best", "morning"],
    ["after work please", "evening"],
    ["afternoon or morning", "afternoon"],
    ["asap", "asap"],
  ])("%s -> window %s", (text, window) => {
    expect(extractWithRules(text, cold).timeWindow).toBe(window);
  });

  it("reads a bare 'flexible' as a window only when the window was asked", () => {
    expect(extractWithRules("flexible", { awaiting: "timeWindow" }).timeWindow).toBe("anytime");
    expect(extractWithRules("flexible", cold).timeWindow).toBeUndefined();
  });
});

describe("RuleExtractor: place, phone, summary", () => {
  it("finds neighborhoods by name, code, alias and misspelling", () => {
    expect(findPlaceInText("I live in Brassmill")?.name).toBe("Brassmill");
    expect(findPlaceInText("zip 99996")?.name).toBe("Foxglove Terrace");
    expect(findPlaceInText("over in harow glen")?.name).toBe("Harrow Glen");
    expect(findPlaceInText("Kestrel Point")).toMatchObject({ inArea: false });
    expect(findPlaceInText("somewhere downtown")).toBeNull();
  });

  it("keeps the phone out of the place and summary", () => {
    const x = extractWithRules("Tub will not drain in Brassmill. 406-555-0142", cold);
    expect(x.phone).toBe("406-555-0142");
    expect(x.neighborhood).toBe("Brassmill");
    expect(x.summary).toBe("Tub will not drain in Brassmill.");
  });

  it("corrects typos without mangling ordinary words", () => {
    expect(normalizeText("toliet cloged")).toBe("toilet clogged");
    expect(normalizeText("floor later")).toBe("floor later");
    expect(editDistance("toliet", "toilet")).toBe(1);
  });

  it("implements the Extractor interface and labels itself", async () => {
    const result = await new RuleExtractor().extract("clogged toilet", cold);
    expect(result.engine).toBe("rules");
    expect(result.extraction.serviceType).toBe("clog");
  });
});
