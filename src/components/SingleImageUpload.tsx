"use client";

import { useRef, useState } from "react";
import { ImagePlus, Loader2, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import ProductImage from "@/components/ProductImage";

const MAX_BYTES = 10 * 1024 * 1024;
const ACCEPT = "image/png,image/jpeg,image/webp,image/avif";

/**
 * One image, straight from the browser to a storage bucket, submitted with the
 * form as a URL in a hidden field.
 *
 * Same shape as the product uploader and for the same reasons: a server action
 * body is capped at 1MB, and removing an image here only detaches it, never
 * deletes the file.
 */
export default function SingleImageUpload({
  bucket,
  name = "image_url",
  initial,
  label = "Image",
  hint,
}: {
  bucket: string;
  name?: string;
  initial?: string | null;
  label?: string;
  hint?: string;
}) {
  const [url, setUrl] = useState<string>(initial ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  async function upload(file: File) {
    setError(null);
    if (file.size > MAX_BYTES) {
      setError(`${file.name} is larger than 10 MB.`);
      return;
    }

    setBusy(true);
    const supabase = createClient();
    const ext = (file.name.split(".").pop() ?? "jpg").toLowerCase();
    const path = `${crypto.randomUUID()}.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from(bucket)
      .upload(path, file, { contentType: file.type, cacheControl: "31536000" });

    if (uploadError) {
      setError(uploadError.message);
      setBusy(false);
      return;
    }

    const { data } = supabase.storage.from(bucket).getPublicUrl(path);
    setUrl(data.publicUrl);
    setBusy(false);
  }

  return (
    <div>
      <p className="eyebrow">{label}</p>
      <input type="hidden" name={name} value={url} />

      <div className="mt-2 flex items-start gap-3">
        {url ? (
          <div className="group relative h-28 w-44 overflow-hidden rounded-lg border border-rule bg-paper-sunken">
            <ProductImage src={url} alt="" className="h-full w-full object-cover" />
            <button
              type="button"
              onClick={() => setUrl("")}
              aria-label="Remove this image"
              className="absolute right-1 top-1 grid h-6 w-6 place-items-center rounded-full bg-ink/70 text-paper/80 opacity-0 transition-opacity group-hover:opacity-100 focus:opacity-100"
            >
              <X size={12} aria-hidden />
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={busy}
            className="grid h-28 w-44 place-items-center gap-1 rounded-lg border border-dashed border-rule-strong text-ink-faint transition-colors hover:border-ink hover:text-ink disabled:opacity-60"
          >
            {busy ? (
              <Loader2 size={18} className="animate-spin" aria-hidden />
            ) : (
              <>
                <ImagePlus size={18} aria-hidden />
                <span className="text-[10px] uppercase tracking-[0.14em]">Upload</span>
              </>
            )}
          </button>
        )}
      </div>

      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT}
        className="sr-only"
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (file) void upload(file);
        }}
      />

      {hint && <p className="mt-2 text-xs text-ink-faint">{hint}</p>}
      {error && (
        <p role="status" className="mt-2 text-xs text-danger">
          {error}
        </p>
      )}
    </div>
  );
}
