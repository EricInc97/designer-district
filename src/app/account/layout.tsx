import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { supabaseConfigured } from "@/lib/supabase/config";
import SetupNotice from "@/components/SetupNotice";
import AccountNav from "@/components/AccountNav";
import { signOut } from "@/app/account/actions";
import { money } from "@/lib/format";
import type { Profile } from "@/lib/types";

export default async function AccountLayout({ children }: LayoutProps<"/account">) {
  if (!supabaseConfigured) return <SetupNotice />;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login?next=/account");

  const { data } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single<Profile>();

  const profile = data;

  return (
    <div className="mx-auto max-w-6xl px-5 sm:px-8 py-12">
      <header className="flex flex-wrap items-end justify-between gap-6 border-b border-rule pb-8">
        <div>
          <p className="eyebrow">Your account</p>
          <h1 className="display mt-2 text-3xl sm:text-4xl">
            {profile?.full_name || user.email}
          </h1>
          <p className="mt-2 text-sm text-ink-faint">{user.email}</p>
        </div>

        <div className="flex items-center gap-6">
          <div className="text-right">
            <p className="eyebrow">Store credit</p>
            <p className="mt-1 text-2xl tabular-nums">
              {money(profile?.store_credit ?? 0)}
            </p>
          </div>

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

      <AccountNav />

      <div className="mt-8">{children}</div>
    </div>
  );
}
