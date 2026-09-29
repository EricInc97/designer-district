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

  /* The 3D district is staff-only while it is being built.
   *
   * It is a static file in public/, not a route, so nothing in the app
   * tree can guard it — this proxy is the only thing between it and the
   * open web. The matcher above excludes images and _next assets by
   * extension but not .html, so this request does reach here.
   *
   * Its artwork under /campaigns stays public: those are images, the
   * matcher skips them, and a folder of pictures is not the experience.
   * Gating the door is the point, not hiding the paint.
   */
  const isDistrict = pathname === "/index.html";
  const isProtected =
    pathname.startsWith("/account") || pathname.startsWith("/admin") || isDistrict;

  if (isProtected && !user) {
    const redirect = request.nextUrl.clone();
    redirect.pathname = "/login";
    redirect.searchParams.set("next", pathname);
    return NextResponse.redirect(redirect);
  }

  // Staff gate. Role lives in profiles, so we check it here rather than in JWT
  // claims, one indexed lookup, and it stays correct the instant a role changes.
  if ((pathname.startsWith("/admin") || isDistrict) && user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    if (profile?.role !== "admin" && profile?.role !== "master_admin") {
      const redirect = request.nextUrl.clone();
      // A signed-in customer who tries the district is sent to the shop
      // rather than to their account: they were not doing admin, they were
      // trying to look at something that is not open yet.
      redirect.pathname = isDistrict ? "/" : "/account";
      redirect.search = "";
      return NextResponse.redirect(redirect);
    }
  }

  return response;
}
