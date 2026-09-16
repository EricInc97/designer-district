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
      {/* ---------------- BACKDROP ---------------- */}
      {/*
        The Fly's Eye Dome in the Miami Design District: the building the mark
        was drawn from, at full colour behind the whole homepage.

        Fixed rather than scrolled, so the page moves over a still photograph.
        This is a `position: fixed` layer with the image cover-cropped inside
        it, not `background-attachment: fixed`, which iOS Safari has never
        supported and which stutters badly on the browsers that do.

        No scrims. The photograph is the surface here, so everything that used
        to sit on paper — the two lines of copy — is set in white instead, and
        the footer carries its own paper ground so the page still ends on
        something solid.
      */}
      <div aria-hidden className="fixed inset-0 z-0">
        {/* Two crops rather than one. The frame is landscape, and a phone
            viewport is portrait, so a single file cover-cropped would slice
            the dome down to a few cells. The tall cut is centred on it. */}
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
            className="h-full w-full object-cover object-[50%_45%]"
          />
        </picture>
      </div>

      {/* Everything below rides above that layer. */}
      <div className="relative z-10">

      {/* ---------------- HERO ---------------- */}
      <section className="relative">
        <div className="mx-auto flex max-w-7xl flex-col items-center px-5 py-20 text-center sm:px-8 sm:py-24">
          {/* The transparent-ground artwork on a black disc, rather than the
              square original: the lockup is wider than it is tall, so a
              circular crop of the original would clip the wordmark. Held at
              72% of the diameter to keep its corners inside the curve. The
              disc sits on the photograph, so it carries a soft shadow to keep
              it from looking pasted on, and it is held in from the full column
              width on a phone: at max-w-sm it covered the dome behind it edge
              to edge. Smaller, the dome shows as a ring around the disc. */}
          <div className="grid aspect-square w-full max-w-[17.5rem] animate-rise place-items-center rounded-full bg-ink shadow-[0_30px_90px_-40px_rgba(0,0,0,0.9)] sm:max-w-md">
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

          {/* White on a photograph needs more than colour: the shadow is what
              holds it together over the bright cells of the dome. */}
          <p
            className="mt-8 max-w-md animate-rise text-base font-semibold leading-relaxed text-white [text-shadow:0_1px_3px_rgba(0,0,0,0.95),0_2px_10px_rgba(0,0,0,0.9),0_0_36px_rgba(0,0,0,0.75)] sm:text-lg"
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
        <div className="mx-auto max-w-xl text-center [text-shadow:0_1px_3px_rgba(0,0,0,0.95),0_2px_10px_rgba(0,0,0,0.9),0_0_36px_rgba(0,0,0,0.75)]">
          <p className="eyebrow !text-white/80">The Collection</p>
          <h1 className="display mt-1.5 text-3xl text-white sm:text-4xl">
            Shop by brand
          </h1>
        </div>

        {brandList.length === 0 ? (
          <p className="mt-8 text-center text-sm text-white/80">
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
      </div>
    </>
  );
}
