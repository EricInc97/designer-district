import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "@/lib/types";

let cached: ReturnType<typeof createBrowserClient<Database>> | undefined;

/** Browser Supabase client. Singleton so realtime channels are shared. */
export function createClient() {
  cached ??= createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
  return cached;
}
