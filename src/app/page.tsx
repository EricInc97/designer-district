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
        <div className="mx-auto flex max-w-7xl flex-col items-center px-5 sm:px-8 py-14 sm:py-20 text-center">
          {/* The transparent-ground artwork on a black disc, rather than the
              square original: the lockup is wider than it is tall, so a
              circular crop of the original would clip the wordmark. Held at
              72% of the diameter to keep its corners inside the curve. */}
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

          {/* Medium weight rather than semibold: enough to carry under the
              logo without competing with it. */}
          <p
            className="mt-8 max-w-md animate-rise text-base font-medium leading-relaxed text-ink-dim sm:text-lg"
            style={{ animationDelay: "80ms" }}
          >
            At Designer District we carry a wide variety of exclusive brands.
          </p>
        </div>
      </section>

      {/* ---------------- SHOP BY BRAND ---------------- */}
      {/* The only way into the catalog. Pick a house first. */}
      <section
        id="brands"
        className="mx-auto max-w-7xl scroll-mt-20 px-5 pb-16 pt-10 sm:px-8 sm:pb-20 sm:pt-12"
      >
        {/* Centred and tightened: the block reads as one unit rather than
            three widely spaced lines. */}
        <div className="mx-auto max-w-xl text-center">
          <p className="eyebrow">The Collection</p>
          <h1 className="display mt-1.5 text-3xl sm:text-4xl">Shop by brand</h1>
        </div>

        {brandList.length === 0 ? (
          <p className="mt-8 text-center text-sm text-ink-faint">
            No brands yet. Run <code className="font-mono">supabase/03_seed.sql</code> to
            load the catalog.
          </p>
        ) : (
          <ul className="mt-8 grid grid-cols-3 gap-2 sm:gap-4">
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
