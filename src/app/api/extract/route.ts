import { NextResponse } from "next/server";
import { extractWithHostedModel, type AdapterFailure } from "@/lib/engine/llm-adapter";
import type { TicketField } from "@/lib/domain/types";

export const dynamic = "force-dynamic";

const MAX_TEXT = 2000;
const FIELDS: ReadonlySet<string> = new Set(["serviceType", "neighborhood", "urgency", "timeWindow", "phone", "summary"]);

// 501 tells the browser the feature is off, which it treats as "use the rules engine".
const STATUS_FOR: Record<AdapterFailure, number> = {
  "not-configured": 501,
  "http-error": 502,
  "network-error": 502,
  "invalid-output": 502,
};

export async function POST(request: Request) {
  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid-json" }, { status: 400 });
  }
  const { text, awaiting } = (payload ?? {}) as { text?: unknown; awaiting?: unknown };
  if (typeof text !== "string" || text.trim() === "" || text.length > MAX_TEXT) {
    return NextResponse.json({ error: "invalid-text" }, { status: 400 });
  }
  const field = typeof awaiting === "string" && FIELDS.has(awaiting) ? (awaiting as TicketField) : null;
  const outcome = await extractWithHostedModel(text, { awaiting: field });
  if (!outcome.ok) return NextResponse.json({ error: outcome.reason }, { status: STATUS_FOR[outcome.reason] });
  return NextResponse.json({ extraction: outcome.extraction });
}
