"use client";

import { Fragment, useActionState, useState } from "react";
import { ExternalLink, Loader2, Pencil, Plus, Trash2, X } from "lucide-react";
import Link from "next/link";
import {
  saveProduct,
  togglePublished,
  deleteProduct,
  type AdminResult,
} from "@/app/admin/actions";
import ProductImage from "@/components/ProductImage";
import ProductImageUploader from "@/components/ProductImageUploader";
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

export default function ProductManager({
  products,
  brands,
  categories,
  can,
}: Props) {
  const [editing, setEditing] = useState<Product | null>(null);
  const [creating, setCreating] = useState(false);
  const [state, submit, saving] = useActionState<AdminResult, FormData>(
    saveProduct,
    null,
  );

  // "all" keeps every house on screen, grouped; a brand id narrows to one.
  const [brandFilter, setBrandFilter] = useState<string>("all");

  const draft = editing ?? null;
  const formOpen = creating || editing !== null;

  const brandName = (id: string) =>
    brands.find((b) => b.id === id)?.name ?? "Unassigned";

  /**
   * The catalog split by house, in the order the brands themselves are sorted
   * rather than alphabetically, so it reads the same way the storefront does.
   *
   * One flat list of every product was fine at a dozen rows and useless at a
   * hundred: finding the Bape hoodie meant scrolling past every other house.
   * Anything whose brand_id no longer matches a row lands in a trailing
   * "Unassigned" group rather than disappearing from the page.
   */
  const groups = [
    ...brands.map((b) => ({
      id: b.id,
      name: b.name,
      items: products.filter((p) => p.brand_id === b.id),
    })),
    {
      id: "unassigned",
      name: "Unassigned",
      items: products.filter((p) => !brands.some((b) => b.id === p.brand_id)),
    },
  ].filter((g) => g.items.length > 0);

  const shown =
    brandFilter === "all" ? groups : groups.filter((g) => g.id === brandFilter);

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
          // Remounting on the id of the last successful create is what clears
          // the form, the image uploader included, before the next product.
          // Without it "New product" reuses the same key, React keeps the
          // subtree, and the previous product's photographs are still attached.
          // A failed save leaves savedId untouched, so the typing survives.
          key={draft?.id ?? `new-${state?.savedId ?? "blank"}`}
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

          {/* Assigned by the database on insert, off a sequence, so it is shown
              rather than edited. */}
          <p className="mt-4 text-xs text-ink-faint">
            Item number{" "}
            <span className="font-mono text-ink">
              {draft?.sku ?? "assigned on save"}
            </span>
          </p>

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
                defaultValue={(draft?.sizes ?? ["S", "M", "L", "XL"]).join(
                  ", ",
                )}
                className={inputClass}
              />
            </div>

            <div className="sm:col-span-2">
              <ProductImageUploader
                imageUrl={draft?.image_url ?? null}
                gallery={draft?.gallery ?? null}
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
              {saving && (
                <Loader2 size={13} className="animate-spin" aria-hidden />
              )}
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
      {/* One chip per house that actually has stock, so the row does not fill
          up with brands there is nothing to edit under. */}
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setBrandFilter("all")}
          className={`rounded-full border px-4 py-2 text-xs uppercase tracking-[0.16em] transition-colors ${
            brandFilter === "all"
              ? "border-ink bg-ink text-paper"
              : "border-rule-strong text-ink-dim hover:border-ink hover:text-ink"
          }`}
        >
          All
          <span className="ml-2 opacity-70">{products.length}</span>
        </button>

        {groups.map((g) => {
          const on = g.id === brandFilter;
          return (
            <button
              key={g.id}
              type="button"
              onClick={() => setBrandFilter(g.id)}
              className={`rounded-full border px-4 py-2 text-xs uppercase tracking-[0.16em] transition-colors ${
                on
                  ? "border-ink bg-ink text-paper"
                  : "border-rule-strong text-ink-dim hover:border-ink hover:text-ink"
              }`}
            >
              {g.name}
              <span className="ml-2 opacity-70">{g.items.length}</span>
            </button>
          );
        })}
      </div>

      <ul className="divide-y divide-rule overflow-hidden rounded-xl border border-rule">
        {shown.length === 0 && (
          <li className="bg-paper-raised px-5 py-14 text-center text-sm text-ink-faint">
            {products.length === 0
              ? "No products yet."
              : "Nothing under this house yet."}
          </li>
        )}

        {shown.map((group) => (
          <Fragment key={group.id}>
            {/* Deliberately not sticky. The list is rounded, which means the
                ul carries overflow-hidden, and that makes the ul itself the
                nearest scrollport: a sticky header then offsets from the top
                of the list rather than the viewport and sits on top of the
                first row it is meant to label. The chips above are what make a
                long catalog navigable anyway. */}
            <li className="flex items-center justify-between gap-3 border-y border-rule bg-paper-sunken px-5 py-2">
              <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-ink">
                {group.name}
              </span>
              <span className="text-[11px] text-ink-faint">
                {group.items.length}
                {group.items.length === 1 ? " item" : " items"}
                {" · "}
                {group.items.filter((p) => p.is_published).length} live
              </span>
            </li>

            {group.items.map((product) => (
              <li
                key={product.id}
                className="flex flex-wrap items-center gap-4 bg-paper-raised px-5 py-4"
              >
                <ProductImage
                  src={product.image_url}
                  slug={product.slug}
                  alt=""
                  className="h-16 w-14 shrink-0 rounded-md object-cover bg-paper-sunken"
                />

                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm">{product.name}</p>
                  <p className="mt-0.5 text-xs text-ink-faint">
                    <span className="font-mono">{product.sku}</span>
                    {" · "}
                    {brandName(product.brand_id)}
                  </p>
                  <p className="mt-0.5 text-xs text-ink-faint">
                    {money(product.price)} ·{" "}
                    <span
                      className={product.stock_count <= 3 ? "text-danger" : ""}
                    >
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
                  {product.is_published && (
                    <Link
                      href={`/products/${product.id}`}
                      target="_blank"
                      aria-label={`View ${product.name} on the storefront`}
                      className="grid h-8 w-8 place-items-center rounded-full text-ink-faint transition-colors hover:bg-paper-sunken hover:text-ink"
                    >
                      <ExternalLink size={14} aria-hidden />
                    </Link>
                  )}

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
          </Fragment>
        ))}
      </ul>
    </div>
  );
}
