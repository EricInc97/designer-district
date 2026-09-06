import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { supabaseConfigured } from "@/lib/supabase/config";
import SetupNotice from "@/components/SetupNotice";
import BrandTile from "@/components/BrandTile";
import type { Brand } from "@/lib/types";

export default async function HomePage() {
  if (!supabaseConfigured) return <SetupNotice />;

  const supabase = await createClient();
  const { data: brands } = await supabase
    .from("brands")
    .select("*")
    .eq("is_active", true)
    .order("sort_order", { ascending: true });

  const brandList = (brands ?? []) as Brand[];

  return (
    <>
      {/* ---------------- HERO ---------------- */}
      <section className="border-b border-rule">
        <div className="mx-auto flex max-w-7xl flex-col items-center px-5 sm:px-8 py-20 sm:py-28 text-center">
          {/* A circular rule around a black disc. The transparent-background
              artwork is used rather than the square original, so the disc can
              be a true circle without the wordmark being clipped by the crop:
              the lockup is wider than it is tall, so it is held at 72% of the
              diameter to keep its corners inside the curve. */}
          <div className="grid aspect-square w-full max-w-sm animate-rise place-items-center rounded-full bg-ink sm:max-w-md">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/brand/designer-district-on-dark.png"
              alt="Designer District"
              width={800}
              height={618}
              fetchPriority="high"
              className="w-[72%]"
            />
          </div>

          <p
            className="mt-10 max-w-md text-base leading-relaxed text-ink-dim animate-rise"
            style={{ animationDelay: "80ms" }}
          >
            The house of the most wanted names in streetwear.
          </p>

          <div className="mt-10 animate-rise" style={{ animationDelay: "140ms" }}>
            <Link
              href="#brands"
              className="inline-flex items-center gap-2 rounded-full bg-ink px-8 py-4 text-xs font-semibold uppercase tracking-[0.2em] text-paper transition-colors hover:opacity-90"
            >
              Shop by brand
              <ArrowRight size={14} aria-hidden />
            </Link>
          </div>
        </div>
      </section>

      {/* ---------------- SHOP BY BRAND ---------------- */}
      {/* The only way into the catalog. Pick a house first. */}
      <section id="brands" className="mx-auto max-w-7xl px-5 sm:px-8 py-20 scroll-mt-20">
        <p className="eyebrow">The roster</p>
        <h1 className="display mt-2 text-3xl sm:text-4xl">Shop by brand</h1>
        <p className="mt-3 max-w-md text-sm text-ink-faint">
          Choose a house to see everything we hold from it: tees, hoodies,
          outerwear, denim and accessories.
        </p>

        {brandList.length === 0 ? (
          <p className="mt-10 text-sm text-ink-faint">
            No brands yet. Run <code className="font-mono">supabase/03_seed.sql</code> to
            load the catalog.
          </p>
        ) : (
          <ul className="mt-10 grid grid-cols-3 gap-2 sm:gap-4">
            {brandList.map((brand) => (
              <li key={brand.id}>
                <BrandTile brand={brand} />
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
