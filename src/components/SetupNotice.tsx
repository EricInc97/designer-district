const steps = [
  {
    n: "01",
    title: "Create the project",
    body: "supabase.com/dashboard → New project. Note the project ref and database password.",
  },
  {
    n: "02",
    title: "Add the keys",
    body: "Settings → API. Copy the Project URL and anon key into .env.local.",
  },
  {
    n: "03",
    title: "Run the SQL",
    body: "SQL Editor → paste supabase/01_schema.sql, then 02_rls.sql, then 03_seed.sql.",
  },
  {
    n: "04",
    title: "Make yourself master admin",
    body: "Sign up in the app, then: update public.profiles set role = 'master_admin' where email = 'you@example.com';",
  },
];

export default function SetupNotice() {
  return (
    <section className="mx-auto max-w-3xl px-5 sm:px-8 py-20">
      <p className="eyebrow">Setup required</p>
      <h1 className="display mt-3 text-4xl sm:text-5xl">Connect Supabase</h1>
      <p className="mt-4 max-w-xl text-sm leading-relaxed text-ink-dim">
        The storefront is built and waiting on a database. Four steps and the
        catalog, cart, tickets and admin dashboard all come alive.
      </p>

      <ol className="mt-10 space-y-px overflow-hidden rounded-xl border border-rule">
        {steps.map((step) => (
          <li
            key={step.n}
            className="flex gap-5 bg-paper-raised px-5 py-5 border-b border-rule last:border-0"
          >
            <span className="font-mono text-xs text-ink-faint pt-0.5">{step.n}</span>
            <span>
              <span className="block text-sm font-medium">{step.title}</span>
              <span className="mt-1 block font-mono text-xs leading-relaxed text-ink-faint break-words">
                {step.body}
              </span>
            </span>
          </li>
        ))}
      </ol>
    </section>
  );
}
