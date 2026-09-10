"use client";

import { useState } from "react";

/**
 * A product photograph that degrades to the generated placeholder instead of
 * to a browser's broken-image icon.
 *
 * Storage and the database can disagree: a file can go missing while a row
 * still points at it, and the row is what the page renders. Left alone that
 * shows as a torn-page icon with the alt text spilling across the tile, which
 * is worse than no photograph at all.
 */
export default function ProductImage({
  src,
  alt,
  slug,
  className = "",
}: {
  src: string | null | undefined;
  alt: string;
  /** Used to build the deterministic placeholder. */
  slug?: string | null;
  className?: string;
}) {
  const placeholder = `/ph/${slug || "product"}`;
  const [failed, setFailed] = useState(false);
  const url = !src || failed ? placeholder : src;

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={url}
      alt={alt}
      loading="lazy"
      onError={() => setFailed(true)}
      className={className}
    />
  );
}
