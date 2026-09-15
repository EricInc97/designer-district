"use client";

import { useActionState, useState } from "react";
import { Loader2, Pencil, Plus, Trash2, X } from "lucide-react";
import Link from "next/link";
import {
  saveBrandMedia,
  deleteBrandMedia,
  type AdminResult,
} from "@/app/admin/actions";
import SingleImageUpload from "@/components/SingleImageUpload";
import ProductImage from "@/components/ProductImage";
import type { Brand, BrandMedia } from "@/lib/types";

const inputClass =
  "mt-2 w-full rounded-lg border border-rule bg-paper px-4 py-3 text-sm text-ink outline-none placeholder:text-ink-faint focus:border-ink-faint transition-colors";

export default function BrandMediaManager({
  brands,
  media,
}: {
  brands: Brand[];
  media: BrandMedia[];
}) {
  const [editing, setEditing] = useState<BrandMedia | null>(null);
  const [creating, setCreating] = useState(false);
  const [brandFilter, setBrandFilter] = useState<string>(brands[0]?.id ?? "");
  const [state, submit, saving] = useActionState<AdminResult, FormData>(
    saveBrandMedia,
    null,
  );

  const draft = editing;
  const formOpen = creating || editing !== null;
  const slugOf = (id: string) => brands.find((b) => b.id === id)?.slug ?? "";
  const shown = media.filter((m) => m.brand_id === brandFilter);

  const close = () => {
    setCreating(false);
    setEditing(null);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="display text-xl">Campaign artwork</h2>
          <p className="mt-1.5 max-w-2xl text-sm text-ink-faint">
            The full-bleed shot at the top of a brand page, and the editorial
            bands between its product groups. A house with no artwork falls back
            to its colourway and mark, so nothing here is required.
          </p>
        </div>

        {!formOpen && (
          <button
            type="button"
            onClick={() => {
              setEditing(null);
              setCreating(true);
            }}
            className="inline-flex items-center gap-2 rounded-full bg-ink px-6 py-3 text-xs font-semibold uppercase tracking-[0.2em] text-paper transition-opacity hover:opacity-90"
          >
            <Plus size={14} aria-hidden />
            Add artwork
          </button>
        )}
      </div>

      {/* ---------------- EDITOR ---------------- */}
      {formOpen && (
        <form
          action={submit}
          key={draft?.id ?? `new-${state?.savedId ?? "blank"}`}
          className="animate-fade-in rounded-xl border border-rule bg-paper-raised p-6"
        >
          <div className="flex items-center justify-between">
            <h3 className="display text-lg">
              {draft ? "Edit artwork" : "New artwork"}
            </h3>
            <button
              type="button"
              onClick={close}
              aria-label="Close editor"
              className="grid h-8 w-8 place-items-center rounded-full text-ink-dim transition-colors hover:bg-paper-sunken hover:text-ink"
            >
              <X size={17} aria-hidden />
            </button>
          </div>

          {draft && <input type="hidden" name="id" value={draft.id} />}

          <div className="mt-6 grid gap-5 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <SingleImageUpload
                bucket="brand-media"
                initial={draft?.image_url}
                label="Photograph"
                hint="Drop an image here or click Upload. Up to 10 MB, shot wide: it runs edge to edge and is cropped to fill, so keep the subject away from the extremes."
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
                defaultValue={draft?.brand_id ?? brandFilter}
                className={inputClass}
              >
                {brands.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="kind" className="eyebrow">
                Slot
              </label>
              <select
                id="kind"
                name="kind"
                defaultValue={draft?.kind ?? "lookbook"}
                className={inputClass}
              >
                <option value="hero">Hero, at the top of the page</option>
                <option value="lookbook">Band, between product groups</option>
              </select>
            </div>

            <div className="sm:col-span-2">
              <label htmlFor="headline" className="eyebrow">
                Headline
              </label>
              <input
                id="headline"
                name="headline"
                defaultValue={draft?.headline ?? ""}
                placeholder="Spring Collection"
                className={inputClass}
              />
            </div>

            <div className="sm:col-span-2">
              <label htmlFor="subhead" className="eyebrow">
                Small line above or below it
              </label>
              <input
                id="subhead"
                name="subhead"
                defaultValue={draft?.subhead ?? ""}
                placeholder="Now in store"
                className={inputClass}
              />
            </div>

            <div>
              <label htmlFor="cta_label" className="eyebrow">
                Button text
              </label>
              <input
                id="cta_label"
                name="cta_label"
                defaultValue={draft?.cta_label ?? ""}
                placeholder="Shop the look"
                className={inputClass}
              />
            </div>

            <div>
              <label htmlFor="cta_href" className="eyebrow">
                Button link
              </label>
              <input
                id="cta_href"
                name="cta_href"
                defaultValue={draft?.cta_href ?? ""}
                placeholder="/search?category=shirts"
                className={inputClass}
              />
            </div>

            <div>
              <label htmlFor="ink" className="eyebrow">
                Type colour
              </label>
              <select
                id="ink"
                name="ink"
                defaultValue={draft?.ink ?? "light"}
                className={inputClass}
              >
                <option value="light">White, for a dark photograph</option>
                <option value="dark">Black, for a light photograph</option>
              </select>
            </div>

            <div>
              <label htmlFor="sort_order" className="eyebrow">
                Order
              </label>
              <input
                id="sort_order"
                name="sort_order"
                type="number"
                min="0"
                defaultValue={draft?.sort_order ?? 100}
                className={inputClass}
              />
            </div>
          </div>

          <label className="mt-5 flex items-center gap-2.5 text-sm">
            <input
              type="checkbox"
              name="is_published"
              defaultChecked={draft?.is_published ?? true}
              className="h-4 w-4 accent-[var(--ink)]"
            />
            Live on the brand page
          </label>

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
              className="inline-flex items-center gap-2 rounded-full bg-ink px-7 py-3 text-xs font-semibold uppercase tracking-[0.2em] text-paper transition-opacity hover:opacity-90 disabled:opacity-60"
            >
              {saving && <Loader2 size={13} className="animate-spin" aria-hidden />}
              {draft ? "Save changes" : "Add artwork"}
            </button>
            <button
              type="button"
              onClick={close}
              className="rounded-full border border-rule-strong px-7 py-3 text-xs uppercase tracking-[0.2em] text-ink-dim transition-colors hover:text-ink"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {/* ---------------- LIST ---------------- */}
      <div className="flex flex-wrap gap-2">
        {brands.map((b) => {
          const on = b.id === brandFilter;
          const n = media.filter((m) => m.brand_id === b.id).length;
          return (
            <button
              key={b.id}
              type="button"
              onClick={() => setBrandFilter(b.id)}
              className={`rounded-full border px-4 py-2 text-xs uppercase tracking-[0.16em] transition-colors ${
                on
                  ? "border-ink bg-ink text-paper"
                  : "border-rule-strong text-ink-dim hover:border-ink hover:text-ink"
              }`}
            >
              {b.name}
              {n > 0 && <span className="ml-2 opacity-70">{n}</span>}
            </button>
          );
        })}
      </div>

      <ul className="divide-y divide-rule overflow-hidden rounded-xl border border-rule">
        {shown.length === 0 && (
          <li className="bg-paper-raised px-5 py-14 text-center text-sm text-ink-faint">
            No artwork for this house yet. Its page falls back to the colourway
            and mark.
          </li>
        )}

        {shown.map((m) => (
          <li
            key={m.id}
            className="flex flex-wrap items-center gap-4 bg-paper-raised px-5 py-4"
          >
            <ProductImage
              src={m.image_url}
              alt=""
              className="h-16 w-28 shrink-0 rounded-md bg-paper-sunken object-cover"
            />

            <div className="min-w-0 flex-1">
              <p className="truncate text-sm">
                {m.headline || <span className="text-ink-faint">No headline</span>}
              </p>
              <p className="mt-0.5 text-xs text-ink-faint">
                {m.kind === "hero" ? "Hero" : "Band"} · order {m.sort_order} ·{" "}
                {m.ink === "dark" ? "black type" : "white type"}
              </p>
            </div>

            <span
              className={`shrink-0 rounded-full border px-3 py-1 text-[10px] uppercase tracking-[0.18em] ${
                m.is_published
                  ? "border-success/50 text-success"
                  : "border-rule-strong text-ink-faint"
              }`}
            >
              {m.is_published ? "Live" : "Hidden"}
            </span>

            <div className="flex shrink-0 items-center gap-2">
              <Link
                href={`/brands/${slugOf(m.brand_id)}`}
                target="_blank"
                aria-label="View the brand page"
                className="rounded-full border border-rule-strong px-4 py-1.5 text-[10px] uppercase tracking-[0.18em] text-ink-dim transition-colors hover:border-ink hover:text-ink"
              >
                View
              </Link>

              <button
                type="button"
                onClick={() => {
                  setCreating(false);
                  setEditing(m);
                  window.scrollTo({ top: 0, behavior: "smooth" });
                }}
                aria-label="Edit this artwork"
                className="grid h-8 w-8 place-items-center rounded-full text-ink-dim transition-colors hover:bg-paper-sunken hover:text-ink"
              >
                <Pencil size={14} aria-hidden />
              </button>

              <form action={deleteBrandMedia}>
                <input type="hidden" name="id" value={m.id} />
                <input type="hidden" name="brand_slug" value={slugOf(m.brand_id)} />
                <button
                  type="submit"
                  aria-label="Remove this artwork"
                  className="grid h-8 w-8 place-items-center rounded-full text-ink-faint transition-colors hover:bg-paper-sunken hover:text-danger"
                >
                  <Trash2 size={14} aria-hidden />
                </button>
              </form>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
