/**
 * The Higgsfield generative-media API, server side only.
 *
 * Every function here needs the account credential, so none of it may ever
 * reach a browser bundle. There is no `server-only` package in this project,
 * so the guard below is the enforcement: if this module is ever imported from
 * a client component the build will pull it in and the first call will throw
 * loudly rather than quietly shipping a key to the public.
 *
 * Verified against the documentation on 2026-09-27:
 *   - auth header      docs.higgsfield.ai/docs/authentication.md
 *   - lifecycle        docs.higgsfield.ai/docs/concepts/requests.md
 *   - upload flow      docs.higgsfield.ai/docs/concepts/file-uploads.md
 *   - official SDKs    docs.higgsfield.ai/docs/how-to/sdk.md
 *
 * REST rather than the official `@higgsfield/client` SDK, deliberately. The
 * SDK's convenience is `subscribe(..., { withPolling: true })`, which blocks
 * until the generation finishes — and a generation takes far longer than a
 * serverless function is allowed to run. Submitting and polling separately is
 * the shape this platform can actually host. The credential variable name is
 * still the SDK's `HF_CREDENTIALS`, so swapping to it later changes no
 * configuration.
 */

const BASE = "https://api.higgsfield.ai";

/**
 * The credential, as copied from open.higgsfield.ai/api-keys.
 *
 * The documented header is `Authorization: Key <key-id>:<key-secret>` — the
 * value is a colon-joined pair, and the string the dashboard gives you
 * already contains the colon. Nothing here splits it or adds one: it is
 * passed through exactly as copied, which is also why the admin form takes
 * it as a single field.
 */
function credentials(): string {
  if (typeof window !== "undefined") {
    throw new Error("higgsfield.ts was imported into a browser bundle");
  }
  const key = process.env.HF_CREDENTIALS;
  if (!key) throw new Error("HF_CREDENTIALS is not set");
  return key;
}

/**
 * The models this app can generate with, and what each one takes.
 *
 * Not a filtered catalogue: Higgsfield publishes many more, and the intent is
 * that adding one here is a three-line change. These two are the ones whose
 * schemas were read rather than guessed.
 */
export const MODELS = {
  "marketing-studio/image": {
    label: "Marketing Studio",
    note: "Campaign images from a prompt and a product photo.",
    /* Documented on the model's own page: prompt, quality (high|low),
     * moderation (auto), resolution (1k|2k|4k), aspect_ratio (auto),
     * enhance_prompt (boolean). Listed prices per image at the time of
     * reading: 1k $0.0162, 2k $0.0222, 4k high $0.7219 — the jump at 4k is
     * forty-four times 1k, so the form defaults to 2k. */
    resolutions: ["1k", "2k"] as const,
    takesReference: true,
  },
  "higgsfield-ai/soul/v2/standard": {
    label: "Soul 2",
    note: "Realistic fashion and portrait imagery from a prompt alone.",
    // The endpoint used by the official quickstart. Body is `{ prompt }`.
    resolutions: [] as const,
    takesReference: false,
  },
} as const;

export type ModelId = keyof typeof MODELS;
export const isModelId = (v: unknown): v is ModelId =>
  typeof v === "string" && Object.prototype.hasOwnProperty.call(MODELS, v);

/** The six documented states. The last four are terminal. */
export type JobStatus =
  | "queued" | "in_progress"
  | "completed" | "failed" | "nsfw" | "canceled";

export const TERMINAL: ReadonlySet<string> = new Set([
  "completed", "failed", "nsfw", "canceled",
]);

type SubmitResponse = { request_id: string; status_url?: string; cancel_url?: string };

/**
 * Talks to the API and never puts the credential anywhere but the header.
 *
 * Errors carry the status and the body, because a 401 and a schema rejection
 * need completely different fixes and "request failed" tells you neither.
 */
async function call<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      Authorization: `Key ${credentials()}`,
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
    cache: "no-store",
  });

  const body = await res.text();
  if (!res.ok) {
    // Never interpolate the key into a message; `body` is the API's own text.
    throw new Error(`Higgsfield ${res.status}: ${body.slice(0, 400)}`);
  }
  return (body ? JSON.parse(body) : {}) as T;
}

/** Submits a generation. Returns as soon as the job is queued. */
export async function submit(model: ModelId, input: Record<string, unknown>) {
  return call<SubmitResponse>(`/${model}`, {
    method: "POST",
    body: JSON.stringify(input),
  });
}

/**
 * Where a finished job's media lives.
 *
 * The shape depends on the model: images come back as `images[]`, video as a
 * single `video`. Only the image case is read here, because only images are
 * generated today, but the video field is matched so that adding motion to
 * the crown board later does not need this function rewritten.
 */
type StatusResponse = {
  status: string;
  images?: { url?: string }[];
  video?: { url?: string };
  error?: string;
  message?: string;
};

export type Snapshot = {
  status: JobStatus;
  /** First output URL, if the job completed. Expires seven days after that. */
  url: string | null;
  error: string | null;
};

export async function status(requestId: string): Promise<Snapshot> {
  const r = await call<StatusResponse>(`/requests/${encodeURIComponent(requestId)}/status`);
  const url = r.images?.[0]?.url ?? r.video?.url ?? null;
  return {
    status: (r.status as JobStatus) ?? "queued",
    url: r.status === "completed" ? url ?? null : null,
    error: r.status === "failed" || r.status === "nsfw"
      ? r.error ?? r.message ?? `Generation ${r.status}`
      : null,
  };
}

/**
 * Cancels a job.
 *
 * Only `queued` jobs are cancellable — once generation starts the API will
 * refuse — and stopping the polling on our side cancels nothing at all, so
 * this has to actually be called.
 */
export async function cancel(requestId: string) {
  return call<unknown>(`/requests/${encodeURIComponent(requestId)}/cancel`, { method: "POST" });
}
