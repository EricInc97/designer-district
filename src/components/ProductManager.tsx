"use client";

import { useActionState, useState } from "react";
import { Loader2, Pencil, Plus, Trash2, X } from "lucide-react";
import {
  saveProduct,
  togglePublished,
  deleteProduct,
  type AdminResult,
} from "@/app/admin/actions";
import { money } from "@/lib/format";
import type { Brand, Category, Product } from "@/lib/types";

type Props = {
  products: Product[];
  brands: Brand[];
  categories: Category[];
  can: { manage: boolean; publish: boolean; remove: boolean };
};

const inputClass =
  "mt-2 w-full rounded-lg border border-rule bg-paper px-4 py-3 text-sm text-ink outline-none placeholder:text-ink-faint focus:border-ink-faint transition-colors";

export default function ProductManager({ products, brands, categories, can }: Props) {
  const [editing, setEditing] = useState<Product | null>(null);
  const [creating, setCreating] = useState(false);
  const [state, submit, saving] = useActionState<AdminResult, FormData>(
    saveProduct,
    null,
  );

  const draft = editing ?? null;
  const formOpen = creating || editing !== null;

  function close() {
    setCreating(false);
    setEditing(null);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="display text-xl">Catalog</h2>
          <p className="mt-1.5 text-sm text-ink-faint">
            {products.length} products ·{" "}
            {products.filter((p) => p.is_published).length} live
          </p>
        </div>

        {can.manage && !formOpen && (
          <button
            type="button"
            onClick={() => {
              setEditing(null);
              setCreating(true);
            }}
            className="inline-flex items-center gap-2 rounded-full bg-ink px-6 py-3 text-xs font-semibold uppercase tracking-[0.2em] text-paper hover:opacity-90 transition-colors"
          >
            <Plus size={14} aria-hidden />
            New product
          </button>
        )}
      </div>

      {/* ---------------- EDITOR ---------------- */}
      {formOpen && (
        <form
          action={submit}
          key={draft?.id ?? "new"}
          className="rounded-xl border border-rule bg-paper-raised p-6 animate-fade-in"
        >
          <div className="flex items-center justify-between">
            <h3 className="display text-lg">
              {draft ? "Edit product" : "New product"}
            </h3>
            <button
              type="button"
              onClick={close}
              className="grid h-8 w-8 place-items-center rounded-full text-ink-dim hover:text-ink hover:bg-paper-sunken transition-colors"
              aria-label="Close editor"
            >
              <X size={17} aria-hidden />
            </button>
          </div>

          {draft && <input type="hidden" name="id" value={draft.id} />}

          <div className="mt-6 grid gap-5 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label htmlFor="name" className="eyebrow">
                Name
              </label>
              <input
                id="name"
                name="name"
                required
                defaultValue={draft?.name ?? ""}
                className={inputClass}
              />
            </div>

            <div>
              <label htmlFor="brand_id" className="eyebrow">
                Brand
              </label>
              <select
                id="brand_id"
                name="brand_id"
                required
                defaultValue={draft?.brand_id ?? ""}
                className={inputClass}
              >
                <option value="">Select a brand…</option>
                {brands.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="category_id" className="eyebrow">
                Category
              </label>
              <select
                id="category_id"
                name="category_id"
                defaultValue={draft?.category_id ?? ""}
                className={inputClass}
              >
                <option value="">Uncategorised</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="price" className="eyebrow">
                Price (USD)
              </label>
              <input
                id="price"
                name="price"
                type="number"
                step="0.01"
                min="0"
                required
                defaultValue={draft?.price ?? ""}
                className={inputClass}
              />
            </div>

            <div>
              <label htmlFor="compare_at_price" className="eyebrow">
                Compare-at price
              </label>
              <input
                id="compare_at_price"
                name="compare_at_price"
                type="number"
                step="0.01"
                min="0"
                defaultValue={draft?.compare_at_price ?? ""}
                className={inputClass}
              />
            </div>

            <div>
              <label htmlFor="stock_count" className="eyebrow">
                Stock
              </label>
              <input
                id="stock_count"
                name="stock_count"
                type="number"
                min="0"
                defaultValue={draft?.stock_count ?? 0}
                className={inputClass}
              />
            </div>

            <div>
              <label htmlFor="sizes" className="eyebrow">
                Sizes (comma separated)
              </label>
              <input
                id="sizes"
                name="sizes"
                defaultValue={(draft?.sizes ?? ["S", "M", "L", "XL"]).join(", ")}
                className={inputClass}
              />
            </div>

            <div className="sm:col-span-2">
              <label htmlFor="image_url" className="eyebrow">
                Image URL
              </label>
              <input
                id="image_url"
                name="image_url"
                defaultValue={draft?.image_url ?? ""}
                placeholder="Leave blank to auto-generate a placeholder"
                className={inputClass}
              />
            </div>

            <div className="sm:col-span-2">
              <label htmlFor="description" className="eyebrow">
                Description
              </label>
              <textarea
                id="description"
                name="description"
                rows={4}
                defaultValue={draft?.description ?? ""}
                className={`${inputClass} resize-y`}
              />
            </div>
          </div>

          <div className="mt-5 flex flex-wrap gap-6">
            <label className="flex items-center gap-2.5 text-sm">
              <input
                type="checkbox"
                name="is_published"
                defaultChecked={draft?.is_published ?? false}
                disabled={!can.publish}
                className="h-4 w-4 accent-[var(--ink)] disabled:opacity-40"
              />
              Published
              {!can.publish && (
                <span className="text-xs text-ink-faint">
                  (needs products.publish)
                </span>
              )}
            </label>

            <label className="flex items-center gap-2.5 text-sm">
              <input
                type="checkbox"
                name="is_featured"
                defaultChecked={draft?.is_featured ?? false}
                className="h-4 w-4 accent-[var(--ink)]"
              />
              Featured on the homepage
            </label>
          </div>

          {state && (
            <p
              role="status"
              className={`mt-5 text-sm ${state.ok ? "text-success" : "text-danger"}`}
            >
              {state.message}
            </p>
          )}

          <div className="mt-6 flex gap-3">
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center gap-2 rounded-full bg-ink px-7 py-3 text-xs font-semibold uppercase tracking-[0.2em] text-paper hover:opacity-90 disabled:opacity-60 transition-colors"
            >
              {saving && <Loader2 size={13} className="animate-spin" aria-hidden />}
              {draft ? "Save changes" : "Create product"}
            </button>
            <button
              type="button"
              onClick={close}
              className="rounded-full border border-rule-strong px-7 py-3 text-xs uppercase tracking-[0.2em] text-ink-dim hover:text-ink transition-colors"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {/* ---------------- LIST ---------------- */}
      <ul className="divide-y divide-rule overflow-hidden rounded-xl border border-rule">
        {products.length === 0 && (
          <li className="bg-paper-raised px-5 py-14 text-center text-sm text-ink-faint">
            No products yet.
          </li>
        )}

        {products.map((product) => (
          <li
            key={product.id}
            className="flex flex-wrap items-center gap-4 bg-paper-raised px-5 py-4"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={product.image_url ?? "/ph/product"}
              alt=""
              className="h-16 w-14 shrink-0 rounded-md object-cover bg-paper-sunken"
            />

            <div className="min-w-0 flex-1">
              <p className="truncate text-sm">{product.name}</p>
              <p className="mt-0.5 text-xs text-ink-faint">
                {money(product.price)} ·{" "}
                <span className={product.stock_count <= 3 ? "text-danger" : ""}>
                  {product.stock_count} in stock
                </span>
                {product.is_featured && " · featured"}
              </p>
            </div>

            <span
              className={`shrink-0 rounded-full border px-3 py-1 text-[10px] uppercase tracking-[0.18em] ${
                product.is_published
                  ? "border-success/50 text-success"
                  : "border-rule-strong text-ink-faint"
              }`}
            >
              {product.is_published ? "Live" : "Draft"}
            </span>

            <div className="flex shrink-0 items-center gap-2">
              {can.publish && (
                <form action={togglePublished}>
                  <input type="hidden" name="id" value={product.id} />
                  <input
                    type="hidden"
                    name="next"
                    value={String(!product.is_published)}
                  />
                  <button
                    type="submit"
                    className="rounded-full border border-rule-strong px-4 py-1.5 text-[10px] uppercase tracking-[0.18em] text-ink-dim hover:text-ink hover:border-ink transition-colors"
                  >
                    {product.is_published ? "Unpublish" : "Publish"}
                  </button>
                </form>
              )}

              {can.manage && (
                <button
                  type="button"
                  onClick={() => {
                    setCreating(false);
                    setEditing(product);
                    window.scrollTo({ top: 0, behavior: "smooth" });
                  }}
                  className="grid h-8 w-8 place-items-center rounded-full text-ink-dim hover:text-ink hover:bg-paper-sunken transition-colors"
                  aria-label={`Edit ${product.name}`}
                >
                  <Pencil size={14} aria-hidden />
                </button>
              )}

              {can.remove && (
                <form action={deleteProduct}>
                  <input type="hidden" name="id" value={product.id} />
                  <button
                    type="submit"
                    className="grid h-8 w-8 place-items-center rounded-full text-ink-faint hover:text-danger hover:bg-paper-sunken transition-colors"
                    aria-label={`Delete ${product.name}`}
                  >
                    <Trash2 size={14} aria-hidden />
                  </button>
                </form>
              )}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
