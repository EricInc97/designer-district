import Link from "next/link";
import ProductImage from "@/components/ProductImage";
import type { Brand, ProductWithBrand } from "@/lib/types";

export type SetBand = {
  key: string;
  name: string;
  items: ProductWithBrand[];
};

/**
 * A co-ordinated set, merchandised as a collection.
 *
 * Same treatment as the lookbook band that already exists on this page: the
 * picture full width, a dark gradient drawn in from the left, and the words
 * stacked against that edge — a small line, the name, and a rule-underlined
 * way through. It is the layout the brand asked to be copied, and copying it
 * here is what makes a set read as a collection rather than as two products
 * that happen to match.
 *
 * Cover-cropped, unlike the campaign bands, and that is safe here precisely
 * because this is a flat-lay. A campaign photograph is a person head to
 * shoes and cropping one costs the head and the shoes; a garment shot on
 * white has nothing in the corners to lose, so it can fill a band of any
 * shape. Taken from the top half of the set, which is the half that carries
 * the graphic.
 */
export default function BrandSetBand({
  band,
  brand,
}: {
  band: SetBand;
  brand: Pick<Brand, "name" | "slug">;
}) {
  // The top half leads: it is the piece with the print on it. Falls back to
  // whatever the set has if a top is not the first thing stored.
  const lead =
    band.items.find((p) => p.image_url) ?? band.items[0];
  if (!lead) return null;

  return (
    <section
      className="relative w-full overflow-hidden bg-paper-sunken"
      aria-label={`${band.name}, a ${brand.name} set`}
    >
      <div className="relative min-h-[44vh] sm:min-h-[56vh]">
        <ProductImage
          src={lead.image_url}
          slug={lead.slug}
          alt=""
          className="absolute inset-0 h-full w-full object-cover"
        />

        {/* Drawn in from the left, so the words have a ground and the
            garment keeps the open half of the frame. */}
        <div
          aria-hidden
          className="absolute inset-0 bg-gradient-to-r from-black/75 via-black/35 to-transparent"
        />

        <div className="relative mx-auto flex min-h-[44vh] max-w-7xl flex-col justify-center px-5 sm:min-h-[56vh] sm:px-8">
          <div className="text-white">
            <p className="text-[11px] uppercase tracking-[0.22em] opacity-80">
              The Collection
            </p>
            <h2 className="display mt-3 max-w-2xl text-2xl leading-tight sm:text-4xl">
              {band.name}
            </h2>
            <p className="mt-2 text-xs uppercase tracking-[0.18em] opacity-70">
              {band.items.length} pieces, sold to be worn together
            </p>
            <Link
              href={`/brands/${brand.slug}?set=${encodeURIComponent(band.key)}`}
              className="mt-6 inline-block border-b border-white pb-1 text-xs font-semibold uppercase tracking-[0.2em] text-white transition-opacity hover:opacity-70"
            >
              View all
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
