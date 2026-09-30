import { referralMessage, resolvePlace } from "../domain/area";
import { SERVICE_LABEL, URGENCY_LABEL, WINDOW_LABEL } from "../domain/labels";
import { validateCallback } from "../domain/phone";
import { validateExtraction } from "../domain/schema";
import type { Extraction, Priority, Ticket, TicketField } from "../domain/types";
import { ENGINE_LABEL, type EngineId, type Extractor } from "../engine/extractor";
import { detectSafety } from "../safety/detect";
import { SAFETY_INSTRUCTIONS, SAFETY_STOP_NOTE } from "../safety/safety-text";

export type TurnSource = "Rules engine" | "LLM" | "Safety rules" | "Intake";

export interface Turn {
  role: "customer" | "assistant";
  text: string;
  source?: TurnSource;
  note?: string;
  tone?: "question" | "safety" | "decline" | "done" | "info";
}

export interface IntakeState {
  ticket: Ticket;
  awaiting: TicketField | null;
  attempts: Partial<Record<TicketField, number>>;
  turns: Turn[];
}

/** Order the assistant asks in: what and where first, because out-of-area should end intake early. */
export const FIELD_ORDER: readonly TicketField[] = ["serviceType", "neighborhood", "urgency", "timeWindow", "phone", "summary"];

export const QUESTIONS: Record<TicketField, string> = {
  serviceType: "What kind of problem is it: a leak, a clog, the water heater, the sewer line, installing a fixture, a gas line, or something else?",
  neighborhood: "Which neighborhood is the property in? A name or the 5-digit area code both work.",
  urgency: "How soon do you need someone: is it an emergency, today, this week, or are you flexible?",
  timeWindow: "What arrival window suits you: morning (8-12), afternoon (12-5), evening (5-8), or any time?",
  phone: "What is the best callback number? This demo accepts fictional numbers such as (406) 555-0142.",
  summary: "In a sentence, what is going on? For example: kitchen sink backs up when the dishwasher runs.",
};

const REPROMPTS: Record<TicketField, string> = {
  serviceType: "Sorry, I did not catch the type of job. Could you pick one: leak, clog, water heater, sewer, fixture install, gas line, or other?",
  neighborhood:
    "I could not match that to our service area. We cover Alder Flats, Brassmill, Cinder Hollow, Dovecote Park, Estuary Bend, Foxglove Terrace, Gantry Yard and Harrow Glen (99991 to 99998). Which one are you in?",
  urgency: "Could you pick one: emergency, today, this week, or flexible?",
  timeWindow: "Could you pick one: morning, afternoon, evening, or any time?",
  phone: "I need a 10-digit number, for example (406) 555-0142.",
  summary: QUESTIONS.summary,
};

export const GREETING =
  "Hi, this is the Copperline Plumbing & Drain intake desk. Tell me what is going on, in your own words, and I will set up a ticket.";

function makeId(now: Date): string {
  const random = Math.floor(Math.random() * 36 ** 3).toString(36).padStart(3, "0");
  return `CPD-${now.getTime().toString(36).slice(-5).toUpperCase()}${random.toUpperCase()}`;
}

export function createIntake(now: Date = new Date(), id: string = makeId(now)): IntakeState {
  return {
    ticket: {
      id,
      createdAt: now.toISOString(),
      status: "collecting",
      serviceType: null,
      urgency: null,
      neighborhood: null,
      timeWindow: null,
      phone: null,
      summary: null,
      safety: [],
    },
    awaiting: null,
    attempts: {},
    turns: [{ role: "assistant", text: GREETING, source: "Intake", tone: "info" }],
  };
}

export function nextMissingField(ticket: Ticket): TicketField | null {
  return FIELD_ORDER.find((field) => ticket[field] === null) ?? null;
}

/** Safety beats everything, then the customer's stated urgency. */
export function priorityOf(ticket: Ticket): Priority | null {
  if (ticket.safety.length > 0) return "emergency-safety";
  return ticket.urgency;
}

function say(state: IntakeState, turn: Turn): IntakeState {
  return { ...state, turns: [...state.turns, turn] };
}

/** Stops intake and shows the fixed instructions. Safety kinds only ever accumulate. */
export function applySafety(state: IntakeState, kinds: Ticket["safety"], text: string): IntakeState {
  const safety = Array.from(new Set([...state.ticket.safety, ...kinds]));
  const summary = state.ticket.summary ?? text.replace(/\s+/g, " ").trim().slice(0, 140);
  const instructions = kinds.map((k) => SAFETY_INSTRUCTIONS[k]).join("\n\n");
  const next: IntakeState = { ...state, awaiting: null, ticket: { ...state.ticket, safety, summary, status: "safety-stop" } };
  return say(next, { role: "assistant", text: `${instructions}\n\n${SAFETY_STOP_NOTE}`, source: "Safety rules", tone: "safety" });
}

function acknowledge(before: Ticket, after: Ticket): string {
  const parts: string[] = [];
  if (after.serviceType && after.serviceType !== before.serviceType) parts.push(SERVICE_LABEL[after.serviceType].toLowerCase());
  if (after.neighborhood && after.neighborhood !== before.neighborhood) parts.push(`in ${after.neighborhood.name}`);
  if (after.urgency && after.urgency !== before.urgency) parts.push(URGENCY_LABEL[after.urgency].toLowerCase());
  if (after.timeWindow && after.timeWindow !== before.timeWindow) parts.push(WINDOW_LABEL[after.timeWindow].toLowerCase());
  if (after.phone && after.phone !== before.phone) parts.push(`callback ${after.phone}`);
  return parts.length > 0 ? `Got it: ${parts.join(", ")}. ` : "";
}

/** Merges one extraction into the ticket and decides the single next question. Pure. */
export function applyExtraction(
  state: IntakeState,
  proposed: Extraction,
  customerText: string,
  engine: EngineId,
  note?: string,
): IntakeState {
  // Re-checked here too, so no extractor (current or future) can smuggle in an off-schema value.
  const extraction = validateExtraction(proposed) ?? {};
  const before = state.ticket;
  const t: Ticket = { ...before };
  let problem = "";
  if (extraction.serviceType) t.serviceType = extraction.serviceType;
  if (extraction.urgency) t.urgency = extraction.urgency;
  if (extraction.timeWindow) t.timeWindow = extraction.timeWindow;
  if (extraction.summary && !t.summary) t.summary = extraction.summary;
  if (state.awaiting === "summary" && !t.summary) t.summary = customerText.replace(/\s+/g, " ").trim().slice(0, 140);
  if (extraction.phone) {
    const check = validateCallback(extraction.phone);
    if (check.valid && check.formatted) t.phone = check.formatted;
    else problem = `That number did not work: ${check.reason} `;
  }
  if (extraction.neighborhood) {
    const place = resolvePlace(extraction.neighborhood);
    if (place) t.neighborhood = place;
  }
  // An emergency means "come now", so asking for a preferred window would only slow things down.
  if (t.urgency === "emergency" && !t.timeWindow) t.timeWindow = "asap";

  const source = ENGINE_LABEL[engine] as TurnSource;
  const attempts = { ...state.attempts };
  if (state.awaiting && t[state.awaiting] === null) attempts[state.awaiting] = (attempts[state.awaiting] ?? 0) + 1;
  if (state.awaiting === "serviceType" && t.serviceType === null && (attempts.serviceType ?? 0) >= 2) t.serviceType = "other";

  if (t.neighborhood && !t.neighborhood.inArea) {
    const declined = { ...state, attempts, awaiting: null, ticket: { ...t, status: "declined" as const } };
    return say(declined, { role: "assistant", text: referralMessage(t.neighborhood), source, note, tone: "decline" });
  }

  const next = nextMissingField(t);
  if (next === null) {
    const done = { ...state, attempts, awaiting: null, ticket: { ...t, status: "complete" as const } };
    const text = `${acknowledge(before, t)}That is everything I need. Check the ticket on the right, then submit it to dispatch.`;
    return say(done, { role: "assistant", text, source, note, tone: "done" });
  }
  const repeated = next === state.awaiting && (attempts[next] ?? 0) > 0;
  const question = repeated && !problem ? REPROMPTS[next] : QUESTIONS[next];
  const collecting = { ...state, attempts, awaiting: next, ticket: { ...t, status: "collecting" as const } };
  const text = `${problem}${acknowledge(before, t)}${question}`;
  return say(collecting, { role: "assistant", text, source, note, tone: "question" });
}

const TERMINAL_REPLY: Partial<Record<Ticket["status"], string>> = {
  declined: "This address is outside our service area, so the ticket is closed. Start a new intake for a different address.",
  submitted: "This ticket is already with dispatch. Start a new intake for another job.",
};

/**
 * Handles one customer message. Safety rules run first on every message, before any
 * extractor is called, and nothing an extractor returns can clear a safety stop.
 */
export async function processMessage(state: IntakeState, text: string, extractor: Extractor): Promise<IntakeState> {
  const trimmed = text.trim();
  if (!trimmed) return state;
  const withCustomer = say(state, { role: "customer", text: trimmed });

  const safety = detectSafety(trimmed);
  if (safety.kinds.length > 0) return applySafety(withCustomer, safety.kinds, trimmed);
  if (state.ticket.status === "safety-stop") {
    const repeat = state.ticket.safety.map((k) => SAFETY_INSTRUCTIONS[k]).join("\n\n");
    return say(withCustomer, { role: "assistant", text: repeat, source: "Safety rules", tone: "safety" });
  }
  const terminal = TERMINAL_REPLY[state.ticket.status];
  if (terminal) return say(withCustomer, { role: "assistant", text: terminal, source: "Intake", tone: "info" });

  const result = await extractor.extract(trimmed, { awaiting: state.awaiting });
  return applyExtraction(withCustomer, result.extraction, trimmed, result.engine, result.note);
}

/** Only complete or safety-stopped tickets can go to dispatch; safety tickets go even when fields are missing. */
export function canSubmit(state: IntakeState): boolean {
  return state.ticket.status === "complete" || state.ticket.status === "safety-stop";
}

export function submitTicket(state: IntakeState): IntakeState {
  if (!canSubmit(state)) return state;
  const wasSafety = state.ticket.status === "safety-stop";
  const ticket: Ticket = { ...state.ticket, status: "submitted", safety: state.ticket.safety };
  const text = wasSafety
    ? `Ticket ${ticket.id} is at the top of the dispatch queue as Emergency: safety.`
    : `Ticket ${ticket.id} is submitted. A dispatcher will call you to confirm the visit.`;
  return say({ ...state, awaiting: null, ticket }, { role: "assistant", text, source: "Intake", tone: "done" });
}
