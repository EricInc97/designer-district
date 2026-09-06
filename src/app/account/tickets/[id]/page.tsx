import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { closeTicket } from "@/app/account/actions";
import TicketChat from "@/components/TicketChat";
import { StatusPill } from "@/components/TicketStatusPill";
import { money, dateShort, titleCase } from "@/lib/format";
import type { Ticket, TicketMessage } from "@/lib/types";

export const metadata: Metadata = { title: "Ticket" };

type Props = { params: Promise<{ id: string }> };

export default async function TicketDetailPage({ params }: Props) {
  const { id } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: ticket } = await supabase
    .from("tickets")
    .select("*")
    .eq("id", id)
    .single<Ticket>();

  // RLS already scopes this to the signed-in customer; a miss means 404.
  if (!ticket) notFound();

  const { data: messages } = await supabase
    .from("ticket_messages")
    .select("*")
    .eq("ticket_id", id)
    .order("created_at", { ascending: true });

  const closed = ticket.status === "closed";

  return (
    <div className="mx-auto max-w-3xl">
      <Link
        href="/account/tickets"
        className="text-xs uppercase tracking-[0.18em] text-ink-faint hover:text-ink transition-colors"
      >
        ← All tickets
      </Link>

      <header className="mt-5 flex flex-wrap items-start justify-between gap-4 border-b border-rule pb-6">
        <div className="min-w-0">
          <h1 className="display text-2xl">{ticket.subject}</h1>
          <p className="mt-2 text-xs text-ink-faint">
            <span className="font-mono">{ticket.ticket_number}</span> ·{" "}
            {titleCase(ticket.kind)} · opened {dateShort(ticket.created_at)}
          </p>
          {ticket.credit_issued > 0 && (
            <p className="mt-2 text-sm text-success">
              {money(ticket.credit_issued)} store credit issued on this ticket.
            </p>
          )}
        </div>

        <div className="flex items-center gap-3">
          <StatusPill status={ticket.status} />
          {!closed && (
            <form action={closeTicket}>
              <input type="hidden" name="ticket_id" value={ticket.id} />
              <button
                type="submit"
                className="rounded-full border border-rule-strong px-4 py-1.5 text-[10px] uppercase tracking-[0.18em] text-ink-dim hover:text-ink hover:border-ink transition-colors"
              >
                Close
              </button>
            </form>
          )}
        </div>
      </header>

      <div className="mt-6">
        <TicketChat
          ticketId={ticket.id}
          currentUserId={user!.id}
          asStaff={false}
          initialMessages={(messages ?? []) as TicketMessage[]}
          locked={closed}
        />
      </div>
    </div>
  );
}
