import Link from "next/link";
import ProductCard from "@/components/ProductCard";
import type { BrandMedia, ProductWithBrand } from "@/lib/types";

/**
 * The campaign artwork, on a product page.
 *
 * Forty-four of these were generated for the hoardings in the 3D street and
 * then only ever shown there. They are the only pictures in the catalog with
 * a person in them — every product photograph is a flat-lay or a cut-out —
 * so they answer the one question a flat-lay cannot, which is what the thing
 * looks like worn.
 *
 * Two quite different claims, and the difference matters enough to be a prop
 * rather than a guess:
 *
 *   `worn`   this garment is in this picture. The campaign generator recorded
 *            what it dressed the models in, so this is a fact, not a hunch,
 *            and the picture can be captioned as such and the rest of the
 *            outfit offered alongside it.
 *
 *   false    the house has campaign work but this piece is not in any of it.
 *            Then it is the house's campaign and is labelled as the house's
 *            campaign. Captioning a shot "seen here" when the garment is not
 *            in it is the kind of small lie that costs a return.
 *
 * Only a third of the catalog is in a picture, so the second case is the
 * common one and has to look deliberate rather than like a near-miss.
 */

/** The shape the picture was generated at, as a CSS ratio. */
function ratio(aspect: string | null): string {
  if (!aspect) return "4 / 5";
  const [w, h] = aspect.split(":");
  return w && h ? `${w} / ${h}` : "4 / 5";
}

export default function ProductCampaign({
  media,
  worn,
  ownCopy,
  companions,
  brandName,
  brandSlug,
}: {
  media: BrandMedia;
  worn: boolean;
  /** Whether this board's headline is about this product's house. */
  ownCopy: boolean;
  companions: ProductWithBrand[];
  brandName: string | null;
  brandSlug: string | null;
}) {
  // The boards cut for the crown screen are 21:9 cinema strips; the ones cut
  // for the tower screens are 2:3 and 9:16. A strip wants the full width with
  // the look underneath it, a tall one wants to sit beside the look. Reading
  // it off the stored aspect rather than measuring means neither gets cropped
  // into the other's shape.
  const wide = media.aspect === "21:9";
  const showLook = worn && companions.length > 0;

  const picture = (
    <div
      className="overflow-hidden rounded-lg bg-paper-sunken"
      style={{ aspectRatio: ratio(media.aspect) }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={media.image_url}
        alt={
          worn
            ? `${brandName ?? "The house"} campaign photograph featuring this piece`
            : `${brandName ?? "The house"} campaign photograph`
        }
        loading="lazy"
        className="h-full w-full object-cover"
      />
    </div>
  );

  return (
    <section className="mt-24 border-t border-rule pt-12">
      <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2">
        <h2 className="eyebrow">
          {worn ? "Seen in the campaign" : `The ${brandName ?? "house"} campaign`}
        </h2>
        {brandSlug && (
          <Link
            href={`/brands/${brandSlug}`}
            className="text-[11px] uppercase tracking-[0.18em] text-ink-faint transition-colors hover:text-ink"
          >
            All {brandName} &rarr;
          </Link>
        )}
      </div>

      {/*
        The headline is signage: it was written for a specific hoarding in the
        street, in that house's voice. It only travels to a product page when
        it is about this house — a collaboration title like "Chrome Hearts x
        Purple Brand" says something true about a Purple Brand jean, while the
        district's own crown advert, "Everything, in one place / Fifteen
        districts, one address", is a perfectly good line about the district
        and a non-sequitur underneath a pair of jeans. When it does not
        travel, the photograph goes up without a caption rather than with
        somebody else's.
      */}
      {ownCopy && media.headline && (
        <p className="display mt-3 text-xl leading-tight sm:text-2xl">
          {media.headline}
        </p>
      )}
      {ownCopy && media.subhead && (
        <p className="mt-2 max-w-xl text-sm leading-relaxed text-ink-dim">
          {media.subhead}
        </p>
      )}

      {wide || !showLook ? (
        <>
          <div className="mt-7">{picture}</div>
          {showLook && (
            <>
              <h3 className="eyebrow mt-10">The rest of the look</h3>
              <div className="mt-5 grid grid-cols-2 gap-x-5 gap-y-10 sm:grid-cols-3 lg:grid-cols-4">
                {companions.map((p) => (
                  <ProductCard key={p.id} product={p} />
                ))}
              </div>
            </>
          )}
        </>
      ) : (
        <div className="mt-7 grid gap-8 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-12">
          {picture}
          <div>
            <h3 className="eyebrow">The rest of the look</h3>
            <div className="mt-5 grid grid-cols-2 gap-x-5 gap-y-10 sm:grid-cols-3">
              {companions.map((p) => (
                <ProductCard key={p.id} product={p} />
              ))}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
