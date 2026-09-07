import type { SVGProps } from "react";

/**
 * Full brand lockups, drawn here as inline SVG.
 *
 * These are the houses whose mark is a composition rather than a wordmark: an
 * arch of type around a figure, a horseshoe with a banner. Inline rather than a
 * file at public/brands, for two reasons:
 *
 *  - the arched type is real <text> on a <textPath>, so it needs the page's own
 *    webfonts. An SVG loaded through <img> or mask-image renders in a
 *    restricted mode where those never arrive and the type silently falls back;
 *  - `fill="currentColor"` inherits the tile's ink, so the whole lockup flips
 *    to the house colourway on hover with no mask trickery.
 *
 * A brand with a lockup renders it alone, at full tile size: the name is
 * already inside the artwork, so BrandMark does not repeat it underneath.
 *
 * These are drawn approximations, not the houses' own artwork. A licensed file
 * still wins: set the brand's logo_url and BrandMark uses that instead.
 *
 * The <defs> ids are per-brand constants. Several copies of one emblem render
 * on a page (the tile's rest and hover layers, the menu row) and each defines
 * the same path under the same id, so a duplicate resolves to identical
 * geometry.
 */

type EmblemProps = SVGProps<SVGSVGElement>;

/** A Bathing Ape: the arch, the head, the word. */
function BapeLockup(props: EmblemProps) {
  return (
    <svg
      viewBox="0 0 220 226"
      fill="currentColor"
      xmlns="http://www.w3.org/2000/svg"
      {...props}
    >
      <defs>
        {/* Arc the top line rides, apex at the top of the box. */}
        <path id="dd-bape-arc" d="M23 155 A92 92 0 1 1 197 155" fill="none" />
      </defs>

      <text
        fontFamily="var(--font-collegiate)"
        fontSize="31"
        letterSpacing="4"
        textAnchor="middle"
      >
        <textPath href="#dd-bape-arc" startOffset="50%">
          A BATHING APE
        </textPath>
      </text>

      {/* Head: the shaggy outline with the crest and the face plate knocked
          out of it, and the features painted back into the gap. */}
      <path
        fillRule="evenodd"
        transform="translate(110 116)"
        d="M0 -70 C14 -70 26 -68 36 -63 C44 -70 54 -66 58 -58 C66 -52 72 -40 74 -26 C80 -20 80 -8 76 0 C78 18 70 36 56 48 C40 62 20 70 0 70 C-20 70 -40 62 -56 48 C-70 36 -78 18 -76 0 C-80 -8 -80 -20 -74 -26 C-72 -40 -66 -52 -58 -58 C-54 -66 -44 -70 -36 -63 C-26 -68 -14 -70 0 -70 Z
           M-54 -34 C-52 -48 -40 -58 -24 -60 C-14 -61 -6 -59 0 -55 C-8 -55 -18 -53 -27 -48 C-38 -42 -46 -34 -49 -25 C-53 -26 -55 -30 -54 -34 Z
           M0 -30 C26 -30 42 -16 42 4 C42 20 33 33 21 43 C13 50 7 52 0 52 C-7 52 -13 50 -21 43 C-33 33 -42 20 -42 4 C-42 -16 -26 -30 0 -30 Z"
      />
      <g transform="translate(110 116)">
        <ellipse cx="-19" cy="-8" rx="7.5" ry="10" />
        <ellipse cx="19" cy="-8" rx="7.5" ry="10" />
        <path d="M-8 13 C-4 8 4 8 8 13 C6 20 -6 20 -8 13 Z" />
        <path d="M-13 30 Q0 37 13 30 Q0 40 -13 30 Z" />
      </g>

      <text
        x="110"
        y="218"
        fontFamily="var(--font-collegiate)"
        fontSize="36"
        letterSpacing="4"
        textAnchor="middle"
      >
        APE
      </text>
    </svg>
  );
}

/** Chrome Hearts: blackletter around the horseshoe, cross inside, banner under. */
function ChromeHeartsLockup(props: EmblemProps) {
  const arm =
    "M-9 -11 C-9 -24 -16 -26 -16 -31 C-16 -35 -8 -38 0 -38 C8 -38 16 -35 16 -31 C16 -26 9 -24 9 -11 Z";

  return (
    <svg
      viewBox="0 0 220 218"
      fill="currentColor"
      xmlns="http://www.w3.org/2000/svg"
      {...props}
    >
      <defs>
        <path id="dd-ch-arc" d="M42.5 139 A78 78 0 1 1 177.5 139" fill="none" />
      </defs>

      <text
        fontFamily="var(--font-blackletter)"
        fontSize="30"
        letterSpacing="2"
        textAnchor="middle"
      >
        <textPath href="#dd-ch-arc" startOffset="50%">
          CHROME HEARTS
        </textPath>
      </text>

      {/* Horseshoe: a band open at the bottom, with a knob on each tip. */}
      <path d="M143.9 160.1 A66 66 0 1 0 76.1 160.1 L88.5 138.5 A41 41 0 1 1 131.5 138.5 Z" />
      <circle cx="82" cy="156" r="9" />
      <circle cx="138" cy="156" r="9" />

      {/* The floral cross, centred in the horseshoe. */}
      <g transform="translate(110 100)">
        <path d="M0 -27 L5.5 -21.5 L0 -16 L-5.5 -21.5 Z" transform="rotate(45)" />
        <path d="M0 -27 L5.5 -21.5 L0 -16 L-5.5 -21.5 Z" transform="rotate(135)" />
        <path d="M0 -27 L5.5 -21.5 L0 -16 L-5.5 -21.5 Z" transform="rotate(225)" />
        <path d="M0 -27 L5.5 -21.5 L0 -16 L-5.5 -21.5 Z" transform="rotate(315)" />
        <circle r="13" />
        <path d={arm} />
        <path d={arm} transform="rotate(90)" />
        <path d={arm} transform="rotate(180)" />
        <path d={arm} transform="rotate(270)" />
      </g>

      {/* Banner scroll. */}
      <path
        fillRule="evenodd"
        d="M24 178 L110 172 L196 178 L196 208 L110 214 L24 208 Z
           M32 185 L110 180 L188 185 L188 201 L110 206 L32 201 Z"
      />
      <text
        x="110"
        y="199"
        fontFamily="var(--font-blackletter)"
        fontSize="17"
        letterSpacing="1"
        textAnchor="middle"
      >
        CHROME HEARTS
      </text>
    </svg>
  );
}

const withLockup = new Set(["bape", "chrome-hearts"]);

/** Whether this house's mark is a lockup rather than a wordmark. */
export const hasEmblem = (slug: string) => withLockup.has(slug);

/**
 * Dispatches on the slug rather than handing back a component, so nothing
 * looks like a component being created during a render.
 */
export function BrandEmblem({
  slug,
  className,
}: {
  slug: string;
  className?: string;
}) {
  switch (slug) {
    case "bape":
      return <BapeLockup className={className} />;
    case "chrome-hearts":
      return <ChromeHeartsLockup className={className} />;
    default:
      return null;
  }
}
