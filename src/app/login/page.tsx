"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get("next") || "/account";

  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  /* Set the moment a new account exists and is signed in.
   *
   * Signing up used to drop somebody straight onto the settings form with
   * no acknowledgement that anything had happened — the account was made,
   * the redirect fired, and the first thing a new customer saw was an empty
   * form asking for their address. This is the beat in between: it says the
   * account exists, says what is behind it, and then goes there.
   */
  const [welcome, setWelcome] = useState<string | null>(null);

  /* It moves on by itself, and it also has a button.
   *
   * The timer is the "then advance" half. The button is because a timer is
   * not a promise: a backgrounded tab throttles it, and anybody who reads
   * faster than four seconds should not have to wait for a screen that has
   * already told them everything.
   */
  useEffect(() => {
    if (welcome === null) return;
    const id = setTimeout(() => {
      router.push(next);
      router.refresh();
    }, 4000);
    return () => clearTimeout(id);
  }, [welcome, router, next]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setNotice(null);

    const supabase = createClient();

    if (mode === "signup") {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { full_name: fullName } },
      });

      if (error) {
        setError(error.message);
        setBusy(false);
        return;
      }

      /* The account exists; tell the CRM, and do not let it matter.
       *
       * Deliberately not awaited and deliberately swallowing its own
       * failure. The person is here to create an account, they have one,
       * and a marketing table being slow or down is not a reason to hold
       * the welcome screen or to show them an error about something they
       * never asked for. The endpoint answers 200 even when the write
       * failed, for the same reason; the reason comes back in the body
       * where logs and the network tab can see it.
       */
      void fetch("/api/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          name: fullName,
          source: "Signup",
          landingPage: next,
        }),
      }).catch(() => {});

      // With email confirmation on, there is no session yet.
      if (!data.session) {
        setNotice("Check your inbox to confirm your email, then sign in.");
        setMode("signin");
        setBusy(false);
        return;
      }

      // Confirmation is off on this project, so the account is live now.
      // Say so before moving them on.
      const first = (fullName.trim().split(/\s+/)[0] || "").trim();
      setWelcome(first);
      setBusy(false);
      return;
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        setError(error.message);
        setBusy(false);
        return;
      }
    }

    router.push(next);
    router.refresh();
  }

  if (welcome !== null) {
    return (
      <div className="mx-auto flex min-h-[70vh] max-w-md flex-col justify-center px-5 py-16">
        <p className="eyebrow">You are in</p>
        <h1 className="display mt-2 text-4xl">
          {welcome ? `Welcome, ${welcome}` : "Welcome"}
        </h1>
        <p className="mt-4 text-sm leading-relaxed text-ink-dim">
          Your account is open. Orders, store credit and support tickets all
          live in one place, and anything you add to the bag now stays with
          you.
        </p>

        <button
          type="button"
          onClick={() => {
            router.push(next);
            router.refresh();
          }}
          className="mt-9 flex w-full items-center justify-center rounded-full bg-ink px-6 py-3.5 text-xs font-semibold uppercase tracking-[0.2em] text-paper transition-opacity hover:opacity-90"
        >
          Go to my account
        </button>

        <Link
          href="/"
          className="mt-5 text-center text-xs uppercase tracking-[0.18em] text-ink-faint transition-colors hover:text-ink"
        >
          Keep shopping instead
        </Link>

        <p role="status" className="mt-8 text-center text-xs text-ink-faint">
          Taking you to your account&hellip;
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto flex min-h-[70vh] max-w-md flex-col justify-center px-5 py-16">
      <p className="eyebrow">
        {mode === "signin" ? "Welcome back" : "Join the district"}
      </p>
      <h1 className="display mt-2 text-4xl">
        {mode === "signin" ? "Sign in" : "Create account"}
      </h1>

      <form onSubmit={onSubmit} className="mt-9 space-y-4">
        {mode === "signup" && (
          <Field
            label="Full name"
            id="full_name"
            value={fullName}
            onChange={setFullName}
            autoComplete="name"
          />
        )}

        <Field
          label="Email"
          id="email"
          type="email"
          value={email}
          onChange={setEmail}
          autoComplete="email"
          required
        />

        <Field
          label="Password"
          id="password"
          type="password"
          value={password}
          onChange={setPassword}
          autoComplete={mode === "signin" ? "current-password" : "new-password"}
          required
          hint={mode === "signup" ? "At least 6 characters." : undefined}
        />

        {error && (
          <p role="alert" className="text-sm text-danger">
            {error}
          </p>
        )}
        {notice && (
          <p role="status" className="text-sm text-success">
            {notice}
          </p>
        )}

        <button
          type="submit"
          disabled={busy}
          className="flex w-full items-center justify-center gap-2 rounded-full bg-ink px-6 py-3.5 text-xs font-semibold uppercase tracking-[0.2em] text-paper hover:opacity-90 disabled:opacity-60 transition-colors"
        >
          {busy && <Loader2 size={14} className="animate-spin" aria-hidden />}
          {mode === "signin" ? "Sign in" : "Create account"}
        </button>
      </form>

      <p className="mt-6 text-sm text-ink-faint">
        {mode === "signin" ? "No account yet?" : "Already have an account?"}{" "}
        <button
          type="button"
          onClick={() => {
            setMode(mode === "signin" ? "signup" : "signin");
            setError(null);
          }}
          className="text-ink underline underline-offset-4 hover:no-underline"
        >
          {mode === "signin" ? "Create one" : "Sign in"}
        </button>
      </p>

      <Link
        href="/"
        className="mt-10 text-xs uppercase tracking-[0.18em] text-ink-faint hover:text-ink transition-colors"
      >
        ← Back to the store
      </Link>
    </div>
  );
}

function Field({
  label,
  id,
  value,
  onChange,
  type = "text",
  autoComplete,
  required,
  hint,
}: {
  label: string;
  id: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  autoComplete?: string;
  required?: boolean;
  hint?: string;
}) {
  return (
    <div>
      <label htmlFor={id} className="eyebrow">
        {label}
      </label>
      <input
        id={id}
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        autoComplete={autoComplete}
        required={required}
        className="mt-2 w-full rounded-lg border border-rule bg-paper-raised px-4 py-3 text-sm text-ink outline-none placeholder:text-ink-faint focus:border-ink-faint transition-colors"
      />
      {hint && <p className="mt-1.5 text-xs text-ink-faint">{hint}</p>}
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}
