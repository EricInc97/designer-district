import { Dashboard } from "@/components/dashboard";

/**
 * The page itself is a Server Component and ships no logic. Everything below
 * it is interactive and runs on the client, which keeps this route fully
 * static: there is no data to fetch and nothing to render per request.
 */
export default function Home() {
  return <Dashboard />;
}
