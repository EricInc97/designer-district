"use client";

import { useEffect, useState } from "react";

export const SPLASH_KEY = "dd-splash";

/**
 * First-visit splash: the full lockup breathing on the ink ground, then it
 * fades and hands over to the site.
 *
 * Shown once per tab session. Returning visitors never see it because the
 * inline script in layout.tsx stamps data-splash="skip" on <html> before this
 * markup paints, so there is no flash to hide and no hydration mismatch to
 * reconcile: every state change below happens inside a timer, never in the
 * effect body.
 */
export default function Splash() {
  const [state, setState] = useState<"in" | "out" | "done">("in");

  useEffect(() => {
    try {
      sessionStorage.setItem(SPLASH_KEY, "1");
    } catch {
      // Private mode. The splash simply shows every visit.
    }

    const hold = window.matchMedia("(prefers-reduced-motion: reduce)").matches
      ? 400
      : 1300;

    const leave = setTimeout(() => setState("out"), hold);
    const remove = setTimeout(() => setState("done"), hold + 550);

    return () => {
      clearTimeout(leave);
      clearTimeout(remove);
    };
  }, []);

  if (state === "done") return null;

  return (
    <div id="dd-splash" data-state={state} role="presentation">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/brand/designer-district.png"
        alt=""
        width={800}
        height={618}
        fetchPriority="high"
      />
    </div>
  );
}
