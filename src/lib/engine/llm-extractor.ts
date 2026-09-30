import { validateExtraction } from "../domain/schema";
import type { ExtractContext, ExtractResult, Extractor } from "./extractor";
import { RuleExtractor } from "./rule-extractor";

/**
 * Browser-side extractor that asks the server route /api/extract. Any failure (route not
 * configured, HTTP error, network error, off-schema output) falls back to the rules engine,
 * and the result says which engine really answered.
 */
export class LlmExtractor implements Extractor {
  readonly id = "llm" as const;

  constructor(
    private readonly fallback: Extractor = new RuleExtractor(),
    private readonly fetchImpl: typeof fetch = (input, init) => fetch(input, init),
    private readonly endpoint = "/api/extract",
  ) {}

  async extract(text: string, context: ExtractContext): Promise<ExtractResult> {
    let response: Response;
    try {
      response = await this.fetchImpl(this.endpoint, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ text, awaiting: context.awaiting }),
      });
    } catch {
      return this.fallBack(text, context, "LLM route unreachable");
    }
    if (response.status === 501) return this.fallBack(text, context, "LLM not configured on this server");
    if (!response.ok) return this.fallBack(text, context, `LLM route returned HTTP ${response.status}`);
    let body: unknown;
    try {
      body = await response.json();
    } catch {
      return this.fallBack(text, context, "LLM route returned unreadable JSON");
    }
    const extraction = validateExtraction((body as { extraction?: unknown } | null)?.extraction);
    if (!extraction) return this.fallBack(text, context, "LLM output failed the schema check");
    return { extraction, engine: "llm" };
  }

  private async fallBack(text: string, context: ExtractContext, note: string): Promise<ExtractResult> {
    const result = await this.fallback.extract(text, context);
    return { ...result, note };
  }
}
