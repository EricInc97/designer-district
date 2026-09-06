"use client";

import { useState } from "react";
import { Check, ShoppingBag } from "lucide-react";
import { useCart } from "@/store/cart";

export type AddToCartProduct = {
  id: string;
  name: string;
  price: number;
  image_url: string | null;
  stock_count: number;
  sizes: string[];
};

type Props = {
  product: AddToCartProduct;
  brandName: string | null;
  /** Detail page passes the chosen size; the grid card asks for one inline. */
  size?: string | null;
  variant?: "card" | "detail";
  className?: string;
};

export default function AddToCartButton({
  product,
  brandName,
  size,
  variant = "card",
  className = "",
}: Props) {
  const add = useCart((s) => s.add);
  const [picking, setPicking] = useState(false);
  const [added, setAdded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const soldOut = product.stock_count <= 0;
  const needsSize = product.sizes.length > 0;

  function commit(chosen: string | null) {
    add({
      productId: product.id,
      name: product.name,
      brandName,
      price: Number(product.price),
      imageUrl: product.image_url,
      size: chosen,
      stock: product.stock_count,
    });
    setPicking(false);
    setAdded(true);
    setTimeout(() => setAdded(false), 1600);
  }

  function onClick() {
    if (soldOut) return;

    if (variant === "detail") {
      if (needsSize && !size) {
        setError("Select a size first.");
        return;
      }
      setError(null);
      commit(size ?? null);
      return;
    }

    // Grid card: reveal the size row rather than guessing on the shopper's behalf.
    if (needsSize) setPicking((p) => !p);
    else commit(null);
  }

  if (soldOut) {
    return (
      <button
        type="button"
        disabled
        className={`w-full rounded-full border border-rule px-4 py-2.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-ink-faint ${className}`}
      >
        Sold out
      </button>
    );
  }

  const base =
    variant === "detail"
      ? "w-full rounded-full bg-ink px-6 py-4 text-xs font-semibold uppercase tracking-[0.2em] text-paper hover:opacity-90"
      : "w-full rounded-full border border-rule-strong px-4 py-2.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-ink hover:bg-ink hover:text-paper";

  return (
    <div className="w-full">
      {picking && (
        <div className="mb-2 flex flex-wrap gap-1.5 animate-fade-in">
          {product.sizes.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => commit(s)}
              className="min-w-9 rounded-md border border-rule-strong px-2 py-1.5 text-[11px] font-medium hover:bg-ink hover:text-paper transition-colors"
            >
              {s}
            </button>
          ))}
        </div>
      )}

      <button
        type="button"
        onClick={onClick}
        aria-expanded={variant === "card" && needsSize ? picking : undefined}
        className={`${base} inline-flex items-center justify-center gap-2 transition-colors ${className}`}
      >
        {added ? (
          <>
            <Check size={13} aria-hidden /> Added
          </>
        ) : picking ? (
          "Choose a size"
        ) : (
          <>
            {variant === "detail" && <ShoppingBag size={14} aria-hidden />}
            Add to cart
          </>
        )}
      </button>

      {error && (
        <p role="alert" className="mt-2 text-xs text-danger">
          {error}
        </p>
      )}
    </div>
  );
}
