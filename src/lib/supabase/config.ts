/**
 * True once .env.local carries a real Supabase project. Pages check this so the
 * storefront renders a setup notice instead of crashing before the project
 * exists, see README.md for the four-step setup.
 */
export const supabaseConfigured = Boolean(
  process.env.NEXT_PUBLIC_SUPABASE_URL &&
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY &&
    !process.env.NEXT_PUBLIC_SUPABASE_URL.includes("your-project-ref"),
);
