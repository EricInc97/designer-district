import Link from "next/link";
import { money } from "@/lib/format";
import AddToCartButton from "@/components/AddToCartButton";
import type { ProductWithBrand } from "@/lib/types";

type Props = {
  product: ProductWithBrand;
  /** Falls back to the joined brand when the caller already knows it. */
  brandName?: string | null;
  showBrand?: boolean;
};

export default function ProductCard({ product, brandName, showBrand = true }: Props) {
  const brand = brandName ?? product.brands?.name ?? null;
  const onSale =
    product.compare_at_price != null &&
    Number(product.compare_at_price) > Number(product.price);
  const low = product.stock_count > 0 && product.stock_count <= 3;

  return (
    <article className="group flex flex-col">
      <Link
        href={`/products/${product.id}`}
        className="relative block overflow-hidden rounded-lg bg-paper-sunken"
      >
        <div className="aspect-[4/5] overflow-hidden">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={product.image_url ?? `/ph/${product.slug ?? "product"}`}
            alt={product.name}
            loading="lazy"
            className="h-full w-full object-cover transition-transform duration-500 ease-out group-hover:scale-[1.04]"
          />
        </div>

        {(onSale || low) && (
          <span className="absolute left-3 top-3 rounded-full bg-ink px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest text-paper">
            {onSale ? "Sale" : `${product.stock_count} left`}
          </span>
        )}

        {/* Hairline that draws itself on hover, the only motion on the grid. */}
        <span className="pointer-events-none absolute inset-0 rounded-lg ring-1 ring-inset ring-transparent transition-colors duration-300 group-hover:ring-rule-strong" />
      </Link>

      <div className="mt-3.5 flex flex-1 flex-col">
        {showBrand && brand && (
          <p className="text-[11px] uppercase tracking-[0.18em] text-ink-faint">
            {brand}
          </p>
        )}

        <h3 className="mt-1 text-sm leading-snug">
          <Link href={`/products/${product.id}`} className="hover:underline underline-offset-4">
            {product.name}
          </Link>
        </h3>

        <p className="mt-1.5 flex items-baseline gap-2 text-sm tabular-nums">
          <span>{money(product.price)}</span>
          {onSale && (
            <span className="text-xs text-ink-faint line-through">
              {money(product.compare_at_price)}
            </span>
          )}
        </p>

        <div className="mt-3.5 pt-0.5">
          <AddToCartButton
            product={{
              id: product.id,
              name: product.name,
              price: Number(product.price),
              image_url: product.image_url,
              stock_count: product.stock_count,
              sizes: product.sizes ?? [],
            }}
            brandName={brand}
          />
        </div>
      </div>
    </article>
  );
}
