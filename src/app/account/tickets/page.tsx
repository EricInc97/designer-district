import type { Metadata } from "next";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { createTicket } from "@/app/account/actions";
import { StatusPill } from "@/components/TicketStatusPill";
import { relative, titleCase } from "@/lib/format";
import type { Ticket, TicketKind } from "@/lib/types";

export const metadata: Metadata = { title: "Support" };

type Props = { searchParams: Promise<{ kind?: string; error?: string }> };

const kinds: { value: TicketKind; label: string }[] = [
  { value: "general", label: "General question" },
  { value: "order_issue", label: "Problem with an order" },
  { value: "return", label: "Return" },
  { value: "refund", label: "Refund (store credit)" },
  { value: "complaint", label: "Complaint" },
];

export default async function TicketsPage({ searchParams }: Props) {
  const { kind = "general", error } = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data } = await supabase
    .from("tickets")
    .select("*")
    .eq("user_id", user!.id)
    .order("updated_at", { ascending: false });

  const tickets = (data ?? []) as Ticket[];
  const preselected = kinds.some((k) => k.value === kind) ? kind : "general";

  return (
    <div className="grid gap-12 lg:grid-cols-[1fr_380px]">
      {/* ---------------- TICKET LIST ---------------- */}
      <section>
        <h2 className="display text-xl">Your tickets</h2>
        <p className="mt-1.5 text-sm text-ink-faint">
          Every ticket has a live chat. We reply in it, you get the answer here.
        </p>

        {tickets.length === 0 ? (
          <p className="mt-8 rounded-xl border border-rule bg-paper-raised px-6 py-14 text-center text-sm text-ink-dim">
            No tickets yet. Open one on the right.
          </p>
        ) : (
          <ul className="mt-6 divide-y divide-rule overflow-hidden rounded-xl border border-rule">
            {tickets.map((ticket) => (
              <li key={ticket.id}>
                <Link
                  href={`/account/tickets/${ticket.id}`}
                  className="flex items-center justify-between gap-4 bg-paper-raised px-5 py-4 hover:bg-paper-sunken transition-colors"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm">{ticket.subject}</p>
                    <p className="mt-0.5 text-xs text-ink-faint">
                      <span className="font-mono">{ticket.ticket_number}</span> ·{" "}
                      {titleCase(ticket.kind)} · {relative(ticket.updated_at)}
                      {ticket.credit_issued > 0 &&
                        ` · $${ticket.credit_issued} credit issued`}
                    </p>
                  </div>
                  <StatusPill status={ticket.status} />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* ---------------- NEW TICKET ---------------- */}
      <section className="lg:sticky lg:top-24 lg:self-start">
        <div className="rounded-xl border border-rule bg-paper-raised p-6">
          <h2 className="display text-lg">Open a ticket</h2>
          <p className="mt-1.5 text-sm text-ink-faint">
            Refunds are issued as store credit, usually within one business day.
          </p>

          {error && (
            <p role="alert" className="mt-4 text-sm text-danger">
              {error === "missing"
                ? "Add a subject and a message."
                : "Something went wrong. Try again."}
            </p>
          )}

          <form action={createTicket} className="mt-6 space-y-4">
            <div>
              <label htmlFor="kind" className="eyebrow">
                Topic
              </label>
              <select
                id="kind"
                name="kind"
                defaultValue={preselected}
                className="mt-2 w-full rounded-lg border border-rule bg-paper px-4 py-3 text-sm text-ink outline-none focus:border-ink-faint transition-colors"
              >
                {kinds.map((k) => (
                  <option key={k.value} value={k.value}>
                    {k.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="subject" className="eyebrow">
                Subject
              </label>
              <input
                id="subject"
                name="subject"
                required
                maxLength={120}
                placeholder="Short summary"
                className="mt-2 w-full rounded-lg border border-rule bg-paper px-4 py-3 text-sm text-ink outline-none placeholder:text-ink-faint focus:border-ink-faint transition-colors"
              />
            </div>

            <div>
              <label htmlFor="body" className="eyebrow">
                Message
              </label>
              <textarea
                id="body"
                name="body"
                required
                rows={5}
                placeholder="What's going on?"
                className="mt-2 w-full resize-y rounded-lg border border-rule bg-paper px-4 py-3 text-sm text-ink outline-none placeholder:text-ink-faint focus:border-ink-faint transition-colors"
              />
            </div>

            <button
              type="submit"
              className="w-full rounded-full bg-ink px-6 py-3.5 text-xs font-semibold uppercase tracking-[0.2em] text-paper hover:opacity-90 transition-colors"
            >
              Start chat
            </button>
          </form>
        </div>
      </section>
    </div>
  );
}
