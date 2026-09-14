import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireStaff } from "@/lib/auth";
import BrandMediaManager from "@/components/BrandMediaManager";
import type { Brand, BrandMedia } from "@/lib/types";

export const metadata: Metadata = { title: "Brand artwork" };

export default async function AdminBrandsPage() {
  const staff = await requireStaff();
  if (!staff.can("products.manage")) redirect("/admin");

  const supabase = await createClient();
  const [{ data: brands }, { data: media }] = await Promise.all([
    supabase.from("brands").select("*").order("sort_order"),
    supabase.from("brand_media").select("*").order("sort_order"),
  ]);

  return (
    <BrandMediaManager
      brands={(brands ?? []) as Brand[]}
      media={(media ?? []) as BrandMedia[]}
    />
  );
}
