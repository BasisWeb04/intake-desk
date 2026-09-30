import { describe, expect, it, vi } from "vitest";
import { LlmExtractor } from "../src/lib/engine/llm-extractor";
import { RuleExtractor } from "../src/lib/engine/rule-extractor";

const ctx = { awaiting: null } as const;
const text = "kitchen sink is clogged in Brassmill";

function make(fetchImpl: typeof fetch) {
  return new LlmExtractor(new RuleExtractor(), fetchImpl);
}

describe("LlmExtractor (browser side of /api/extract)", () => {
  it("uses the route's answer and labels it LLM", async () => {
    const fetchImpl = vi.fn(async () => Response.json({ extraction: { serviceType: "clog", neighborhood: "Brassmill" } }));
    const out = await make(fetchImpl).extract(text, ctx);
    expect(out).toEqual({ engine: "llm", extraction: { serviceType: "clog", neighborhood: "Brassmill" } });
  });

  it("falls back to the rules engine on 501 (no server key)", async () => {
    const fetchImpl = vi.fn(async () => Response.json({ error: "not-configured" }, { status: 501 }));
    const out = await make(fetchImpl).extract(text, ctx);
    expect(out.engine).toBe("rules");
    expect(out.note).toMatch(/not configured/);
    expect(out.extraction.serviceType).toBe("clog");
  });

  it("falls back on upstream errors, network errors and off-schema answers", async () => {
    const upstream = await make(vi.fn(async () => Response.json({ error: "http-error" }, { status: 502 }))).extract(text, ctx);
    expect(upstream).toMatchObject({ engine: "rules", note: "LLM route returned HTTP 502" });
    const offline = await make(vi.fn(async () => Promise.reject(new TypeError("offline")))).extract(text, ctx);
    expect(offline).toMatchObject({ engine: "rules", note: "LLM route unreachable" });
    const bad = await make(vi.fn(async () => Response.json({ extraction: { urgency: "right-now" } }))).extract(text, ctx);
    expect(bad).toMatchObject({ engine: "rules", note: "LLM output failed the schema check" });
  });
});
