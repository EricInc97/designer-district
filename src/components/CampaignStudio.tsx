"use client";

import { useActionState, useEffect, useMemo, useState, useTransition } from "react";
import { Loader2, Sparkles, X, Check, AlertTriangle } from "lucide-react";
import {
  startCampaign,
  cancelCampaign,
  applyCampaign,
} from "@/app/admin/campaigns/actions";
import type { AdminResult } from "@/app/admin/actions";

type Product = {
  id: string;
  name: string;
  image_url: string | null;
  brands: { name: string } | { name: string }[] | null;
};

type Job = {
  id: string;
  prompt: string;
  model: string;
  status: "queued" | "in_progress" | "completed" | "failed" | "nsfw" | "canceled";
  stored_url: string | null;
  error: string | null;
  product_id: string | null;
  created_at: string;
};

type Model = {
  id: string;
  label: string;
  note: string;
  resolutions: string[];
  takesReference: boolean;
};

const OPEN = new Set(["queued", "in_progress"]);
const brandName = (b: Product["brands"]) =>
  Array.isArray(b) ? b[0]?.name ?? "" : b?.name ?? "";

export default function CampaignStudio({
  products,
  jobs: initial,
  models,
  configured,
}: {
  products: Product[];
  jobs: Job[];
  models: Model[];
  configured: boolean;
}) {
  const [state, submit, busy] = useActionState<AdminResult, FormData>(
    startCampaign,
    null,
  );
  const [model, setModel] = useState(models[0]?.id ?? "");
  const [pending, act] = useTransition();

  /* Polled progress, layered over the server's list rather than replacing it.
   *
   * The obvious shape — copy `initial` into state and overwrite it as polls
   * land — needs an effect to re-sync whenever the server re-renders the
   * page, and setting state from an effect body is a cascading render. This
   * way the server list stays the single source of truth and polling only
   * contributes the fields it actually learned. */
  const [seen, setSeen] = useState<Record<string, Partial<Job>>>({});
  const jobs = useMemo(
    () => initial.map((j) => ({ ...j, ...seen[j.id] })),
    [initial, seen],
  );

  /* Watch anything still running.
   *
   * Through the route handler rather than a Server Action, because Next
   * dispatches actions one at a time per client: polling three jobs that way
   * would serialise them behind each other and behind the submit button.
   *
   * Every five seconds, and only while something is actually open — a
   * finished board does not need asking about, and each poll costs a call to
   * Higgsfield.
   */
  /* Keyed on which jobs are open, not on the jobs array.
   *
   * Depending on `jobs` would tear down and rebuild the interval on every
   * tick, because the tick is what updates `jobs` — the timer would reset
   * before it ever fired again. The key only changes when a job actually
   * opens or closes, which is when the watch genuinely needs restarting. */
  const openKey = useMemo(
    () => jobs.filter((j) => OPEN.has(j.status)).map((j) => j.id).sort().join(","),
    [jobs],
  );

  useEffect(() => {
    const open = openKey ? openKey.split(",") : [];
    if (!open.length) return;

    let live = true;
    const tick = async () => {
      const results = await Promise.all(
        open.map(async (jobId) => {
          try {
            const r = await fetch(`/api/admin/campaigns/${jobId}/status`, {
              cache: "no-store",
            });
            if (!r.ok) return null;
            return { id: jobId, ...(await r.json()) } as {
              id: string;
              status: Job["status"];
              stored_url: string | null;
              error: string | null;
            };
          } catch {
            return null;
          }
        }),
      );
      if (!live) return;
      setSeen((prev) => {
        const next = { ...prev };
        for (const r of results) {
          if (r) next[r.id] = { status: r.status, stored_url: r.stored_url, error: r.error };
        }
        return next;
      });
    };

    const t = setInterval(tick, 5000);
    void tick();
    return () => {
      live = false;
      clearInterval(t);
    };
  }, [openKey]);

  const spec = models.find((m) => m.id === model);

  return (
    <div className="space-y-10">
      <header>
        <h1 className="text-2xl font-semibold">Campaigns</h1>
        <p className="mt-1 text-sm text-muted">
          Generated imagery for the shop and the hoardings in the district.
          Applying a result replaces the product&rsquo;s photograph, so it
          appears on the shelf and on the boards on the street.
        </p>
      </header>

      {!configured && (
        <p className="flex items-start gap-2 rounded-md border border-rule bg-amber-50 p-4 text-sm">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" />
          <span>
            <strong>HF_CREDENTIALS is not set.</strong> Add it to{" "}
            <code>.env.local</code> and to the Vercel project, as the whole
            string copied from open.higgsfield.ai/api-keys.
          </span>
        </p>
      )}

      <form action={submit} className="grid gap-4 rounded-lg border border-rule p-5 sm:grid-cols-2">
        <label className="block sm:col-span-1">
          <span className="text-xs uppercase tracking-wide text-muted">Product</span>
          <select name="product_id" required className="mt-1 w-full rounded border border-rule p-2 text-sm">
            <option value="">Pick a product…</option>
            {products.map((p) => (
              <option key={p.id} value={p.id}>
                {brandName(p.brands)} — {p.name}
              </option>
            ))}
          </select>
        </label>

        <label className="block sm:col-span-1">
          <span className="text-xs uppercase tracking-wide text-muted">Model</span>
          <select
            name="model"
            value={model}
            onChange={(e) => setModel(e.target.value)}
            className="mt-1 w-full rounded border border-rule p-2 text-sm"
          >
            {models.map((m) => (
              <option key={m.id} value={m.id}>
                {m.label}
              </option>
            ))}
          </select>
          <span className="mt-1 block text-xs text-muted">{spec?.note}</span>
        </label>

        {spec?.resolutions.length ? (
          <label className="block sm:col-span-1">
            <span className="text-xs uppercase tracking-wide text-muted">Resolution</span>
            <select
              name="resolution"
              defaultValue={spec.resolutions[spec.resolutions.length - 1]}
              className="mt-1 w-full rounded border border-rule p-2 text-sm"
            >
              {spec.resolutions.map((r) => (
                <option key={r} value={r}>
                  {r.toUpperCase()}
                </option>
              ))}
            </select>
          </label>
        ) : null}

        <label className="block sm:col-span-2">
          <span className="text-xs uppercase tracking-wide text-muted">Prompt</span>
          <textarea
            name="prompt"
            required
            rows={3}
            maxLength={1200}
            placeholder="Editorial campaign shot, low winter sun, concrete plaza, shallow depth of field"
            className="mt-1 w-full rounded border border-rule p-2 text-sm"
          />
          {spec?.takesReference ? (
            <span className="mt-1 block text-xs text-muted">
              The product&rsquo;s own photograph is sent as the reference, so the
              piece in the image is the one you sell.
            </span>
          ) : (
            <span className="mt-1 block text-xs text-muted">
              This model generates from the prompt alone and will not reproduce
              the actual product.
            </span>
          )}
        </label>

        <div className="flex items-center gap-3 sm:col-span-2">
          <button
            type="submit"
            // Disabled while in flight: a second click is a second generation
            // and a second charge, not a retry.
            disabled={busy || !configured}
            className="inline-flex items-center gap-2 rounded-full bg-ink px-5 py-2 text-sm text-paper disabled:opacity-50"
          >
            {busy ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
            {busy ? "Starting…" : "Generate"}
          </button>
          {state && (
            <span className={`text-sm ${state.ok ? "text-muted" : "text-red-600"}`}>
              {state.message}
            </span>
          )}
        </div>
      </form>

      <section className="space-y-3">
        <h2 className="text-sm uppercase tracking-wide text-muted">Recent</h2>
        {!jobs.length && <p className="text-sm text-muted">Nothing generated yet.</p>}

        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {jobs.map((j) => (
            <li key={j.id} className="rounded-lg border border-rule p-3">
              <div className="relative aspect-square overflow-hidden rounded bg-black/5">
                {j.stored_url ? (
                  // A plain img, like the rest of this codebase: next/image
                  // would need every Supabase host listed in next.config, and
                  // nothing else here asks for that.
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={j.stored_url}
                    alt={j.prompt}
                    className="absolute inset-0 size-full object-contain"
                  />
                ) : (
                  <div className="grid h-full place-items-center text-xs text-muted">
                    {OPEN.has(j.status) ? (
                      <span className="inline-flex items-center gap-2">
                        <Loader2 className="size-4 animate-spin" />
                        {j.status === "queued" ? "Queued" : "Generating"}
                      </span>
                    ) : (
                      j.status
                    )}
                  </div>
                )}
              </div>

              <p className="mt-2 line-clamp-2 text-xs text-muted">{j.prompt}</p>
              {/* Failures and cancellations stay on screen rather than
                  disappearing, so a run that went wrong can be read. */}
              {j.error && <p className="mt-1 text-xs text-red-600">{j.error}</p>}

              <div className="mt-2 flex flex-wrap gap-2">
                {j.status === "queued" && (
                  <button
                    onClick={() =>
                      act(async () => {
                        const fd = new FormData();
                        fd.set("id", j.id);
                        await cancelCampaign(fd);
                        setSeen((p) => ({ ...p, [j.id]: { ...p[j.id], status: "canceled" } }));
                      })
                    }
                    disabled={pending}
                    className="inline-flex items-center gap-1 rounded-full border border-rule px-3 py-1 text-xs disabled:opacity-50"
                  >
                    <X className="size-3" /> Cancel
                  </button>
                )}
                {j.status === "completed" && j.stored_url && j.product_id && (
                  <button
                    onClick={() =>
                      act(async () => {
                        const fd = new FormData();
                        fd.set("id", j.id);
                        await applyCampaign(fd);
                      })
                    }
                    disabled={pending}
                    className="inline-flex items-center gap-1 rounded-full bg-ink px-3 py-1 text-xs text-paper disabled:opacity-50"
                  >
                    <Check className="size-3" /> Use on product
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
