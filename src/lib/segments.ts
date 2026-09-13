/**
 * How a buyer segment is described to a human.
 *
 * The keys are what compute_buyer_profile() writes; the copy lives here rather
 * than in SQL so wording can change without a migration. `why` is the rule that
 * actually fired, kept next to the label so the dashboard can explain a
 * classification instead of just asserting one.
 */
export type SegmentKey =
  | "new"
  | "bargain"
  | "luxury"
  | "loyalist"
  | "specialist"
  | "explorer"
  | "regular";

export const SEGMENTS: Record<SegmentKey, { label: string; why: string }> = {
  new: {
    label: "Too early to say",
    why: "Fewer than 5 products viewed. Not enough to call.",
  },
  bargain: {
    label: "Bargain hunter",
    why: "35% or more of what they view is discounted.",
  },
  luxury: {
    label: "Top of the range",
    why: "Average viewed price sits in the catalog's top 10%.",
  },
  loyalist: {
    label: "Label loyalist",
    why: "55% or more of their views land on one house.",
  },
  specialist: {
    label: "Category specialist",
    why: "60% or more of their views land in one category.",
  },
  explorer: {
    label: "Explorer",
    why: "Five or more houses, with no single one above a third.",
  },
  regular: {
    label: "Regular",
    why: "Active, with no one signal strong enough to stand out.",
  },
};

export const segmentLabel = (key: string) =>
  SEGMENTS[key as SegmentKey]?.label ?? key;

export const segmentWhy = (key: string) => SEGMENTS[key as SegmentKey]?.why ?? "";

export const PRICE_BANDS: Record<string, string> = {
  unknown: "No signal",
  entry: "Entry",
  mid: "Mid",
  premium: "Premium",
  luxury: "Luxury",
};
