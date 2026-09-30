"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { SAFETY_LABEL, SERVICE_LABEL, URGENCY_LABEL, WINDOW_LABEL } from "@/lib/domain/labels";
import { priorityOf } from "@/lib/intake/machine";
import { SAFETY_INSTRUCTIONS } from "@/lib/safety/safety-text";
import { clearTickets, loadTickets, sampleTickets, saveTicket, sortForDispatch, type SubmittedTicket } from "@/lib/store/tickets";
import { PriorityBadge } from "./PriorityBadge";

function formatTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

function Detail({ ticket }: { ticket: SubmittedTicket }) {
  const rows: Array<[string, string]> = [
    ["Service", ticket.serviceType ? SERVICE_LABEL[ticket.serviceType] : "Not collected"],
    ["Urgency", ticket.urgency ? URGENCY_LABEL[ticket.urgency] : "Not collected"],
    ["Neighborhood", ticket.neighborhood ? `${ticket.neighborhood.name} (${ticket.neighborhood.code ?? "no code"})` : "Not collected"],
    ["Arrival window", ticket.timeWindow ? WINDOW_LABEL[ticket.timeWindow] : "Not collected"],
    ["Callback", ticket.phone ?? "Not collected"],
    ["Received", formatTime(ticket.submittedAt)],
  ];
  return (
    <section aria-labelledby="detail-heading" className="rounded-lg border border-line bg-panel">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-4 py-3">
        <h2 id="detail-heading" className="font-mono text-sm font-semibold">
          {ticket.id}
        </h2>
        <PriorityBadge priority={priorityOf(ticket)} />
      </div>
      {ticket.safety.length > 0 && (
        <div className="border-b border-line bg-danger-soft px-4 py-3 text-xs text-danger">
          <p className="font-semibold">Safety: {ticket.safety.map((k) => SAFETY_LABEL[k]).join(", ")}</p>
          <p className="mt-1">Customer was shown: {ticket.safety.map((k) => SAFETY_INSTRUCTIONS[k]).join(" ")}</p>
        </div>
      )}
      <p className="border-b border-line px-4 py-3 text-sm">{ticket.summary ?? "No summary."}</p>
      <dl className="divide-y divide-line text-sm">
        {rows.map(([label, value]) => (
          <div key={label} className="grid grid-cols-[7.5rem_1fr] gap-2 px-4 py-2">
            <dt className="text-xs uppercase tracking-wide text-muted">{label}</dt>
            <dd className="font-mono text-[13px]">{value}</dd>
          </div>
        ))}
      </dl>
      <details className="border-t border-line px-4 py-3 text-xs">
        <summary className="cursor-pointer font-medium">Transcript ({ticket.transcript.length} turns)</summary>
        <ol className="mt-2 space-y-1.5">
          {ticket.transcript.map((t, i) => (
            <li key={i}>
              <span className="font-semibold">{t.role === "customer" ? "Customer" : (t.source ?? "Assistant")}:</span> {t.text}
            </li>
          ))}
        </ol>
      </details>
    </section>
  );
}

export function DispatchBoard() {
  const [tickets, setTickets] = useState<SubmittedTicket[] | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => setTickets(sortForDispatch(loadTickets(window.localStorage))), []);

  function loadSamples() {
    for (const t of sampleTickets()) saveTicket(window.localStorage, t);
    setTickets(sortForDispatch(loadTickets(window.localStorage)));
  }

  function clearAll() {
    if (!window.confirm("Remove every ticket stored in this browser?")) return;
    clearTickets(window.localStorage);
    setTickets([]);
    setSelectedId(null);
  }

  const selected = tickets?.find((t) => t.id === selectedId) ?? null;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold">Dispatch board</h1>
          <p className="text-xs text-muted">
            Sorted by priority, then oldest first. Tickets are stored only in this browser (memory plus localStorage); nothing
            is sent to a server.
          </p>
        </div>
        <div className="flex gap-2 text-sm">
          <button type="button" onClick={loadSamples} className="rounded border border-line px-3 py-1.5 hover:bg-accent-soft">
            Load sample tickets
          </button>
          <button
            type="button"
            onClick={clearAll}
            disabled={!tickets?.length}
            className="rounded border border-line px-3 py-1.5 hover:bg-danger-soft disabled:opacity-50"
          >
            Clear all
          </button>
        </div>
      </div>

      {tickets === null ? (
        <p className="text-sm text-muted">Loading tickets from this browser...</p>
      ) : tickets.length === 0 ? (
        <div className="rounded-lg border border-dashed border-line bg-panel px-4 py-10 text-center text-sm">
          <p className="font-medium">No tickets yet.</p>
          <p className="mt-1 text-muted">
            Submit one from{" "}
            <Link className="text-accent underline underline-offset-2" href="/">
              customer intake
            </Link>{" "}
            or load the sample tickets.
          </p>
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_24rem]">
          <div className="min-w-0 overflow-x-auto rounded-lg border border-line bg-panel">
            <table className="w-full min-w-[40rem] text-left text-sm">
              <caption className="sr-only">Submitted tickets, most urgent first</caption>
              <thead className="border-b border-line text-xs uppercase tracking-wide text-muted">
                <tr>
                  <th scope="col" className="px-3 py-2 font-medium">Priority</th>
                  <th scope="col" className="px-3 py-2 font-medium">Ticket</th>
                  <th scope="col" className="px-3 py-2 font-medium">Service</th>
                  <th scope="col" className="px-3 py-2 font-medium">Area</th>
                  <th scope="col" className="px-3 py-2 font-medium">Window</th>
                  <th scope="col" className="px-3 py-2 font-medium">Received</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {tickets.map((t) => (
                  <tr key={t.id} className={t.id === selectedId ? "bg-accent-soft" : undefined}>
                    <td className="px-3 py-2">
                      <PriorityBadge priority={priorityOf(t)} />
                    </td>
                    <td className="px-3 py-2">
                      <button
                        type="button"
                        onClick={() => setSelectedId(t.id)}
                        aria-pressed={t.id === selectedId}
                        className="font-mono text-[13px] text-accent underline underline-offset-2"
                      >
                        {t.id}
                      </button>
                    </td>
                    <td className="px-3 py-2">
                      {t.safety.length ? SAFETY_LABEL[t.safety[0]] : t.serviceType ? SERVICE_LABEL[t.serviceType] : "-"}
                    </td>
                    <td className="px-3 py-2">{t.neighborhood?.name ?? "-"}</td>
                    <td className="px-3 py-2">{t.timeWindow ? WINDOW_LABEL[t.timeWindow] : "-"}</td>
                    <td className="whitespace-nowrap px-3 py-2 font-mono text-[12px] text-muted">{formatTime(t.submittedAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {selected ? (
            <Detail ticket={selected} />
          ) : (
            <p className="rounded-lg border border-dashed border-line bg-panel px-4 py-6 text-sm text-muted">
              Select a ticket to see its details and transcript.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
