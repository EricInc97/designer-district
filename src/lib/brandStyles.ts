import type { CSSProperties } from "react";

/**
 * Per-brand presentation.
 *
 * `mark` is the resting wordmark: the brand name set in a face matching its own
 * typographic register, in the site's monochrome palette.
 *
 * `hover` is the treatment the tile reveals on hover, built entirely from CSS
 * gradients so nothing is copied from anyone. It evokes each house's signature
 * look (Bape's camo, Supreme's red box, Chrome Hearts' silver) rather than
 * reproducing their artwork.
 *
 * An SVG at public/brands/<slug>.svg, pointed at by the brand's logo_url, adds
 * an emblem above the wordmark. It is painted through a CSS mask, so it must be
 * a solid single-colour silhouette; see BrandMark.
 */

export type BrandStyle = {
  markClass: string;
  markStyle?: CSSProperties;
  /** Rendered text when it differs from the stored brand name. */
  label?: string;
  hover: {
    /** Applied to the tile behind the wordmark. */
    style: CSSProperties;
    /** Applied to the wordmark itself while hovered. */
    textStyle?: CSSProperties;
  };
};

// Bape 1st-camo tones, assembled from hard-stop radial gradients.
const camo: CSSProperties = {
  backgroundColor: "#7a8b5c",
  backgroundImage: [
    "radial-gradient(ellipse 38% 28% at 16% 20%, #2b2f22 62%, transparent 63%)",
    "radial-gradient(ellipse 30% 22% at 66% 14%, #b9be8f 62%, transparent 63%)",
    "radial-gradient(ellipse 34% 26% at 88% 52%, #4c5b3c 62%, transparent 63%)",
    "radial-gradient(ellipse 26% 20% at 38% 58%, #b9be8f 62%, transparent 63%)",
    "radial-gradient(ellipse 32% 24% at 10% 80%, #4c5b3c 62%, transparent 63%)",
    "radial-gradient(ellipse 28% 22% at 74% 88%, #2b2f22 62%, transparent 63%)",
    "radial-gradient(ellipse 22% 18% at 50% 34%, #4c5b3c 62%, transparent 63%)",
  ].join(", "),
};

// Gallery Dept's paint-studio floor: charcoal spatter over a cool grey ground.
const splatter: CSSProperties = {
  backgroundColor: "#dedbd4",
  backgroundImage: [
    "radial-gradient(ellipse 9% 6% at 18% 22%, #1a1a1a 70%, transparent 71%)",
    "radial-gradient(ellipse 5% 4% at 33% 12%, #1a1a1a 70%, transparent 71%)",
    "radial-gradient(ellipse 12% 8% at 72% 30%, #1a1a1a 70%, transparent 71%)",
    "radial-gradient(ellipse 4% 3% at 60% 38%, #1a1a1a 70%, transparent 71%)",
    "radial-gradient(ellipse 10% 7% at 26% 74%, #1a1a1a 70%, transparent 71%)",
    "radial-gradient(ellipse 6% 4% at 84% 71%, #1a1a1a 70%, transparent 71%)",
    "radial-gradient(ellipse 7% 5% at 50% 88%, #1a1a1a 70%, transparent 71%)",
    "radial-gradient(ellipse 4% 3% at 88% 88%, #1a1a1a 70%, transparent 71%)",
    "radial-gradient(ellipse 5% 4% at 8% 30%, #1a1a1a 70%, transparent 71%)",
  ].join(", "),
};

// Off-White's diagonal crosswalk stripe. The wordmark carries a white halo so
// it stays legible as it crosses both the dark and light bands.
const crosswalk: CSSProperties = {
  backgroundImage:
    "repeating-linear-gradient(45deg, #111111 0 14px, #f5f4f1 14px 28px)",
};

export const brandStyles: Record<string, BrandStyle> = {
  bape: {
    label: "BAPE",
    markClass: "font-[family-name:var(--font-geometric)] tracking-[0.04em]",
    hover: {
      style: camo,
      textStyle: { color: "#ffffff", textShadow: "0 2px 10px rgba(0,0,0,0.55)" },
    },
  },

  "chrome-hearts": {
    label: "Chrome Hearts",
    markClass: "font-[family-name:var(--font-blackletter)] tracking-[0.02em]",
    hover: {
      style: {
        backgroundImage:
          "linear-gradient(135deg, #d6d6dc 0%, #85858e 26%, #eeeef1 48%, #6c6c76 72%, #c9c9d0 100%)",
      },
      textStyle: { color: "#0a0a0a", textShadow: "0 1px 0 rgba(255,255,255,0.45)" },
    },
  },

  supreme: {
    label: "Supreme",
    markClass: "font-[family-name:var(--font-geometric)] tracking-[-0.02em]",
    markStyle: { transform: "skewX(-12deg)" },
    hover: {
      style: { backgroundColor: "#ce1f26" },
      textStyle: { color: "#ffffff" },
    },
  },

  // Bespoke condensed bold caps, tight spacing, no crest: pure typography,
  // the way the house reset it under Gvasalia.
  balenciaga: {
    label: "BALENCIAGA",
    markClass: "font-[family-name:var(--font-collegiate)] tracking-[-0.005em]",
    hover: {
      style: { backgroundColor: "#0a0a0a" },
      textStyle: { color: "#ffffff" },
    },
  },

  // Slender, elongated serif caps, widely set. Bone and sand are the house's
  // own ground; the lettering stays black on it.
  amiri: {
    label: "AMIRI",
    markClass: "font-[family-name:var(--font-didone)] font-normal tracking-[0.2em]",
    hover: {
      style: {
        backgroundImage: "linear-gradient(150deg, #f1ebdf 0%, #d5c9b2 100%)",
      },
      textStyle: { color: "#12100c" },
    },
  },

  // Hand-painted and distressed. The house is a paint studio first, so the
  // colourway is spattered rather than flat.
  "gallery-dept": {
    label: "GALLERY DEPT.",
    markClass: "font-[family-name:var(--font-marker)] tracking-[0.01em]",
    markStyle: { transform: "rotate(-1.5deg)" },
    hover: {
      style: splatter,
      textStyle: { color: "#101010" },
    },
  },

  // Gothic caps against a votive glow: the label's religious and angelic
  // motifs, without borrowing any of its artwork.
  godspeed: {
    label: "GODSPEED",
    markClass: "font-[family-name:var(--font-blackletter)] tracking-[0.08em]",
    hover: {
      style: {
        backgroundImage:
          "radial-gradient(circle at 50% 24%, #f7e2a6 0%, #c99a38 17%, #4a3a17 45%, #14110b 100%)",
      },
      textStyle: { color: "#fbf3de", textShadow: "0 2px 10px rgba(0,0,0,0.45)" },
    },
  },

  // Uppercase, widely letterspaced, medium weight. The wordmark itself is
  // black, not purple; the colour belongs to the brand, not the lettering.
  "purple-brand": {
    label: "PURPLE BRAND",
    markClass: "font-medium tracking-[0.26em]",
    hover: {
      style: { backgroundColor: "#4b2a7b" },
      textStyle: { color: "#ffffff" },
    },
  },

  // Helvetica bold caps inside quotation marks, as Abloh set it.
  "off-white": {
    label: '"OFF-WHITE"',
    markClass: "font-bold tracking-[-0.01em]",
    hover: {
      style: crosswalk,
      textStyle: {
        color: "#111111",
        textShadow:
          "0 0 6px #f5f4f1, 0 0 3px #f5f4f1, 0 0 2px #f5f4f1",
      },
    },
  },

  // High-contrast serif with heavy triangular serifs, set in black.
  casablanca: {
    label: "CASABLANCA",
    markClass: "font-[family-name:var(--font-didone)] tracking-[0.12em]",
    hover: {
      style: {
        backgroundImage:
          "linear-gradient(135deg, #7fbfb2 0%, #efd9b4 52%, #d98a63 100%)",
      },
      textStyle: { color: "#2b2018" },
    },
  },
};

export const fallbackStyle: BrandStyle = {
  markClass: "font-semibold tracking-[0.2em]",
  hover: {
    style: { backgroundColor: "#111111" },
    textStyle: { color: "#f5f4f1" },
  },
};

export const styleFor = (slug: string): BrandStyle =>
  brandStyles[slug] ?? fallbackStyle;

/** A real asset, as opposed to the generated /ph/ placeholder route. */
export const isRealAsset = (url: string | null | undefined) =>
  Boolean(url && !url.startsWith("/ph/"));
