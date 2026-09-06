"use client";

import { useEffect } from "react";
import { trackSearch } from "@/lib/track";

/** Logs searches that arrive by URL (shared link, back button) rather than typing. */
export default function SearchTracker({
  query,
  resultCount,
}: {
  query: string;
  resultCount: number;
}) {
  useEffect(() => {
    if (query.trim().length >= 2) trackSearch(query, resultCount);
  }, [query, resultCount]);

  return null;
}
