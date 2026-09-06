import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { UserRole } from "@/lib/types";

export type StaffContext = {
  userId: string;
  email: string | null;
  fullName: string | null;
  role: UserRole;
  scopes: string[];
  isMaster: boolean;
  can: (scope: string) => boolean;
};

/**
 * Resolves the signed-in staff member with their effective scope set.
 * proxy.ts already blocks non-staff from /admin; this is the second gate,
 * and the source of truth for which controls render.
 */
export async function requireStaff(): Promise<StaffContext> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login?next=/admin");

  const [{ data: profile }, { data: scopeData }] = await Promise.all([
    supabase.from("profiles").select("role, email, full_name").eq("id", user.id).single(),
    supabase.rpc("my_scopes"),
  ]);

  const role = (profile?.role ?? "customer") as UserRole;
  if (role !== "admin" && role !== "master_admin") redirect("/account");

  const scopes: string[] = Array.isArray(scopeData) ? scopeData : [];
  const isMaster = role === "master_admin";

  return {
    userId: user.id,
    email: profile?.email ?? user.email ?? null,
    fullName: profile?.full_name ?? null,
    role,
    scopes,
    isMaster,
    // A master admin implicitly holds everything, mirroring has_scope() in SQL.
    can: (scope: string) => isMaster || scopes.includes(scope),
  };
}
