import "server-only";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * The service role client.
 *
 * `import "server-only"` at the top is the hard guard: if any Client Component
 * ever imports this file, even transitively, the build fails rather than
 * quietly shipping a key that bypasses Row Level Security to the browser.
 *
 * Neither variable is NEXT_PUBLIC_, so they are not inlined into client
 * bundles either. Belt and braces, deliberately.
 */

let cached: SupabaseClient | null = null;

export function getServiceClient(): SupabaseClient | null {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  // Capture is optional. With the keys unset the app runs exactly as it did
  // before Supabase existed, so a fresh clone needs no setup to be useful.
  if (!url || !key) return null;

  cached ??= createClient(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
    global: {
      headers: { "x-application-name": "copy-master" },
    },
  });

  return cached;
}

/**
 * Whether to store the raw copy alongside the derived metrics.
 *
 * Checked here as well as in the browser: the client only sends a sample when
 * its own flag is on, and the server drops it unless this one is too. Either
 * switch being off means nothing is written.
 */
export function captureTextSamples(): boolean {
  return process.env.CAPTURE_TEXT_SAMPLES === "true";
}
