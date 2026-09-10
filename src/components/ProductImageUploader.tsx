"use client";

import { useRef, useState } from "react";
import { ImagePlus, Loader2, Star, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import ProductImage from "@/components/ProductImage";

const BUCKET = "product-images";
const MAX_BYTES = 5 * 1024 * 1024;
const ACCEPT = "image/png,image/jpeg,image/webp,image/avif";

/** The generated placeholder route is not a real photograph. */
const isUploaded = (url: string | null | undefined) =>
  Boolean(url && !url.startsWith("/ph/"));

/**
 * Product photography, uploaded straight from the browser to Supabase Storage.
 *
 * The files never pass through the server action: a server action body is
 * capped at 1MB by default, and photography blows past that immediately. The
 * client uploads, and only the resulting public URLs are submitted with the
 * form, in two hidden fields the action reads.
 *
 * Write access is the storage bucket's own RLS policy, gated on the same
 * `products.manage` scope that gates editing the product, so this component
 * being reachable is never what grants the upload.
 */
export default function ProductImageUploader({
  imageUrl,
  gallery,
}: {
  imageUrl: string | null;
  gallery: string[] | null;
}) {
  // The first image is the one the storefront leads with; the rest fill the
  // gallery. One ordered list here, split on submit.
  //
  // Deduplicated on the way in: a row can legitimately carry the same URL as
  // both image_url and a gallery entry, and the list is keyed by URL, so a
  // repeat would collide.
  const [images, setImages] = useState<string[]>(() => [
    ...new Set([imageUrl, ...(gallery ?? [])].filter((u): u is string => isUploaded(u))),
  ]);
  const [pending, setPending] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  async function upload(files: File[]) {
    setError(null);
    const supabase = createClient();

    for (const file of files) {
      if (file.size > MAX_BYTES) {
        setError(`${file.name} is larger than 5 MB.`);
        continue;
      }

      setPending((n) => n + 1);
      const ext = (file.name.split(".").pop() ?? "jpg").toLowerCase();
      const path = `${crypto.randomUUID()}.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from(BUCKET)
        .upload(path, file, { contentType: file.type, cacheControl: "31536000" });

      if (uploadError) {
        setError(uploadError.message);
        setPending((n) => n - 1);
        continue;
      }

      const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
      setImages((prev) =>
        prev.includes(data.publicUrl) ? prev : [...prev, data.publicUrl],
      );
      setPending((n) => n - 1);
    }
  }

  /**
   * Detaches the image from this product. It deliberately does NOT delete the
   * file from storage.
   *
   * An earlier version binned anything uploaded in the same session, on the
   * theory that removing a fresh upload was undoing a mistake. That was wrong:
   * a session spans more than one product, so the file being removed could
   * already be the saved photograph of a product created a minute ago, and
   * deleting it left that row pointing at nothing. An unreferenced file costs
   * a few kilobytes; a destroyed photograph cannot be recovered.
   */
  const remove = (url: string) =>
    setImages((prev) => prev.filter((u) => u !== url));

  const makePrimary = (url: string) =>
    setImages((prev) => [url, ...prev.filter((u) => u !== url)]);

  return (
    <div>
      <p className="eyebrow">Images</p>

      {/* What the server action reads. */}
      <input type="hidden" name="image_url" value={images[0] ?? ""} />
      <input type="hidden" name="gallery" value={JSON.stringify(images.slice(1))} />

      <div className="mt-2 flex flex-wrap gap-3">
        {images.map((url, i) => (
          <div
            key={url}
            className="group relative h-28 w-24 overflow-hidden rounded-lg border border-rule bg-paper-sunken"
          >
            <ProductImage src={url} alt="" className="h-full w-full object-cover" />

            {i === 0 && (
              <span className="absolute inset-x-0 top-0 bg-ink/80 py-1 text-center text-[9px] uppercase tracking-[0.16em] text-paper">
                Main
              </span>
            )}

            <div className="absolute inset-x-0 bottom-0 flex justify-center gap-1 bg-ink/70 p-1 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
              {i > 0 && (
                <button
                  type="button"
                  onClick={() => makePrimary(url)}
                  aria-label="Use as the main image"
                  className="grid h-6 w-6 place-items-center rounded-full text-paper/80 hover:text-paper"
                >
                  <Star size={12} aria-hidden />
                </button>
              )}
              <button
                type="button"
                onClick={() => remove(url)}
                aria-label="Remove this image"
                className="grid h-6 w-6 place-items-center rounded-full text-paper/80 hover:text-paper"
              >
                <X size={12} aria-hidden />
              </button>
            </div>
          </div>
        ))}

        {Array.from({ length: pending }, (_, i) => (
          <div
            key={`pending-${i}`}
            className="grid h-28 w-24 place-items-center rounded-lg border border-dashed border-rule-strong bg-paper-sunken"
          >
            <Loader2 size={16} className="animate-spin text-ink-faint" aria-hidden />
          </div>
        ))}

        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="grid h-28 w-24 place-items-center gap-1 rounded-lg border border-dashed border-rule-strong text-ink-faint transition-colors hover:border-ink hover:text-ink"
        >
          <ImagePlus size={18} aria-hidden />
          <span className="text-[10px] uppercase tracking-[0.14em]">Add</span>
        </button>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT}
        multiple
        className="sr-only"
        onChange={(e) => {
          const files = Array.from(e.target.files ?? []);
          e.target.value = "";
          if (files.length) void upload(files);
        }}
      />

      <p className="mt-2 text-xs text-ink-faint">
        PNG, JPEG, WebP or AVIF, up to 5 MB each. The first image is the one the
        storefront leads with. Leave this empty and a placeholder is generated.
      </p>

      {error && (
        <p role="status" className="mt-2 text-xs text-danger">
          {error}
        </p>
      )}
    </div>
  );
}
