"use client";

import { useActionState } from "react";
import { Loader2 } from "lucide-react";
import { issueCredit, type AdminResult } from "@/app/admin/actions";
import { money } from "@/lib/format";

export default function IssueCreditForm({
  ticketId,
  suggested,
  currentBalance,
}: {
  ticketId: string;
  suggested: number;
  currentBalance: number;
}) {
  const [state, submit, busy] = useActionState<AdminResult, FormData>(
    issueCredit,
    null,
  );

  return (
    <form action={submit} className="space-y-3">
      <input type="hidden" name="ticket_id" value={ticketId} />

      <div>
        <label htmlFor="amount" className="eyebrow">
          Store credit
        </label>
        <p className="mt-1 text-xs text-ink-faint">
          Balance today: {money(currentBalance)}
        </p>
        <input
          id="amount"
          name="amount"
          type="number"
          step="0.01"
          min="0.01"
          defaultValue={suggested > 0 ? suggested.toFixed(2) : ""}
          placeholder="0.00"
          className="mt-2 w-full rounded-lg border border-rule bg-paper px-4 py-3 text-sm text-ink outline-none placeholder:text-ink-faint focus:border-ink-faint transition-colors"
        />
      </div>

      <div>
        <label htmlFor="note" className="eyebrow">
          Note
        </label>
        <input
          id="note"
          name="note"
          placeholder="Reason the customer will see"
          className="mt-2 w-full rounded-lg border border-rule bg-paper px-4 py-3 text-sm text-ink outline-none placeholder:text-ink-faint focus:border-ink-faint transition-colors"
        />
      </div>

      {state && (
        <p
          role="status"
          className={`text-sm ${state.ok ? "text-success" : "text-danger"}`}
        >
          {state.message}
        </p>
      )}

      <button
        type="submit"
        disabled={busy}
        className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-ink px-5 py-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-paper hover:opacity-90 disabled:opacity-60 transition-colors"
      >
        {busy && <Loader2 size={13} className="animate-spin" aria-hidden />}
        Issue credit &amp; resolve
      </button>

      <p className="text-[11px] leading-relaxed text-ink-faint">
        Issuing credit marks the ticket resolved and appears instantly in the
        customer&apos;s balance.
      </p>
    </form>
  );
}
