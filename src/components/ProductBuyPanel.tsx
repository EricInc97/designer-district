"use client";

import { useState } from "react";
import AddToCartButton, { type AddToCartProduct } from "@/components/AddToCartButton";

export default function ProductBuyPanel({
  product,
  brandName,
}: {
  product: AddToCartProduct;
  brandName: string | null;
}) {
  const [size, setSize] = useState<string | null>(null);
  const sizes = product.sizes ?? [];
  const soldOut = product.stock_count <= 0;

  return (
    <div className="space-y-6">
      {sizes.length > 0 && (
        <fieldset disabled={soldOut}>
          <legend className="flex w-full items-baseline justify-between">
            <span className="eyebrow">Size</span>
            {size && (
              <span className="text-xs text-ink-faint">Selected: {size}</span>
            )}
          </legend>

          <div className="mt-3 flex flex-wrap gap-2">
            {sizes.map((s) => {
              const selected = size === s;
              return (
                <button
                  key={s}
                  type="button"
                  onClick={() => setSize(selected ? null : s)}
                  aria-pressed={selected}
                  className={`min-w-[3.25rem] rounded-md border px-4 py-3 text-sm font-medium transition-colors disabled:opacity-40 ${
                    selected
                      ? "border-ink bg-ink text-paper"
                      : "border-rule-strong text-ink hover:border-ink"
                  }`}
                >
                  {s}
                </button>
              );
            })}
          </div>
        </fieldset>
      )}

      <AddToCartButton
        product={product}
        brandName={brandName}
        size={size}
        variant="detail"
      />
    </div>
  );
}
