"use client";

import { useState, useTransition } from "react";
import { Loader2 } from "lucide-react";
import { setPersonalisationConsent } from "@/app/account/actions";
import { writeConsent } from "@/lib/consent";

/**
 * The other half of the consent banner: the place a decision can be changed.
 *
 * It writes both the column and the cookie, because the tracker reads the
 * cookie and the profile reads the column. Turning it off is not a display
 * preference, so the copy says what actually happens: the trigger behind the
 * column deletes the buyer profile and detaches the behaviour behind it.
 */
export default function PersonalisationToggle({
  consent,
}: {
  consent: boolean | null;
}) {
  const [on, setOn] = useState(consent === true);
  const [pending, startTransition] = useTransition();

  function toggle(next: boolean) {
    setOn(next);
    writeConsent(next ? "granted" : "denied");
    startTransition(async () => {
      await setPersonalisationConsent(next);
    });
  }

  return (
    <section className="border-t border-rule pt-10">
      <h2 className="display text-xl">Personalised shopping</h2>

      <div className="mt-5 rounded-xl border border-rule bg-paper-raised p-5">
        <label className="flex cursor-pointer items-start gap-3.5">
          <input
            type="checkbox"
            checked={on}
            onChange={(e) => toggle(e.target.checked)}
            className="mt-0.5 h-4 w-4 accent-[var(--ink)]"
          />
          <span>
            <span className="text-sm">
              Use what I view and search to recommend products
              {pending && (
                <Loader2
                  size={12}
                  className="ml-2 inline animate-spin text-ink-faint"
                  aria-hidden
                />
              )}
            </span>
            <span className="mt-1.5 block text-xs leading-relaxed text-ink-faint">
              We build a picture of what you like from the products you open and
              the searches you run, along with the region your connection
              resolves to. It is tied to your account, not this browser, so it
              works across your devices. Your IP address is never stored.
            </span>
            <span className="mt-2 block text-xs leading-relaxed text-ink-faint">
              Turning this off deletes that picture and unlinks the history
              behind it from your account, so it cannot be rebuilt. You will
              still see recommendations, just generic ones.
            </span>
          </span>
        </label>
      </div>
    </section>
  );
}
