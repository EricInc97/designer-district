import Link from "next/link";
import { supabaseConfigured } from "@/lib/supabase/config";
import SetupNotice from "@/components/SetupNotice";
import { requireStaff } from "@/lib/auth";
import AdminNav from "@/components/AdminNav";
import { signOut } from "@/app/account/actions";
import { titleCase } from "@/lib/format";

export default async function AdminLayout({ children }: LayoutProps<"/admin">) {
  if (!supabaseConfigured) return <SetupNotice />;

  const staff = await requireStaff();

  // The nav mirrors the scope set exactly, no tile appears that its owner
  // cannot actually use.
  const links = [
    { href: "/admin", label: "Overview", show: true },
    {
      href: "/admin/products",
      label: "Products",
      show: staff.can("products.view") || staff.can("products.manage"),
    },
    { href: "/admin/tickets", label: "Tickets", show: staff.can("tickets.view") },
    { href: "/admin/staff", label: "Staff", show: staff.isMaster },
  ].filter((l) => l.show);

  return (
    <div className="mx-auto max-w-7xl px-5 sm:px-8 py-10">
      <header className="flex flex-wrap items-end justify-between gap-6 border-b border-rule pb-6">
        <div>
          <p className="eyebrow">
            {staff.isMaster ? "Master admin" : "Admin"} ·{" "}
            {staff.scopes.length} {staff.scopes.length === 1 ? "scope" : "scopes"}
          </p>
          <h1 className="display mt-2 text-3xl sm:text-4xl">Dashboard</h1>
          <p className="mt-2 text-sm text-ink-faint">
            {staff.fullName || staff.email} · {titleCase(staff.role)}
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Link
            href="/"
            className="rounded-full border border-rule-strong px-5 py-2.5 text-xs uppercase tracking-[0.18em] text-ink-dim hover:text-ink hover:border-ink transition-colors"
          >
            View store
          </Link>
          <form action={signOut}>
            <button
              type="submit"
              className="rounded-full border border-rule-strong px-5 py-2.5 text-xs uppercase tracking-[0.18em] text-ink-dim hover:text-ink hover:border-ink transition-colors"
            >
              Sign out
            </button>
          </form>
        </div>
      </header>

      <AdminNav links={links} />

      <div className="mt-8">{children}</div>
    </div>
  );
}
