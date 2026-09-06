import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireStaff } from "@/lib/auth";
import ProductManager from "@/components/ProductManager";
import type { Brand, Category, Product } from "@/lib/types";

export const metadata: Metadata = { title: "Products" };

export default async function AdminProductsPage() {
  const staff = await requireStaff();

  if (!staff.can("products.view") && !staff.can("products.manage")) {
    redirect("/admin");
  }

  const supabase = await createClient();
  const [{ data: products }, { data: brands }, { data: categories }] =
    await Promise.all([
      supabase.from("products").select("*").order("updated_at", { ascending: false }),
      supabase.from("brands").select("*").order("sort_order"),
      supabase.from("categories").select("*").order("name"),
    ]);

  return (
    <ProductManager
      products={(products ?? []) as Product[]}
      brands={(brands ?? []) as Brand[]}
      categories={(categories ?? []) as Category[]}
      can={{
        manage: staff.can("products.manage"),
        publish: staff.can("products.publish"),
        remove: staff.can("products.delete"),
      }}
    />
  );
}
