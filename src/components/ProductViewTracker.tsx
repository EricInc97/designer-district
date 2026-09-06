"use client";

import { useEffect } from "react";
import { trackView } from "@/lib/track";

/** Fires one view event per product mount. Renders nothing. */
export default function ProductViewTracker({
  productId,
  source = "direct",
}: {
  productId: string;
  source?: string;
}) {
  useEffect(() => {
    trackView(productId, source);
  }, [productId, source]);

  return null;
}
