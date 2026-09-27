import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { status as remoteStatus, TERMINAL } from "@/lib/higgsfield";

/**
 * Progress for one generation, and the place its result is made permanent.
 *
 * A route handler rather than a Server Action because the admin page watches
 * several jobs at once and Next dispatches actions one at a time per client;
 * polling through actions would put every request in a queue behind the
 * others. The framework's own guidance is to use a route handler for reads.
 *
 * It is not purely a read, though. The moment a job completes is the only
 * moment we are certain there is a file to copy, and Higgsfield's URLs stop
 * resolving seven days later — so this is also where the image is pulled into
 * our own bucket. Doing it on a later visit would work until somebody came
 * back on the eighth day.
 */

const BUCKET = "product-images";

/** Whatever the CDN says it served, mapped to something to name a file with. */
const EXT: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "video/mp4": "mp4",
};

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;
  const supabase = await createClient();

  const { data: user } = await supabase.auth.getUser();
  if (!user?.user) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  /* Ownership is enforced by the row-level policy on campaign_jobs, which
   * only returns rows belonging to the caller. A missing row and somebody
   * else's row are indistinguishable here, which is the intent: a request_id
   * guessed or copied from elsewhere reveals nothing. */
  const { data: job } = await supabase
    .from("campaign_jobs")
    .select("id, request_id, status, result_url, stored_url, product_id")
    .eq("id", id)
    .single();

  if (!job) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Already finished and already copied: nothing to ask the API.
  if (TERMINAL.has(job.status) && (job.stored_url || job.status !== "completed")) {
    return NextResponse.json(
      { status: job.status, stored_url: job.stored_url },
      { headers: { "Cache-Control": "no-store" } },
    );
  }

  let snap;
  try {
    snap = await remoteStatus(job.request_id);
  } catch (e) {
    // A polling failure is not a job failure. Leave the row alone so the next
    // poll can try again rather than marking a running generation dead.
    return NextResponse.json(
      { status: job.status, error: e instanceof Error ? e.message : "Status check failed" },
      { status: 502, headers: { "Cache-Control": "no-store" } },
    );
  }

  let storedUrl: string | null = job.stored_url;

  if (snap.status === "completed" && snap.url && !storedUrl) {
    try {
      const res = await fetch(snap.url, { cache: "no-store" });
      if (!res.ok) throw new Error(`fetching the result returned ${res.status}`);
      const type = res.headers.get("content-type")?.split(";")[0] ?? "image/png";
      const bytes = new Uint8Array(await res.arrayBuffer());
      const path = `${crypto.randomUUID()}.${EXT[type] ?? "png"}`;

      const { error: upErr } = await supabase.storage
        .from(BUCKET)
        .upload(path, bytes, { contentType: type, upsert: false });
      if (upErr) throw new Error(upErr.message);

      storedUrl = supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
    } catch (e) {
      /* The generation succeeded and we failed to keep it. Worth saying so
       * plainly: the result_url below still works for seven days, so the
       * image is recoverable by hand until then. */
      await supabase
        .from("campaign_jobs")
        .update({
          status: "completed",
          result_url: snap.url,
          error: `Saved to Higgsfield but not to our storage: ${
            e instanceof Error ? e.message : "unknown error"
          }`,
        })
        .eq("id", job.id);

      return NextResponse.json(
        { status: "completed", stored_url: null, error: "Could not copy the image into storage." },
        { headers: { "Cache-Control": "no-store" } },
      );
    }
  }

  await supabase
    .from("campaign_jobs")
    .update({
      status: snap.status,
      result_url: snap.url ?? job.result_url,
      stored_url: storedUrl,
      error: snap.error,
    })
    .eq("id", job.id);

  return NextResponse.json(
    { status: snap.status, stored_url: storedUrl, error: snap.error },
    { headers: { "Cache-Control": "no-store" } },
  );
}
