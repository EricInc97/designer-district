import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE } from "@/lib/constants";
import { supabaseConfigured } from "@/lib/supabase/config";

/** Anonymous visitors still get a stable id so recommendations work pre-login. */
function ensureSessionCookie(request: NextRequest, response: NextResponse) {
  if (request.cookies.get(SESSION_COOKIE)) return;
  response.cookies.set(SESSION_COOKIE, crypto.randomUUID(), {
    httpOnly: false, // the client tracker reads it too
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });
}

/**
 * Runs from proxy.ts. Refreshes the Supabase auth cookie on every request, mints an anonymous
 * session id for behaviour tracking, and gates /account and /admin.
 */
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  // Before the Supabase project exists the storefront still renders its setup
  // notice; skip auth entirely rather than throwing on an undefined URL.
  if (!supabaseConfigured) {
    ensureSessionCookie(request, response);
    return response;
  }

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // Do not remove: this refreshes the token and is what keeps SSR authed.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  ensureSessionCookie(request, response);

  const { pathname } = request.nextUrl;
  const isProtected = pathname.startsWith("/account") || pathname.startsWith("/admin");

  if (isProtected && !user) {
    const redirect = request.nextUrl.clone();
    redirect.pathname = "/login";
    redirect.searchParams.set("next", pathname);
    return NextResponse.redirect(redirect);
  }

  // Staff gate. Role lives in profiles, so we check it here rather than in JWT
  // claims, one indexed lookup, and it stays correct the instant a role changes.
  if (pathname.startsWith("/admin") && user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    if (profile?.role !== "admin" && profile?.role !== "master_admin") {
      const redirect = request.nextUrl.clone();
      redirect.pathname = "/account";
      redirect.search = "";
      return NextResponse.redirect(redirect);
    }
  }

  return response;
}
