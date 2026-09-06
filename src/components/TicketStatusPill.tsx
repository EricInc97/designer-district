import { titleCase } from "@/lib/format";
import type { TicketStatus, TicketPriority } from "@/lib/types";

const statusStyle: Record<TicketStatus, string> = {
  open: "border-ink text-ink",
  pending_customer: "border-rule-strong text-ink-dim",
  resolved: "border-success/50 text-success",
  closed: "border-rule text-ink-faint",
};

const priorityStyle: Record<TicketPriority, string> = {
  low: "text-ink-faint",
  normal: "text-ink-faint",
  high: "text-ink-dim",
  urgent: "text-danger",
};

export function StatusPill({ status }: { status: TicketStatus }) {
  return (
    <span
      className={`inline-block rounded-full border px-3 py-1 text-[10px] uppercase tracking-[0.18em] ${statusStyle[status]}`}
    >
      {titleCase(status)}
    </span>
  );
}

export function PriorityTag({ priority }: { priority: TicketPriority }) {
  if (priority === "low" || priority === "normal") return null;
  return (
    <span
      className={`text-[10px] uppercase tracking-[0.18em] ${priorityStyle[priority]}`}
    >
      {priority}
    </span>
  );
}
