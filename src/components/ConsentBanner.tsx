"use client";

import { useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { setPersonalisationConsent } from "@/app/account/actions";
import { readConsent, writeConsent } from "@/lib/consent";

/** Cookies do not emit change events, and only this component writes it. */
const subscribe = () => () => {};

/**
 * Asks once, before anything is profiled.
 *
 * Whether to show it is browser state, read through useSyncExternalStore with
 * a server snapshot of false. That renders nothing on the server, decides on
 * the client from the cookie, and needs no effect to do it, so it never
 * flashes for someone who has already answered and never trips the
 * setState-in-an-effect rule.
 *
 * Portalled to <body> for the same reason the site menu is: the header has a
 * backdrop-filter, which makes it a containing block for fixed children.
 */
export default function ConsentBanner() {
  const [dismissed, setDismissed] = useState(false);
  const unasked = useSyncExternalStore(
    subscribe,
    () => readConsent() === "unasked",
    () => false,
  );
  const open = unasked && !dismissed;

  function decide(granted: boolean) {
    writeConsent(granted ? "granted" : "denied");
    setDismissed(true);
    // Fire and forget: the cookie has already taken effect, and a signed-out
    // visitor has no profile for this to write to.
    void setPersonalisationConsent(granted).catch(() => {});
  }

  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <div
      role="dialog"
      aria-modal="false"
      aria-labelledby="dd-consent-title"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-rule bg-paper px-5 py-5 shadow-[0_-8px_30px_rgba(0,0,0,0.08)] sm:px-8"
    >
      <div className="mx-auto flex max-w-7xl flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="max-w-2xl">
          <p id="dd-consent-title" className="eyebrow !text-ink">
            Personalised shopping
          </p>
          <p className="mt-2 text-sm leading-relaxed text-ink-dim">
            We use the products you view and search for, and the region your
            connection resolves to, to work out what to recommend you. It is tied
            to your account rather than this browser, so it follows you across
            devices. We never store your IP address.{" "}
            <Link href="/account" className="text-ink underline underline-offset-4">
              You can change this any time in your account.
            </Link>
          </p>
        </div>

        <div className="flex shrink-0 gap-3">
          <button
            type="button"
            onClick={() => decide(false)}
            className="rounded-full border border-rule-strong px-6 py-3 text-xs uppercase tracking-[0.18em] text-ink-dim transition-colors hover:border-ink hover:text-ink"
          >
            No thanks
          </button>
          <button
            type="button"
            onClick={() => decide(true)}
            className="rounded-full bg-ink px-6 py-3 text-xs font-semibold uppercase tracking-[0.18em] text-paper transition-opacity hover:opacity-90"
          >
            Allow
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
