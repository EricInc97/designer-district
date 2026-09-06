import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { requireStaff } from "@/lib/auth";
import { updateTicket } from "@/app/admin/actions";
import TicketChat from "@/components/TicketChat";
import IssueCreditForm from "@/components/IssueCreditForm";
import { StatusPill } from "@/components/TicketStatusPill";
import { money, dateShort, titleCase } from "@/lib/format";
import type { Ticket, TicketMessage, Profile, OrderWithItems } from "@/lib/types";

export const metadata: Metadata = { title: "Ticket" };

type Props = { params: Promise<{ id: string }> };

const statuses = ["open", "pending_customer", "resolved", "closed"] as const;
const priorities = ["low", "normal", "high", "urgent"] as const;

export default async function AdminTicketDetailPage({ params }: Props) {
  const staff = await requireStaff();
  if (!staff.can("tickets.view")) redirect("/admin");

  const { id } = await params;
  const supabase = await createClient();

  const { data: ticket } = await supabase
    .from("tickets")
    .select("*")
    .eq("id", id)
    .single<Ticket>();

  if (!ticket) notFound();

  const [{ data: messages }, { data: customer }, { data: order }] = await Promise.all([
    supabase
      .from("ticket_messages")
      .select("*")
      .eq("ticket_id", id)
      .order("created_at", { ascending: true }),
    staff.can("customers.view")
      ? supabase.from("profiles").select("*").eq("id", ticket.user_id).single<Profile>()
      : Promise.resolve({ data: null }),
    ticket.order_id
      ? supabase
          .from("orders")
          .select("*, order_items(*)")
          .eq("id", ticket.order_id)
          .single<OrderWithItems>()
      : Promise.resolve({ data: null }),
  ]);

  // Pre-fill the refund box with the value of the specific item complained about,
  // falling back to the order total.
  const item = order?.order_items.find((i) => i.id === ticket.order_item_id);
  const suggested = item
    ? Number(item.unit_price) * item.quantity
    : Number(order?.total ?? 0);

  const closed = ticket.status === "closed";

  return (
    <div className="space-y-6">
      <Link
        href="/admin/tickets"
        className="text-xs uppercase tracking-[0.18em] text-ink-faint hover:text-ink transition-colors"
      >
        ← Support queue
      </Link>

      <header className="flex flex-wrap items-start justify-between gap-4 border-b border-rule pb-6">
        <div className="min-w-0">
          <h2 className="display text-2xl">{ticket.subject}</h2>
          <p className="mt-2 text-xs text-ink-faint">
            <span className="font-mono">{ticket.ticket_number}</span> ·{" "}
            {titleCase(ticket.kind)} · opened {dateShort(ticket.created_at)}
            {customer && ` · ${customer.full_name || customer.email}`}
          </p>
        </div>
        <StatusPill status={ticket.status} />
      </header>

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        {/* ---------------- CHAT ---------------- */}
        <div>
          <TicketChat
            ticketId={ticket.id}
            currentUserId={staff.userId}
            asStaff
            initialMessages={(messages ?? []) as TicketMessage[]}
            locked={closed || !staff.can("tickets.reply")}
          />
          {!staff.can("tickets.reply") && !closed && (
            <p className="mt-3 text-xs text-ink-faint">
              You can read this thread but not reply. That needs the{" "}
              <code className="font-mono">tickets.reply</code> scope.
            </p>
          )}
        </div>

        {/* ---------------- CONTROLS ---------------- */}
        <aside className="space-y-5">
          {staff.can("tickets.manage") && (
            <section className="rounded-xl border border-rule bg-paper-raised p-5">
              <h3 className="eyebrow">Triage</h3>

              <form action={updateTicket} className="mt-4 space-y-3">
                <input type="hidden" name="ticket_id" value={ticket.id} />

                <div>
                  <label htmlFor="status" className="text-xs text-ink-faint">
                    Status
                  </label>
                  <select
                    id="status"
                    name="status"
                    defaultValue={ticket.status}
                    className="mt-1.5 w-full rounded-lg border border-rule bg-paper px-3.5 py-2.5 text-sm outline-none focus:border-ink-faint transition-colors"
                  >
                    {statuses.map((s) => (
                      <option key={s} value={s}>
                        {titleCase(s)}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label htmlFor="priority" className="text-xs text-ink-faint">
                    Priority
                  </label>
                  <select
                    id="priority"
                    name="priority"
                    defaultValue={ticket.priority}
                    className="mt-1.5 w-full rounded-lg border border-rule bg-paper px-3.5 py-2.5 text-sm outline-none focus:border-ink-faint transition-colors"
                  >
                    {priorities.map((p) => (
                      <option key={p} value={p}>
                        {titleCase(p)}
                      </option>
                    ))}
                  </select>
                </div>

                <label className="flex items-center gap-2.5 text-sm">
                  <input
                    type="checkbox"
                    name="assign_to_me"
                    value="true"
                    defaultChecked={ticket.assigned_to === staff.userId}
                    className="h-4 w-4 accent-[var(--ink)]"
                  />
                  Assign to me
                </label>

                <button
                  type="submit"
                  className="w-full rounded-full border border-rule-strong px-5 py-2.5 text-[11px] uppercase tracking-[0.18em] hover:bg-ink hover:text-paper transition-colors"
                >
                  Update ticket
                </button>
              </form>
            </section>
          )}

          {staff.can("tickets.refund") && (
            <section className="rounded-xl border border-rule bg-paper-raised p-5">
              <h3 className="eyebrow">Refund</h3>
              <div className="mt-4">
                <IssueCreditForm
                  ticketId={ticket.id}
                  suggested={suggested}
                  currentBalance={Number(customer?.store_credit ?? 0)}
                />
              </div>
              {ticket.credit_issued > 0 && (
                <p className="mt-4 border-t border-rule pt-4 text-xs text-success">
                  {money(ticket.credit_issued)} already issued on this ticket.
                </p>
              )}
            </section>
          )}

          {order && (
            <section className="rounded-xl border border-rule bg-paper-raised p-5">
              <h3 className="eyebrow">Linked order</h3>
              <p className="mt-3 font-mono text-sm">{order.order_number}</p>
              <p className="mt-1 text-xs text-ink-faint">
                {dateShort(order.placed_at)} · {money(order.total)} ·{" "}
                {titleCase(order.status)}
              </p>

              <ul className="mt-4 space-y-3">
                {order.order_items.map((line) => (
                  <li
                    key={line.id}
                    className={`flex gap-3 rounded-lg p-2 ${
                      line.id === ticket.order_item_id ? "bg-paper-sunken" : ""
                    }`}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={line.image_url ?? "/ph/product"}
                      alt=""
                      className="h-12 w-10 shrink-0 rounded object-cover bg-paper-sunken"
                    />
                    <span className="min-w-0">
                      <span className="block truncate text-xs">{line.product_name}</span>
                      <span className="block text-[11px] text-ink-faint">
                        {line.size && `${line.size} · `}×{line.quantity} ·{" "}
                        {money(line.unit_price)}
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {customer && (
            <section className="rounded-xl border border-rule bg-paper-raised p-5">
              <h3 className="eyebrow">Customer</h3>
              <p className="mt-3 text-sm">{customer.full_name || "Not provided"}</p>
              <p className="mt-1 text-xs text-ink-faint">{customer.email}</p>
              {customer.phone && (
                <p className="text-xs text-ink-faint">{customer.phone}</p>
              )}
              {customer.address_line1 && (
                <p className="mt-3 text-xs leading-relaxed text-ink-faint">
                  {customer.address_line1}
                  {customer.address_line2 && <>, {customer.address_line2}</>}
                  <br />
                  {customer.city}, {customer.state} {customer.postal_code}
                </p>
              )}
              <p className="mt-3 border-t border-rule pt-3 text-xs text-ink-dim">
                Store credit: {money(customer.store_credit)}
              </p>
            </section>
          )}
        </aside>
      </div>
    </div>
  );
}
