import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { supabaseConfigured } from "@/lib/supabase/config";
import SetupNotice from "@/components/SetupNotice";
import BrandTile from "@/components/BrandTile";
import type { Brand } from "@/lib/types";

export const metadata: Metadata = { title: "All Brands" };

export default async function BrandsIndexPage() {
  if (!supabaseConfigured) return <SetupNotice />;

  const supabase = await createClient();
  const { data } = await supabase
    .from("brands")
    .select("*")
    .eq("is_active", true)
    .order("sort_order", { ascending: true });

  const brands = (data ?? []) as Brand[];

  return (
    <section className="mx-auto max-w-7xl px-5 sm:px-8 py-14">
      <p className="eyebrow">The Collection</p>
      <h1 className="display mt-2 text-4xl sm:text-5xl">All brands</h1>

      <ul className="mt-10 grid grid-cols-3 gap-2 sm:gap-4">
        {brands.map((brand) => (
          <li key={brand.id}>
            <BrandTile brand={brand} />
          </li>
        ))}
      </ul>
    </section>
  );
}
