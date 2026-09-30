import { describe, expect, it } from "vitest";
import { validateExtraction } from "../src/lib/domain/schema";
import {
  STORAGE_KEY,
  clearTickets,
  loadTickets,
  sampleTickets,
  saveTicket,
  sortForDispatch,
  type StorageLike,
} from "../src/lib/store/tickets";

function memoryStorage(initial: Record<string, string> = {}): StorageLike {
  const data = new Map(Object.entries(initial));
  return {
    getItem: (k) => data.get(k) ?? null,
    setItem: (k, v) => void data.set(k, v),
    removeItem: (k) => void data.delete(k),
  };
}

describe("ticket store (localStorage)", () => {
  it("round-trips tickets and replaces by id", () => {
    const storage = memoryStorage();
    const [a, b] = sampleTickets(new Date("2026-09-30T12:00:00Z"));
    saveTicket(storage, a);
    saveTicket(storage, b);
    saveTicket(storage, { ...a, summary: "edited" });
    const loaded = loadTickets(storage);
    expect(loaded).toHaveLength(2);
    expect(loaded.find((t) => t.id === a.id)?.summary).toBe("edited");
    clearTickets(storage);
    expect(loadTickets(storage)).toEqual([]);
  });

  it("survives corrupt storage", () => {
    expect(loadTickets(memoryStorage({ [STORAGE_KEY]: "{not json" }))).toEqual([]);
    expect(loadTickets(memoryStorage({ [STORAGE_KEY]: '[{"id":1}]' }))).toEqual([]);
  });

  it("sorts safety first, then urgency, then oldest first", () => {
    const now = new Date("2026-09-30T12:00:00Z");
    const [flexible, today, emergency, safety] = sampleTickets(now);
    const olderToday = { ...today, id: "CPD-OLD", createdAt: "2026-09-29T08:00:00.000Z" };
    const order = sortForDispatch([flexible, today, olderToday, emergency, safety]).map((t) => t.id);
    expect(order).toEqual([safety.id, emergency.id, "CPD-OLD", today.id, flexible.id]);
  });
});

describe("extraction schema check", () => {
  it("accepts valid partial output and drops nulls", () => {
    expect(validateExtraction({ serviceType: "leak", urgency: null, summary: " drip " })).toEqual({
      serviceType: "leak",
      summary: "drip",
    });
  });

  it.each([
    ["non-object", "clog"],
    ["array", []],
    ["bad enum", { serviceType: "roofing" }],
    ["unknown key", { serviceType: "leak", priority: "high" }],
    ["wrong type", { phone: 4065550142 }],
    ["too long", { summary: "x".repeat(201) }],
  ])("rejects %s", (_label, input) => {
    expect(validateExtraction(input)).toBeNull();
  });
});
