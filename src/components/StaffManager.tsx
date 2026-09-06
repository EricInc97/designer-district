"use client";

import { useActionState, useState } from "react";
import { Loader2, ShieldCheck, UserPlus } from "lucide-react";
import { setStaffAccess, type AdminResult } from "@/app/admin/actions";
import { titleCase } from "@/lib/format";
import type { AppScope, Profile, UserRole } from "@/lib/types";

type StaffMember = Profile & { held: string[] };

type Props = {
  staff: StaffMember[];
  customers: Profile[];
  scopes: AppScope[];
  currentUserId: string;
};

/** One editable access form, role plus the exact scope set. */
function AccessForm({
  person,
  scopes,
  heldScopes,
  isSelf,
  defaultRole,
  onDone,
}: {
  person: Profile;
  scopes: AppScope[];
  heldScopes: string[];
  isSelf: boolean;
  defaultRole: UserRole;
  onDone?: () => void;
}) {
  const [state, submit, busy] = useActionState<AdminResult, FormData>(
    setStaffAccess,
    null,
  );
  const [role, setRole] = useState<UserRole>(defaultRole);

  const grouped = scopes.reduce<Record<string, AppScope[]>>((acc, scope) => {
    (acc[scope.category] ??= []).push(scope);
    return acc;
  }, {});

  return (
    <form action={submit} className="space-y-5">
      <input type="hidden" name="user_id" value={person.id} />

      <div className="flex flex-wrap items-center gap-4">
        <div>
          <label htmlFor={`role-${person.id}`} className="eyebrow">
            Role
          </label>
          <select
            id={`role-${person.id}`}
            name="role"
            value={role}
            onChange={(e) => setRole(e.target.value as UserRole)}
            disabled={isSelf}
            className="mt-2 rounded-lg border border-rule bg-paper px-4 py-2.5 text-sm outline-none focus:border-ink-faint disabled:opacity-50 transition-colors"
          >
            <option value="customer">Customer (no admin access)</option>
            <option value="admin">Admin</option>
            <option value="master_admin">Master admin</option>
          </select>
          {isSelf && (
            <p className="mt-1.5 text-xs text-ink-faint">
              You cannot change your own role.
            </p>
          )}
        </div>
      </div>

      {role === "master_admin" && (
        <p className="flex items-start gap-2 rounded-lg border border-rule bg-paper px-4 py-3 text-xs text-ink-dim">
          <ShieldCheck size={14} className="mt-0.5 shrink-0" aria-hidden />
          A master admin implicitly holds every scope, including any added later.
          Individual scopes below are ignored for this role.
        </p>
      )}

      {role === "admin" && (
        <div className="space-y-5">
          {Object.entries(grouped).map(([category, list]) => (
            <fieldset key={category}>
              <legend className="eyebrow">{category}</legend>
              <div className="mt-3 grid gap-2.5 sm:grid-cols-2">
                {list.map((scope) => (
                  <label
                    key={scope.key}
                    className="flex cursor-pointer items-start gap-3 rounded-lg border border-rule bg-paper px-3.5 py-3 transition-colors hover:border-rule-strong"
                  >
                    <input
                      type="checkbox"
                      name="scopes"
                      value={scope.key}
                      defaultChecked={heldScopes.includes(scope.key)}
                      className="mt-0.5 h-4 w-4 shrink-0 accent-[var(--ink)]"
                    />
                    <span className="min-w-0">
                      <span className="block text-sm">{scope.label}</span>
                      <span className="mt-0.5 block font-mono text-[10px] text-ink-faint">
                        {scope.key}
                      </span>
                      {scope.description && (
                        <span className="mt-1 block text-xs leading-relaxed text-ink-faint">
                          {scope.description}
                        </span>
                      )}
                    </span>
                  </label>
                ))}
              </div>
            </fieldset>
          ))}
        </div>
      )}

      {state && (
        <p
          role="status"
          className={`text-sm ${state.ok ? "text-success" : "text-danger"}`}
        >
          {state.message}
        </p>
      )}

      <div className="flex gap-3">
        <button
          type="submit"
          disabled={busy}
          className="inline-flex items-center gap-2 rounded-full bg-ink px-6 py-3 text-xs font-semibold uppercase tracking-[0.2em] text-paper hover:opacity-90 disabled:opacity-60 transition-colors"
        >
          {busy && <Loader2 size={13} className="animate-spin" aria-hidden />}
          Save access
        </button>
        {onDone && (
          <button
            type="button"
            onClick={onDone}
            className="rounded-full border border-rule-strong px-6 py-3 text-xs uppercase tracking-[0.2em] text-ink-dim hover:text-ink transition-colors"
          >
            Cancel
          </button>
        )}
      </div>
    </form>
  );
}

export default function StaffManager({
  staff,
  customers,
  scopes,
  currentUserId,
}: Props) {
  const [editing, setEditing] = useState<string | null>(null);
  const [promoting, setPromoting] = useState<Profile | null>(null);
  const [filter, setFilter] = useState("");

  const matches = filter.trim()
    ? customers
        .filter((c) =>
          `${c.email ?? ""} ${c.full_name ?? ""}`
            .toLowerCase()
            .includes(filter.trim().toLowerCase()),
        )
        .slice(0, 8)
    : [];

  return (
    <div className="space-y-10">
      {/* ---------------- TEAM ---------------- */}
      <section>
        <h2 className="display text-xl">Team</h2>
        <p className="mt-1.5 text-sm text-ink-faint">
          {staff.length} {staff.length === 1 ? "person" : "people"} with dashboard
          access.
        </p>

        <ul className="mt-6 space-y-3">
          {staff.map((person) => (
            <li
              key={person.id}
              className="overflow-hidden rounded-xl border border-rule bg-paper-raised"
            >
              <div className="flex flex-wrap items-center justify-between gap-4 px-5 py-4">
                <div className="min-w-0">
                  <p className="text-sm">
                    {person.full_name || person.email}
                    {person.id === currentUserId && (
                      <span className="ml-2 text-xs text-ink-faint">(you)</span>
                    )}
                  </p>
                  <p className="mt-0.5 text-xs text-ink-faint">
                    {person.email} · {titleCase(person.role)} ·{" "}
                    {person.role === "master_admin"
                      ? "all scopes"
                      : `${person.held.length} scopes`}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() =>
                    setEditing(editing === person.id ? null : person.id)
                  }
                  aria-expanded={editing === person.id}
                  className="rounded-full border border-rule-strong px-5 py-2 text-[11px] uppercase tracking-[0.16em] text-ink-dim hover:text-ink hover:border-ink transition-colors"
                >
                  {editing === person.id ? "Close" : "Edit access"}
                </button>
              </div>

              {person.role === "admin" && person.held.length > 0 && (
                <ul className="flex flex-wrap gap-1.5 border-t border-rule px-5 py-3">
                  {person.held.map((key) => (
                    <li
                      key={key}
                      className="rounded-full border border-rule px-2.5 py-1 font-mono text-[10px] text-ink-faint"
                    >
                      {key}
                    </li>
                  ))}
                </ul>
              )}

              {editing === person.id && (
                <div className="border-t border-rule p-5 animate-fade-in">
                  <AccessForm
                    person={person}
                    scopes={scopes}
                    heldScopes={person.held}
                    isSelf={person.id === currentUserId}
                    defaultRole={person.role}
                    onDone={() => setEditing(null)}
                  />
                </div>
              )}
            </li>
          ))}
        </ul>
      </section>

      {/* ---------------- ADD ---------------- */}
      <section className="border-t border-rule pt-10">
        <h2 className="display text-xl">Add an employee</h2>
        <p className="mt-1.5 max-w-2xl text-sm text-ink-faint">
          People join by signing up on the storefront first. Accounts are always
          created by the person who owns the email. Find them here and grant
          access.
        </p>

        <div className="mt-6 max-w-md">
          <label htmlFor="staff-search" className="eyebrow">
            Find a customer
          </label>
          <input
            id="staff-search"
            value={filter}
            onChange={(e) => {
              setFilter(e.target.value);
              setPromoting(null);
            }}
            placeholder="Search by name or email…"
            className="mt-2 w-full rounded-lg border border-rule bg-paper-raised px-4 py-3 text-sm text-ink outline-none placeholder:text-ink-faint focus:border-ink-faint transition-colors"
          />
        </div>

        {filter.trim() && matches.length === 0 && (
          <p className="mt-4 text-sm text-ink-faint">
            No customer account matches “{filter.trim()}”.
          </p>
        )}

        {matches.length > 0 && (
          <ul className="mt-4 max-w-md divide-y divide-rule overflow-hidden rounded-xl border border-rule">
            {matches.map((person) => (
              <li
                key={person.id}
                className="flex items-center justify-between gap-4 bg-paper-raised px-4 py-3"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm">{person.full_name || "Not provided"}</p>
                  <p className="truncate text-xs text-ink-faint">{person.email}</p>
                </div>
                <button
                  type="button"
                  onClick={() => setPromoting(person)}
                  className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-rule-strong px-4 py-1.5 text-[11px] uppercase tracking-[0.16em] text-ink-dim hover:text-ink hover:border-ink transition-colors"
                >
                  <UserPlus size={12} aria-hidden />
                  Grant
                </button>
              </li>
            ))}
          </ul>
        )}

        {promoting && (
          <div className="mt-6 rounded-xl border border-rule bg-paper-raised p-5 animate-fade-in">
            <p className="text-sm">
              Granting access to{" "}
              <span className="font-medium">
                {promoting.full_name || promoting.email}
              </span>
            </p>
            <div className="mt-5">
              <AccessForm
                person={promoting}
                scopes={scopes}
                heldScopes={[]}
                isSelf={false}
                defaultRole="admin"
                onDone={() => setPromoting(null)}
              />
            </div>
          </div>
        )}
      </section>

      {/* ---------------- SCOPE REFERENCE ---------------- */}
      <section className="border-t border-rule pt-10">
        <h2 className="display text-xl">Scope list</h2>
        <p className="mt-1.5 text-sm text-ink-faint">
          Every permission the dashboard understands. Enforced in Postgres, not
          just in the UI.
        </p>

        <div className="mt-6 overflow-x-auto scroll-thin rounded-xl border border-rule">
          <table className="w-full min-w-[36rem] text-left">
            <thead>
              <tr className="border-b border-rule bg-paper-raised">
                <th className="px-5 py-3 text-[11px] uppercase tracking-[0.18em] text-ink-faint">
                  Scope
                </th>
                <th className="px-5 py-3 text-[11px] uppercase tracking-[0.18em] text-ink-faint">
                  Grants
                </th>
                <th className="px-5 py-3 text-[11px] uppercase tracking-[0.18em] text-ink-faint">
                  Area
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-rule">
              {scopes.map((scope) => (
                <tr key={scope.key} className="bg-paper-raised">
                  <td className="px-5 py-3 align-top font-mono text-xs text-ink">
                    {scope.key}
                  </td>
                  <td className="px-5 py-3 align-top text-sm text-ink-dim">
                    {scope.description ?? scope.label}
                  </td>
                  <td className="px-5 py-3 align-top text-xs text-ink-faint">
                    {scope.category}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
