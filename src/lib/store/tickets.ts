import { PRIORITY_RANK } from "../domain/labels";
import type { Ticket } from "../domain/types";
import { priorityOf, type Turn } from "../intake/machine";

/** Tickets live only in this browser's localStorage; there is no server database in this demo. */
export const STORAGE_KEY = "intake-desk.tickets.v1";

export interface SubmittedTicket extends Ticket {
  submittedAt: string;
  transcript: Turn[];
}

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

function looksLikeTicket(value: unknown): value is SubmittedTicket {
  if (typeof value !== "object" || value === null) return false;
  const t = value as Partial<SubmittedTicket>;
  return typeof t.id === "string" && typeof t.createdAt === "string" && Array.isArray(t.safety) && Array.isArray(t.transcript);
}

/** Corrupt or foreign data is dropped rather than crashing the board. */
export function loadTickets(storage: StorageLike): SubmittedTicket[] {
  try {
    const parsed: unknown = JSON.parse(storage.getItem(STORAGE_KEY) ?? "[]");
    return Array.isArray(parsed) ? parsed.filter(looksLikeTicket) : [];
  } catch {
    return [];
  }
}

export function saveTicket(storage: StorageLike, ticket: SubmittedTicket): SubmittedTicket[] {
  const others = loadTickets(storage).filter((t) => t.id !== ticket.id);
  const all = [...others, ticket];
  storage.setItem(STORAGE_KEY, JSON.stringify(all));
  return all;
}

export function clearTickets(storage: StorageLike): void {
  storage.removeItem(STORAGE_KEY);
}

const UNRANKED = 99;

/** Most urgent first; within the same priority, the oldest ticket first so nobody waits forever. */
export function sortForDispatch(tickets: readonly SubmittedTicket[]): SubmittedTicket[] {
  return [...tickets].sort((a, b) => {
    const pa = priorityOf(a);
    const pb = priorityOf(b);
    const rank = (pa ? PRIORITY_RANK[pa] : UNRANKED) - (pb ? PRIORITY_RANK[pb] : UNRANKED);
    return rank !== 0 ? rank : a.createdAt.localeCompare(b.createdAt);
  });
}

function sample(partial: Partial<SubmittedTicket> & Pick<SubmittedTicket, "id" | "summary">, minutesAgo: number, now: Date): SubmittedTicket {
  const at = new Date(now.getTime() - minutesAgo * 60_000).toISOString();
  return {
    createdAt: at,
    submittedAt: at,
    status: "submitted",
    serviceType: null,
    urgency: null,
    neighborhood: null,
    timeWindow: null,
    phone: null,
    safety: [],
    transcript: [{ role: "customer", text: partial.summary ?? "" }],
    ...partial,
  };
}

/** Fictional tickets so the board can be explored without typing a whole intake first. */
export function sampleTickets(now: Date = new Date()): SubmittedTicket[] {
  return [
    sample({ id: "CPD-SAMPLE1", serviceType: "fixture-install", urgency: "flexible", neighborhood: { name: "Dovecote Park", code: "99994", inArea: true }, timeWindow: "anytime", phone: "(415) 555-0133", summary: "New bathroom faucet to install, no rush." }, 180, now),
    sample({ id: "CPD-SAMPLE2", serviceType: "clog", urgency: "today", neighborhood: { name: "Brassmill", code: "99992", inArea: true }, timeWindow: "afternoon", phone: "(406) 555-0142", summary: "Kitchen sink fully clogged, water not draining." }, 45, now),
    sample({ id: "CPD-SAMPLE3", serviceType: "leak", urgency: "emergency", neighborhood: { name: "Foxglove Terrace", code: "99996", inArea: true }, timeWindow: "asap", phone: "(720) 555-0163", summary: "Pipe burst in basement, water everywhere." }, 20, now),
    sample({ id: "CPD-SAMPLE4", safety: ["gas"], summary: "Smells like gas near the water heater." }, 5, now),
  ];
}
