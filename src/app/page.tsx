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
      {/*
        The Fly's Eye Dome in the Miami Design District: the building the mark
        was drawn from, so the homepage opens on the thing itself rather than a
        stock backdrop.

        It is washed out in the file, not only in CSS — desaturated and lifted
        until its darkest pixel is a pale grey — so it behaves like paper stock
        rather than a photograph, and so it still reads correctly if a gradient
        fails to paint. The scrims then dissolve its edges into the page: a
        radial one that clears the centre for the lockup and closes to solid
        paper at the corners, and a taller fade at the foot so there is no seam
        where the hero ends and the brand grid begins. No bottom rule for the
        same reason.
      */}
      <section className="relative isolate overflow-hidden">
        <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
          {/* Two crops rather than one. The frame is landscape, and a phone
              hero is portrait, so a single file cover-cropped would slice the
              dome down to a few cells. The tall cut is centred on the dome. */}
          <picture>
            <source
              media="(max-width: 639px)"
              srcSet="/brand/flys-eye-dome-tall.jpg"
            />
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/brand/flys-eye-dome.jpg"
              alt=""
              fetchPriority="high"
              className="animate-fade-in h-full w-full object-cover object-[50%_45%]"
            />
          </picture>

          <div
            className="absolute inset-0"
            style={{
              background:
                "radial-gradient(105% 85% at 50% 46%, rgba(255,255,255,0) 0%, rgba(255,255,255,0.12) 55%, rgba(255,255,255,0.55) 82%, var(--paper) 100%)",
            }}
          />
          <div
            className="absolute inset-x-0 top-0 h-16 sm:h-24"
            style={{
              background:
                "linear-gradient(to bottom, rgba(255,255,255,0.85) 0%, rgba(255,255,255,0) 100%)",
            }}
          />
          <div
            className="absolute inset-x-0 bottom-0 h-52 sm:h-64"
            style={{
              background:
                "linear-gradient(to top, var(--paper) 35%, rgba(255,255,255,0.75) 62%, rgba(255,255,255,0) 100%)",
            }}
          />
        </div>

        <div className="mx-auto flex max-w-7xl flex-col items-center px-5 py-20 text-center sm:px-8 sm:py-24">
          {/* The transparent-ground artwork on a black disc, rather than the
              square original: the lockup is wider than it is tall, so a
              circular crop of the original would clip the wordmark. Held at
              72% of the diameter to keep its corners inside the curve. The
              disc now sits on the photograph, so it carries a soft shadow to
              keep it from looking pasted on, and it is held in from the full
              column width on a phone: at max-w-sm it covered the dome behind
              it edge to edge and the photograph read as nothing but a strip of
              palm. Smaller, the dome shows as a ring around the disc, which is
              the same composition the desktop hero has. */}
          <div className="grid aspect-square w-full max-w-[17.5rem] animate-rise place-items-center rounded-full bg-ink shadow-[0_30px_90px_-40px_rgba(11,11,11,0.75)] sm:max-w-md">
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
            className="mt-8 max-w-md animate-rise text-base font-semibold leading-relaxed text-ink sm:text-lg"
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
