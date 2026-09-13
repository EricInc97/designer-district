import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import SettingsForm from "@/components/SettingsForm";
import PersonalisationToggle from "@/components/PersonalisationToggle";
import { money, dateShort, titleCase } from "@/lib/format";
import type { Profile, CreditEntry } from "@/lib/types";

export const metadata: Metadata = { title: "Settings" };

export default async function AccountSettingsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [{ data: profile }, { data: credit }] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", user!.id).single<Profile>(),
    supabase
      .from("credit_ledger")
      .select("*")
      .eq("user_id", user!.id)
      .order("created_at", { ascending: false })
      .limit(10),
  ]);

  const ledger = (credit ?? []) as CreditEntry[];

  return (
    <div className="space-y-14">
      <SettingsForm profile={profile ?? null} />

      <PersonalisationToggle
        consent={profile?.personalisation_consent ?? null}
      />

      {ledger.length > 0 && (
        <section className="border-t border-rule pt-10">
          <h2 className="display text-xl">Store credit history</h2>
          <ul className="mt-5 divide-y divide-rule overflow-hidden rounded-xl border border-rule">
            {ledger.map((entry) => (
              <li
                key={entry.id}
                className="flex items-center justify-between gap-4 bg-paper-raised px-5 py-4"
              >
                <div className="min-w-0">
                  <p className="text-sm">
                    {entry.note || titleCase(entry.reason)}
                  </p>
                  <p className="mt-0.5 text-xs text-ink-faint">
                    {dateShort(entry.created_at)} · {titleCase(entry.reason)}
                  </p>
                </div>
                <p
                  className={`shrink-0 text-sm tabular-nums ${
                    entry.amount >= 0 ? "text-success" : "text-ink-dim"
                  }`}
                >
                  {entry.amount >= 0 ? "+" : "−"}
                  {money(Math.abs(entry.amount))}
                </p>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
