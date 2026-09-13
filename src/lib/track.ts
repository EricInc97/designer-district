"use client";

import { SESSION_COOKIE } from "@/lib/constants";
import { readConsent } from "@/lib/consent";

/**
 * Client-side behaviour tracking. Every event carries the anonymous session id
 * minted in proxy.ts, so recommendations work before a visitor ever signs in
 * and carry over once they do.
 */
export function getSessionId(): string {
  if (typeof document === "undefined") return "";

  const match = document.cookie.match(
    new RegExp(`(?:^|; )${SESSION_COOKIE}=([^;]*)`),
  );
  if (match) return decodeURIComponent(match[1]);

  // Middleware is skipped for prefetched static assets; mint one client-side.
  const id = crypto.randomUUID();
  document.cookie = `${SESSION_COOKIE}=${id}; path=/; max-age=31536000; samesite=lax`;
  return id;
}

type TrackBody =
  | { type: "search"; query: string; resultCount: number }
  | { type: "view"; productId: string; source?: string };

function send(body: TrackBody) {
  // The banner is not decoration: a decline stops the event at the source,
  // before anything leaves the browser. The server checks again, because a
  // cookie is the client's word for it.
  if (readConsent() === "denied") return;

  const payload = JSON.stringify({ ...body, sessionId: getSessionId() });

  // keepalive so the event survives the navigation that usually follows it.
  void fetch("/api/track", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: payload,
    keepalive: true,
  }).catch(() => {
    /* tracking must never break the page */
  });
}

export const trackSearch = (query: string, resultCount: number) =>
  send({ type: "search", query, resultCount });

export const trackView = (productId: string, source = "direct") =>
  send({ type: "view", productId, source });
