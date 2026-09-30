import { PRIORITY_LABEL } from "@/lib/domain/labels";
import type { Priority } from "@/lib/domain/types";

const STYLE: Record<Priority, string> = {
  "emergency-safety": "bg-danger text-panel border-danger",
  emergency: "bg-danger-soft text-danger border-danger",
  today: "bg-accent-soft text-accent border-accent",
  "this-week": "bg-panel text-ink border-line",
  flexible: "bg-panel text-muted border-line",
};

export function PriorityBadge({ priority }: { priority: Priority | null }) {
  if (!priority) {
    return <span className="inline-block rounded border border-line px-2 py-0.5 text-xs text-muted">Unset</span>;
  }
  return (
    <span className={`inline-block whitespace-nowrap rounded border px-2 py-0.5 text-xs font-semibold ${STYLE[priority]}`}>
      {PRIORITY_LABEL[priority]}
    </span>
  );
}
