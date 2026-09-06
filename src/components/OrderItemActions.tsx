"use client";

import { useState } from "react";
import { RotateCcw, BadgeDollarSign, MessageSquareWarning } from "lucide-react";
import { createTicket } from "@/app/account/actions";
import type { TicketKind } from "@/lib/types";

type Props = {
  orderId: string;
  orderItemId: string;
  orderNumber: string;
  productName: string;
};

const options: { kind: TicketKind; label: string; icon: typeof RotateCcw; prompt: string }[] = [
  {
    kind: "return",
    label: "Return",
    icon: RotateCcw,
    prompt: "Tell us why you're returning it and the condition it's in.",
  },
  {
    kind: "refund",
    label: "Refund",
    icon: BadgeDollarSign,
    prompt: "Tell us what went wrong. Approved refunds are issued as store credit.",
  },
  {
    kind: "complaint",
    label: "Complain",
    icon: MessageSquareWarning,
    prompt: "Tell us what happened. A human reads every one of these.",
  },
];

export default function OrderItemActions({
  orderId,
  orderItemId,
  orderNumber,
  productName,
}: Props) {
  const [open, setOpen] = useState<TicketKind | null>(null);
  const active = options.find((o) => o.kind === open);

  return (
    <div className="mt-3">
      <div className="flex flex-wrap gap-2">
        {options.map(({ kind, label, icon: Icon }) => (
          <button
            key={kind}
            type="button"
            onClick={() => setOpen(open === kind ? null : kind)}
            aria-expanded={open === kind}
            className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[11px] uppercase tracking-[0.14em] transition-colors ${
              open === kind
                ? "border-ink bg-ink text-paper"
                : "border-rule-strong text-ink-dim hover:text-ink hover:border-ink"
            }`}
          >
            <Icon size={12} aria-hidden />
            {label}
          </button>
        ))}
      </div>

      {active && (
        <form
          action={createTicket}
          className="mt-3 space-y-3 rounded-lg border border-rule bg-paper-sunken p-4 animate-fade-in"
        >
          <input type="hidden" name="kind" value={active.kind} />
          <input type="hidden" name="order_id" value={orderId} />
          <input type="hidden" name="order_item_id" value={orderItemId} />
          <input
            type="hidden"
            name="subject"
            value={`${active.label}: ${productName} (${orderNumber})`}
          />

          <label htmlFor={`body-${orderItemId}-${active.kind}`} className="eyebrow">
            {active.label} request
          </label>
          <p className="text-xs text-ink-faint">{active.prompt}</p>

          <textarea
            id={`body-${orderItemId}-${active.kind}`}
            name="body"
            required
            rows={3}
            placeholder="Add the details…"
            className="w-full resize-y rounded-lg border border-rule bg-paper-raised px-3.5 py-3 text-sm text-ink outline-none placeholder:text-ink-faint focus:border-ink-faint transition-colors"
          />

          <div className="flex gap-2">
            <button
              type="submit"
              className="rounded-full bg-ink px-5 py-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-paper hover:opacity-90 transition-colors"
            >
              Open ticket
            </button>
            <button
              type="button"
              onClick={() => setOpen(null)}
              className="rounded-full border border-rule-strong px-5 py-2 text-[11px] uppercase tracking-[0.18em] text-ink-dim hover:text-ink transition-colors"
            >
              Cancel
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
