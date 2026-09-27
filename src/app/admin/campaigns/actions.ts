"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireStaff } from "@/lib/auth";
import { MODELS, isModelId, submit, cancel } from "@/lib/higgsfield";
import type { AdminResult } from "../actions";

/**
 * Campaign generation: the mutations.
 *
 * Reading a job's progress deliberately lives elsewhere, in the route handler
 * at /api/admin/campaigns/[id]/status. Next dispatches Server Actions one at a
 * time per client, so polling several jobs through actions would queue them
 * behind each other and behind anything else the page is doing. The framework
 * documentation says as much: use a Route Handler for non-mutation requests.
 *
 * Every action authenticates for itself. A Server Action is a POST endpoint
 * that anybody can reach, so the fact that this page only renders for staff
 * is a UI nicety, not a boundary.
 */

const text = (fd: FormData, key: string) => {
  const v = fd.get(key);
  return typeof v === "string" && v.trim() ? v.trim() : null;
};

/** How much a generation may be asked for at once. */
const PROMPT_MAX = 1200;

/**
 * Starts a generation.
 *
 * The product's own photograph is passed as the reference where the model
 * accepts one, which is the whole point of doing this on a storefront: a
 * prompt alone invents a garment nobody can buy, and an advertisement for a
 * garment nobody can buy converts nothing.
 */
export async function startCampaign(
  _prev: AdminResult,
  formData: FormData,
): Promise<AdminResult> {
  const staff = await requireStaff();
  const supabase = await createClient();

  const model = text(formData, "model");
  const prompt = text(formData, "prompt");
  const productId = text(formData, "product_id");
  const resolution = text(formData, "resolution");

  if (!isModelId(model)) return { ok: false, message: "Pick a model." };
  if (!prompt) return { ok: false, message: "Write a prompt." };
  if (prompt.length > PROMPT_MAX) {
    return { ok: false, message: `Keep the prompt under ${PROMPT_MAX} characters.` };
  }
  if (!process.env.HF_CREDENTIALS) {
    return { ok: false, message: "HF_CREDENTIALS is not set on the server." };
  }

  const spec = MODELS[model];

  /* The reference photograph.
   *
   * No upload round trip: these images are already public URLs on our own
   * storage, and the documented way to give a model an image is to pass a
   * URL. Higgsfield's signed-upload flow exists for files that are not
   * already reachable, which is not the case here. */
  let reference: string | null = null;
  if (productId) {
    const { data: product } = await supabase
      .from("products")
      .select("image_url")
      .eq("id", productId)
      .single();
    reference = product?.image_url ?? null;
  }

  const input: Record<string, unknown> = { prompt };
  if (spec.resolutions.length) {
    input.resolution = spec.resolutions.includes(resolution as never)
      ? resolution
      : spec.resolutions[spec.resolutions.length - 1];
  }
  /* The one field that was not verifiable.
   *
   * The model's page documents prompt, quality, moderation, resolution,
   * aspect_ratio and enhance_prompt, and the catalogue says it takes image
   * inputs — but no source states the field name for them. The file-upload
   * guide says a public URL goes in "the model parameter that accepts an
   * input URL, such as image_url", which is a convention and not this
   * model's schema. So it is sent under that name and the request is allowed
   * to fail loudly if it is wrong, rather than a name being invented and the
   * mismatch being hidden. */
  if (spec.takesReference && reference) input.image_url = reference;

  let requestId: string;
  try {
    const res = await submit(model, input);
    requestId = res.request_id;
    if (!requestId) return { ok: false, message: "The API accepted the job but returned no request_id." };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "Generation could not be started." };
  }

  /* Recorded immediately, and this is not bookkeeping.
   *
   * The request_id is the only handle on a generation that is now running and
   * will be charged for. If the insert failed silently the job would still
   * complete, still cost money, and be unreachable. */
  const { error } = await supabase.from("campaign_jobs").insert({
    request_id: requestId,
    model,
    prompt,
    input,
    product_id: productId,
    created_by: staff.userId,
    status: "queued",
  });

  if (error) {
    return {
      ok: false,
      message: `Generation ${requestId} started but could not be saved: ${error.message}`,
    };
  }

  revalidatePath("/admin/campaigns");
  return { ok: true, message: "Generating. This usually takes a minute or two." };
}

/**
 * Cancels a queued generation.
 *
 * Only `queued` jobs can be cancelled; once generation starts the API refuses.
 * The call has to actually reach Higgsfield — dropping our own polling stops
 * us watching, it does not stop the work or the charge.
 */
export async function cancelCampaign(formData: FormData): Promise<AdminResult> {
  await requireStaff();
  const supabase = await createClient();

  const id = text(formData, "id");
  if (!id) return { ok: false, message: "Missing job." };

  // Ownership is the RLS policy's job; this select is how we find out.
  const { data: job } = await supabase
    .from("campaign_jobs")
    .select("request_id, status")
    .eq("id", id)
    .single();

  if (!job) return { ok: false, message: "That job is not yours." };
  if (job.status !== "queued") {
    return { ok: false, message: `Cannot cancel a job that is ${job.status}.` };
  }

  try {
    await cancel(job.request_id);
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "Cancel failed." };
  }

  await supabase.from("campaign_jobs").update({ status: "canceled" }).eq("id", id);
  revalidatePath("/admin/campaigns");
  return { ok: true, message: "Cancelled." };
}

/**
 * Puts a finished image on the product, which is what puts it on the street.
 *
 * Only ever the stored copy. Higgsfield's own URL stops resolving seven days
 * after the job completes, and a product pointing at one would go blank in a
 * week — on the product page and on the hoardings in the district, which read
 * the same field.
 */
export async function applyCampaign(formData: FormData): Promise<AdminResult> {
  await requireStaff();
  const supabase = await createClient();

  const id = text(formData, "id");
  if (!id) return { ok: false, message: "Missing job." };

  const { data: job } = await supabase
    .from("campaign_jobs")
    .select("stored_url, status, product_id")
    .eq("id", id)
    .single();

  if (!job) return { ok: false, message: "That job is not yours." };
  if (job.status !== "completed" || !job.stored_url) {
    return { ok: false, message: "That job has no saved image yet." };
  }
  if (!job.product_id) {
    return { ok: false, message: "This image is not attached to a product." };
  }

  const { error } = await supabase
    .from("products")
    .update({ image_url: job.stored_url })
    .eq("id", job.product_id);

  if (error) return { ok: false, message: error.message };

  revalidatePath("/admin/campaigns");
  revalidatePath("/admin/products");
  return {
    ok: true,
    message: "Applied. The shop and the district boards pick it up within about a minute.",
  };
}
