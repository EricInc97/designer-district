import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireStaff } from "@/lib/auth";
import AudienceBoard from "@/components/AudienceBoard";
import type { BuyerProfileRow } from "@/lib/types";

export const metadata: Metadata = { title: "Audience" };

export default async function AdminAudiencePage() {
  const staff = await requireStaff();
  if (!staff.can("customers.view")) redirect("/admin");

  const supabase = await createClient();

  // The join is what makes a row legible: a segment without the person, the
  // house they favour and where they shop from is just a word.
  const [{ data: rows }, { count: totalCustomers }, { count: consented }] =
    await Promise.all([
      supabase
        .from("buyer_profiles")
        .select(
          "*, profiles(email, full_name), brands(name, slug), categories(name)",
        )
        .order("last_seen_at", { ascending: false, nullsFirst: false })
        .limit(200),
      supabase
        .from("profiles")
        .select("*", { count: "exact", head: true })
        .eq("role", "customer"),
      supabase
        .from("profiles")
        .select("*", { count: "exact", head: true })
        .eq("personalisation_consent", true),
    ]);

  return (
    <AudienceBoard
      rows={(rows ?? []) as BuyerProfileRow[]}
      totalCustomers={totalCustomers ?? 0}
      consented={consented ?? 0}
    />
  );
}
