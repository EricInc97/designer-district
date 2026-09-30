import Link from "next/link";
import { User } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { supabaseConfigured } from "@/lib/supabase/config";
import SiteMenu from "@/components/SiteMenu";
import CartButton from "@/components/CartButton";
import type { Brand, Category } from "@/lib/types";

export default async function Navbar() {
  let user = null;
  let isStaff = false;
  let brands: Brand[] = [];
  let categories: Category[] = [];

  if (supabaseConfigured) {
    const supabase = await createClient();
    ({
      data: { user },
    } = await supabase.auth.getUser());

    const [{ data: brandRows }, { data: categoryRows }, profile] = await Promise.all([
      // Only houses that can be shopped; the district's own brand row has
      // artwork in the 3D street but nothing to sell. See app/page.tsx.
      supabase.from("shoppable_brands").select("*").order("sort_order"),
      supabase.from("categories").select("*").order("sort_order"),
      user
        ? supabase.from("profiles").select("role").eq("id", user.id).single()
        : Promise.resolve({ data: null }),
    ]);

    brands = (brandRows ?? []) as Brand[];
    categories = (categoryRows ?? []) as Category[];
    const role = (profile as { data: { role?: string } | null }).data?.role;
    isStaff = role === "admin" || role === "master_admin";
  }

  return (
    <header className="sticky top-0 z-40 border-b border-rule bg-paper">
      <div className="mx-auto max-w-7xl px-4 sm:px-8">
        {/* Three fixed columns so the wordmark stays optically centred no
            matter how wide the flanking controls get. */}
        <div className="grid h-16 grid-cols-[1fr_auto_1fr] items-center gap-3">
          <div className="flex justify-start">
            <SiteMenu
              brands={brands}
              categories={categories}
              isSignedIn={Boolean(user)}
              isStaff={isStaff}
            />
          </div>

          <Link
            href="/"
            aria-label="Designer District, home"
            className="justify-self-center transition-opacity hover:opacity-80"
          >
            {/* The wordmark cut straight from the logo, so the lettering and
                its slits match exactly rather than approximating the face.
                The ink cut, not the white one: the bar is paper now. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/brand/designer-district-wordmark.png"
              alt="Designer District"
              width={900}
              height={61}
              className="h-[18px] w-auto sm:h-[22px]"
            />
          </Link>

          <nav aria-label="Account and cart" className="flex items-center justify-end gap-1">
            <Link
              href={user ? "/account" : "/login"}
              className="grid h-10 w-10 place-items-center rounded-full text-ink-dim transition-colors hover:bg-paper-sunken hover:text-ink"
              aria-label={user ? "Your account" : "Sign in"}
            >
              <User size={19} strokeWidth={1.6} aria-hidden />
            </Link>

            <CartButton />
          </nav>
        </div>
      </div>
    </header>
  );
}
