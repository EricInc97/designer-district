import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireStaff } from "@/lib/auth";
import StaffManager from "@/components/StaffManager";
import type { AppScope, Profile } from "@/lib/types";

export const metadata: Metadata = { title: "Staff" };

export default async function AdminStaffPage() {
  const staff = await requireStaff();
  if (!staff.isMaster) redirect("/admin");

  const supabase = await createClient();

  const [{ data: people }, { data: scopes }, { data: grants }] = await Promise.all([
    supabase.from("profiles").select("*").order("created_at", { ascending: false }),
    supabase.from("app_scopes").select("*").order("sort_order"),
    supabase.from("staff_scopes").select("user_id, scope_key"),
  ]);

  const profiles = (people ?? []) as Profile[];

  const held = new Map<string, string[]>();
  for (const g of (grants ?? []) as { user_id: string; scope_key: string }[]) {
    held.set(g.user_id, [...(held.get(g.user_id) ?? []), g.scope_key]);
  }

  const team = profiles
    .filter((p) => p.role !== "customer")
    .map((p) => ({ ...p, held: held.get(p.id) ?? [] }));

  return (
    <StaffManager
      staff={team}
      customers={profiles.filter((p) => p.role === "customer")}
      scopes={(scopes ?? []) as AppScope[]}
      currentUserId={staff.userId}
    />
  );
}
