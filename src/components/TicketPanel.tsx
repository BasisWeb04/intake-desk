import { SAFETY_LABEL, SERVICE_LABEL, URGENCY_LABEL, WINDOW_LABEL } from "@/lib/domain/labels";
import type { Ticket, TicketField } from "@/lib/domain/types";
import { priorityOf } from "@/lib/intake/machine";
import { PriorityBadge } from "./PriorityBadge";

const STATUS_TEXT: Record<Ticket["status"], string> = {
  collecting: "Collecting details",
  complete: "Ready to submit",
  "safety-stop": "Stopped for safety",
  declined: "Declined: out of area",
  submitted: "Submitted to dispatch",
};

function fieldValue(ticket: Ticket, field: TicketField): string | null {
  switch (field) {
    case "serviceType":
      return ticket.serviceType ? SERVICE_LABEL[ticket.serviceType] : null;
    case "neighborhood":
      if (!ticket.neighborhood) return null;
      return `${ticket.neighborhood.name}${ticket.neighborhood.code ? ` (${ticket.neighborhood.code})` : ""}${ticket.neighborhood.inArea ? "" : ", outside area"}`;
    case "urgency":
      return ticket.urgency ? URGENCY_LABEL[ticket.urgency] : null;
    case "timeWindow":
      return ticket.timeWindow ? WINDOW_LABEL[ticket.timeWindow] : null;
    case "phone":
      return ticket.phone;
    case "summary":
      return ticket.summary;
  }
}

const ROWS: ReadonlyArray<[TicketField, string]> = [
  ["serviceType", "Service"],
  ["neighborhood", "Neighborhood"],
  ["urgency", "Urgency"],
  ["timeWindow", "Arrival window"],
  ["phone", "Callback"],
  ["summary", "Summary"],
];

export function TicketPanel({ ticket, awaiting }: { ticket: Ticket; awaiting: TicketField | null }) {
  const filled = ROWS.filter(([f]) => fieldValue(ticket, f) !== null).length;
  return (
    <section aria-labelledby="ticket-heading" className="rounded-lg border border-line bg-panel">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-4 py-3">
        <div>
          <h2 id="ticket-heading" className="text-sm font-semibold">
            Ticket <span className="font-mono text-muted">{ticket.id}</span>
          </h2>
          <p className="text-xs text-muted">
            {STATUS_TEXT[ticket.status]} &middot; {filled} of {ROWS.length} fields
          </p>
        </div>
        <PriorityBadge priority={priorityOf(ticket)} />
      </div>
      {ticket.safety.length > 0 && (
        <p className="border-b border-line bg-danger-soft px-4 py-2 text-xs font-semibold text-danger">
          Safety rule fired: {ticket.safety.map((k) => SAFETY_LABEL[k]).join(", ")}
        </p>
      )}
      <dl className="divide-y divide-line text-sm">
        {ROWS.map(([field, label]) => {
          const value = fieldValue(ticket, field);
          const asking = awaiting === field;
          return (
            <div key={field} className="grid grid-cols-[7.5rem_1fr] gap-2 px-4 py-2">
              <dt className="text-xs uppercase tracking-wide text-muted">{label}</dt>
              <dd className={value ? "font-mono text-[13px] break-words" : "text-xs text-muted"}>
                {value ?? (asking ? <span className="font-semibold text-accent">Asking now</span> : "Not yet")}
              </dd>
            </div>
          );
        })}
      </dl>
    </section>
  );
}
