"use client";

import { useActionState } from "react";
import { Loader2 } from "lucide-react";
import { updateProfile, updateEmail, type ActionResult } from "@/app/account/actions";
import type { Profile } from "@/lib/types";

function Input({
  label,
  name,
  defaultValue,
  type = "text",
  autoComplete,
  className = "",
}: {
  label: string;
  name: string;
  defaultValue?: string | null;
  type?: string;
  autoComplete?: string;
  className?: string;
}) {
  return (
    <div className={className}>
      <label htmlFor={name} className="eyebrow">
        {label}
      </label>
      <input
        id={name}
        name={name}
        type={type}
        defaultValue={defaultValue ?? ""}
        autoComplete={autoComplete}
        className="mt-2 w-full rounded-lg border border-rule bg-paper-raised px-4 py-3 text-sm text-ink outline-none placeholder:text-ink-faint focus:border-ink-faint transition-colors"
      />
    </div>
  );
}

function Status({ state }: { state: ActionResult }) {
  if (!state) return null;
  return (
    <p
      role="status"
      className={`text-sm ${state.ok ? "text-success" : "text-danger"}`}
    >
      {state.message}
    </p>
  );
}

export default function SettingsForm({ profile }: { profile: Profile | null }) {
  const [profileState, saveProfile, savingProfile] = useActionState(
    updateProfile,
    null,
  );
  const [emailState, saveEmail, savingEmail] = useActionState(updateEmail, null);

  return (
    <div className="grid gap-10 lg:grid-cols-2">
      {/* ---------------- CONTACT + ADDRESS ---------------- */}
      <form action={saveProfile} className="space-y-5">
        <div>
          <h2 className="display text-xl">Details</h2>
          <p className="mt-1.5 text-sm text-ink-faint">
            Where your orders go and how we reach you about them.
          </p>
        </div>

        <Input
          label="Full name"
          name="full_name"
          defaultValue={profile?.full_name}
          autoComplete="name"
        />
        <Input
          label="Phone"
          name="phone"
          type="tel"
          defaultValue={profile?.phone}
          autoComplete="tel"
        />
        <Input
          label="Address"
          name="address_line1"
          defaultValue={profile?.address_line1}
          autoComplete="address-line1"
        />
        <Input
          label="Apt, suite (optional)"
          name="address_line2"
          defaultValue={profile?.address_line2}
          autoComplete="address-line2"
        />

        <div className="grid grid-cols-2 gap-4">
          <Input
            label="City"
            name="city"
            defaultValue={profile?.city}
            autoComplete="address-level2"
          />
          <Input
            label="State"
            name="state"
            defaultValue={profile?.state}
            autoComplete="address-level1"
          />
          <Input
            label="Postal code"
            name="postal_code"
            defaultValue={profile?.postal_code}
            autoComplete="postal-code"
          />
          <Input
            label="Country"
            name="country"
            defaultValue={profile?.country}
            autoComplete="country-name"
          />
        </div>

        <Status state={profileState} />

        <button
          type="submit"
          disabled={savingProfile}
          className="inline-flex items-center gap-2 rounded-full bg-ink px-7 py-3 text-xs font-semibold uppercase tracking-[0.2em] text-paper hover:opacity-90 disabled:opacity-60 transition-colors"
        >
          {savingProfile && <Loader2 size={13} className="animate-spin" aria-hidden />}
          Save details
        </button>
      </form>

      {/* ---------------- EMAIL ---------------- */}
      <div className="space-y-10">
        <form action={saveEmail} className="space-y-5">
          <div>
            <h2 className="display text-xl">Login email</h2>
            <p className="mt-1.5 text-sm text-ink-faint">
              We send a confirmation link before the change takes effect.
            </p>
          </div>

          <Input
            label="Email address"
            name="email"
            type="email"
            defaultValue={profile?.email}
            autoComplete="email"
          />

          <Status state={emailState} />

          <button
            type="submit"
            disabled={savingEmail}
            className="inline-flex items-center gap-2 rounded-full border border-rule-strong px-7 py-3 text-xs font-semibold uppercase tracking-[0.2em] hover:bg-ink hover:text-paper disabled:opacity-60 transition-colors"
          >
            {savingEmail && <Loader2 size={13} className="animate-spin" aria-hidden />}
            Update email
          </button>
        </form>
      </div>
    </div>
  );
}
