import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireStaff } from "@/lib/auth";
import CampaignStudio from "@/components/CampaignStudio";
import { MODELS, REFERENCE_FIELD } from "@/lib/higgsfield";

export const metadata: Metadata = { title: "Campaigns" };

/**
 * Generated campaign imagery for the shop and for the hoardings in the
 * district.
 *
 * Deliberately not a general image playground: every generation is tied to a
 * product, because the thing that sells is a picture of something that can be
 * bought, and because applying a result writes to that product's image, which
 * is the field both the shelf and the boards on the street read.
 */
export default async function AdminCampaignsPage() {
  const staff = await requireStaff();
  if (!staff.can("products.manage")) redirect("/admin");

  const supabase = await createClient();
  const [{ data: products }, { data: jobs }] = await Promise.all([
    supabase
      .from("products")
      .select("id, name, image_url, brands(name)")
      .order("created_at", { ascending: false })
      .limit(300),
    supabase
      .from("campaign_jobs")
      .select("id, prompt, model, status, stored_url, error, product_id, created_at")
      .order("created_at", { ascending: false })
      .limit(40),
  ]);

  const models = Object.entries(MODELS).map(([id, m]) => ({
    id,
    label: m.label,
    note: m.note,
    resolutions: [...m.resolutions],
    // What the model is documented to do, AND whether we can actually
    // address it. Without the parameter name the picker must not promise
    // the visitor's product will appear, because it will not.
    takesReference: m.takesReference && REFERENCE_FIELD !== null,
  }));

  return (
    <CampaignStudio
      products={(products ?? []) as never}
      jobs={(jobs ?? []) as never}
      models={models}
      configured={Boolean(process.env.HF_CREDENTIALS)}
    />
  );
}
