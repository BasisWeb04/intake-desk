"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { SERVICE_NEIGHBORHOODS } from "@/lib/domain/area";
import type { Extractor } from "@/lib/engine/extractor";
import { LlmExtractor } from "@/lib/engine/llm-extractor";
import { RuleExtractor } from "@/lib/engine/rule-extractor";
import { canSubmit, createIntake, processMessage, submitTicket, type IntakeState, type Turn } from "@/lib/intake/machine";
import { saveTicket } from "@/lib/store/tickets";
import { TicketPanel } from "./TicketPanel";

type EngineChoice = "rules" | "llm";

const EXAMPLES: ReadonlyArray<[string, string]> = [
  ["Clogged sink", "Kitchen sink is clogged and won't drain. I'm in Brassmill, tomorrow morning works. 406-555-0142"],
  ["Typos", "my toliet is cloged and overflowing, harow glen, asap"],
  ["Gas smell", "I think I smell gas near the water heater"],
  ["Out of area", "Leaky kitchen faucet, I'm over in Kestrel Point"],
  ["Near miss", "gas water heater pilot is out, no smell. Alder Flats"],
];

function TurnBubble({ turn }: { turn: Turn }) {
  if (turn.role === "customer") {
    return (
      <li className="ml-auto max-w-[85%] rounded-lg bg-accent-soft px-3 py-2 text-sm">
        <span className="sr-only">You said: </span>
        {turn.text}
      </li>
    );
  }
  const safety = turn.tone === "safety";
  const frame = safety ? "border-2 border-danger bg-danger-soft" : "border border-line bg-panel";
  return (
    <li className={`max-w-[92%] rounded-lg px-3 py-2 text-sm ${frame}`} role={safety ? "alert" : undefined}>
      {safety && <p className="mb-1 text-xs font-bold uppercase tracking-wide text-danger">Safety first</p>}
      <p className="whitespace-pre-line">{turn.text}</p>
      {turn.source && (
        <p className="mt-1.5 text-[11px] text-muted">
          Answered by: <span className="font-mono font-semibold">{turn.source}</span>
          {turn.note ? ` (${turn.note})` : ""}
        </p>
      )}
    </li>
  );
}

export function IntakeDesk() {
  // A fixed placeholder on the server avoids a hydration mismatch; the real id is minted in the browser.
  const [state, setState] = useState<IntakeState>(() => createIntake(new Date(0), "CPD-NEW"));
  const [engine, setEngine] = useState<EngineChoice>("rules");
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const logRef = useRef<HTMLOListElement>(null);

  const extractor: Extractor = useMemo(
    () => (engine === "llm" ? new LlmExtractor(new RuleExtractor()) : new RuleExtractor()),
    [engine],
  );

  useEffect(() => setState(createIntake()), []);

  useEffect(() => {
    logRef.current?.lastElementChild?.scrollIntoView({ block: "nearest" });
  }, [state.turns.length]);

  async function send(text: string) {
    if (!text.trim() || busy) return;
    setBusy(true);
    setError(null);
    try {
      setState(await processMessage(state, text, extractor));
      setDraft("");
    } catch {
      setError("Something went wrong reading that message. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    void send(draft);
  }

  function onSendToDispatch() {
    const next = submitTicket(state);
    try {
      const now = new Date().toISOString();
      saveTicket(window.localStorage, { ...next.ticket, submittedAt: now, transcript: next.turns });
      setState(next);
    } catch {
      setError("Could not save to this browser's storage. Private browsing can block it.");
    }
  }

  const closed = state.ticket.status === "submitted";

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_22rem]">
      <section aria-labelledby="chat-heading" className="flex min-w-0 flex-col rounded-lg border border-line bg-panel">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-4 py-3">
          <h1 id="chat-heading" className="text-sm font-semibold">
            Customer intake
          </h1>
          <fieldset className="flex flex-wrap items-center gap-3 text-xs">
            <legend className="sr-only">Extraction engine</legend>
            <label className="flex items-center gap-1.5">
              <input type="radio" name="engine" checked={engine === "rules"} onChange={() => setEngine("rules")} />
              Rules engine (default)
            </label>
            <label className="flex items-center gap-1.5">
              <input type="radio" name="engine" checked={engine === "llm"} onChange={() => setEngine("llm")} />
              LLM (optional), falls back to rules
            </label>
          </fieldset>
        </div>

        <ol ref={logRef} aria-live="polite" className="flex h-[28rem] flex-col gap-2 overflow-y-auto px-4 py-4">
          {state.turns.map((turn, i) => (
            <TurnBubble key={i} turn={turn} />
          ))}
        </ol>

        {error && (
          <p role="alert" className="mx-4 mb-2 rounded border border-danger bg-danger-soft px-3 py-2 text-xs text-danger">
            {error}
          </p>
        )}

        <form onSubmit={onSubmit} className="border-t border-line px-4 py-3">
          <label htmlFor="message" className="mb-1 block text-xs font-medium text-muted">
            Your message
          </label>
          <div className="flex gap-2">
            <input
              id="message"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              disabled={busy || closed}
              maxLength={2000}
              autoComplete="off"
              placeholder={closed ? "Ticket submitted" : "Describe the problem"}
              className="min-w-0 flex-1 rounded border border-line bg-bg px-3 py-2 text-sm placeholder:text-muted"
            />
            <button
              type="submit"
              disabled={busy || closed || !draft.trim()}
              className="rounded bg-accent px-4 py-2 text-sm font-semibold text-accent-ink disabled:opacity-50"
            >
              {busy ? "Reading" : "Send"}
            </button>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-1.5 text-xs">
            <span className="text-muted">Try:</span>
            {EXAMPLES.map(([label, text]) => (
              <button
                key={label}
                type="button"
                disabled={busy || closed}
                onClick={() => void send(text)}
                className="rounded border border-line px-2 py-1 hover:bg-accent-soft disabled:opacity-50"
              >
                {label}
              </button>
            ))}
          </div>
        </form>
      </section>

      <aside className="flex min-w-0 flex-col gap-4">
        <TicketPanel ticket={state.ticket} awaiting={state.awaiting} />
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={onSendToDispatch}
            disabled={!canSubmit(state)}
            className="rounded bg-accent px-3 py-2 text-sm font-semibold text-accent-ink disabled:opacity-50"
          >
            Submit to dispatch
          </button>
          <button
            type="button"
            onClick={() => {
              setState(createIntake());
              setError(null);
            }}
            className="rounded border border-line px-3 py-2 text-sm"
          >
            New intake
          </button>
        </div>
        {closed && (
          <p className="text-sm">
            Saved.{" "}
            <Link className="text-accent underline underline-offset-2" href="/dispatch">
              Open the dispatch board
            </Link>
          </p>
        )}
        <section aria-labelledby="area-heading" className="rounded-lg border border-line bg-panel px-4 py-3 text-xs">
          <h2 id="area-heading" className="mb-2 font-semibold">
            Service area (fictional)
          </h2>
          <ul className="grid grid-cols-2 gap-x-3 gap-y-1 font-mono text-[12px]">
            {SERVICE_NEIGHBORHOODS.map((n) => (
              <li key={n.name}>
                {n.name} <span className="text-muted">{n.code}</span>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-muted">
            Callback numbers must be in the fictional 555-0100 to 555-0199 range. LLM mode is optional and tested only against a
            mocked API. It calls /api/extract; with no server key it returns 501 and each turn is answered by the rules engine instead, as the label under each reply shows.
          </p>
        </section>
      </aside>
    </div>
  );
}
