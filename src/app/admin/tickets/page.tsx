import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireStaff } from "@/lib/auth";
import { StatusPill, PriorityTag } from "@/components/TicketStatusPill";
import { relative, titleCase, money } from "@/lib/format";
import type { Ticket, TicketStatus } from "@/lib/types";

export const metadata: Metadata = { title: "Tickets" };

type Row = Ticket & { profiles: { email: string | null; full_name: string | null } | null };

type Props = { searchParams: Promise<{ status?: string }> };

const filters: { key: string; label: string; statuses?: TicketStatus[] }[] = [
  { key: "", label: "Needs attention", statuses: ["open", "pending_customer"] },
  { key: "open", label: "Open", statuses: ["open"] },
  { key: "resolved", label: "Resolved", statuses: ["resolved"] },
  { key: "closed", label: "Closed", statuses: ["closed"] },
  { key: "all", label: "All" },
];

export default async function AdminTicketsPage({ searchParams }: Props) {
  const staff = await requireStaff();
  if (!staff.can("tickets.view")) redirect("/admin");

  const { status = "" } = await searchParams;
  const active = filters.find((f) => f.key === status) ?? filters[0];

  const supabase = await createClient();
  let query = supabase
    .from("tickets")
    .select("*, profiles!tickets_user_id_fkey(email, full_name)")
    .order("updated_at", { ascending: false })
    .limit(100);

  if (active.statuses) query = query.in("status", active.statuses);

  const { data } = await query;
  const tickets = (data ?? []) as unknown as Row[];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="display text-xl">Support queue</h2>
        <p className="mt-1.5 text-sm text-ink-faint">
          Sorted by most recent activity. Every ticket is a live chat.
        </p>
      </div>

      <nav aria-label="Filter tickets">
        <ul className="flex flex-wrap gap-2">
          {filters.map((f) => (
            <li key={f.key}>
              <Link
                href={f.key ? `/admin/tickets?status=${f.key}` : "/admin/tickets"}
                aria-current={active.key === f.key ? "true" : undefined}
                className={`inline-block rounded-full border px-4 py-2 text-[11px] uppercase tracking-[0.16em] transition-colors ${
                  active.key === f.key
                    ? "border-ink bg-ink text-paper"
                    : "border-rule-strong text-ink-dim hover:text-ink hover:border-ink"
                }`}
              >
                {f.label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>

      <ul className="divide-y divide-rule overflow-hidden rounded-xl border border-rule">
        {tickets.length === 0 && (
          <li className="bg-paper-raised px-5 py-14 text-center text-sm text-ink-faint">
            Nothing in this view.
          </li>
        )}

        {tickets.map((ticket) => (
          <li key={ticket.id}>
            <Link
              href={`/admin/tickets/${ticket.id}`}
              className="flex flex-wrap items-center gap-4 bg-paper-raised px-5 py-4 hover:bg-paper-sunken transition-colors"
            >
              <div className="min-w-0 flex-1">
                <p className="flex items-center gap-2 truncate text-sm">
                  {ticket.subject}
                  <PriorityTag priority={ticket.priority} />
                </p>
                <p className="mt-0.5 truncate text-xs text-ink-faint">
                  <span className="font-mono">{ticket.ticket_number}</span> ·{" "}
                  {ticket.profiles?.full_name || ticket.profiles?.email || "Customer"} ·{" "}
                  {titleCase(ticket.kind)} · {relative(ticket.updated_at)}
                  {ticket.credit_issued > 0 &&
                    ` · ${money(ticket.credit_issued)} credited`}
                </p>
              </div>
              <StatusPill status={ticket.status} />
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
