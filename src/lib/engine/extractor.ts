import type { Extraction, TicketField } from "../domain/types";

export type EngineId = "rules" | "llm";

export const ENGINE_LABEL: Record<EngineId, string> = {
  rules: "Rules engine",
  llm: "LLM",
};

export interface ExtractContext {
  /** The field the assistant just asked about, so bare answers like "mornings" can be read in context. */
  awaiting: TicketField | null;
}

export interface ExtractResult {
  extraction: Extraction;
  /** Which engine actually produced this extraction (after any fallback). */
  engine: EngineId;
  /** Why a fallback happened, shown to the user next to the engine label. */
  note?: string;
}

export interface Extractor {
  readonly id: EngineId;
  extract(text: string, context: ExtractContext): Promise<ExtractResult>;
}
