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
            type="image/webp"
            srcSet="/brand/flys-eye-dome-tall.webp"
          />
          <source
            media="(max-width: 639px)"
            srcSet="/brand/flys-eye-dome-tall.jpg"
          />
          <source type="image/webp" srcSet="/brand/flys-eye-dome.webp" />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/brand/flys-eye-dome.jpg"
            alt=""
            fetchPriority="high"
            className="h-full w-full object-cover object-[48%_45%]"
          />
        </picture>
      </div>

      {/* Everything below rides above that layer. */}
      <div className="relative z-10">

      {/* ---------------- HERO ---------------- */}
      <section className="relative">
        <div className="mx-auto flex max-w-7xl flex-col items-center px-5 py-20 text-center sm:px-8 sm:py-24">
          {/*
            No disc behind the lockup any more. A solid black circle on a
            photograph reads as a sticker laid over it rather than as part of
            it, and the point of this page is the building.

            What is left is the artwork itself — it already ships on a
            transparent ground — over a clear glass halo: a backdrop blur with
            no tint at all, masked by a radial gradient so it has no edge to
            catch the eye and simply thins out into the photograph. The blur
            alone softens the bright cells of the dome enough for the white
            lockup to hold, and it echoes the dome's own translucent shell
            rather than fighting it. Legibility past that is the artwork's own
            pair of drop shadows, which is why they are layered rather than
            single.

            The mask fades the blur itself: masking a backdrop-filter is the
            whole reason this is a separate layer from the image.
          */}
          <div className="relative grid aspect-square w-full max-w-[21rem] animate-rise place-items-center sm:max-w-lg">
            <div
              aria-hidden
              className="absolute inset-0 rounded-full backdrop-blur-[18px]"
              style={{
                maskImage:
                  "radial-gradient(circle at 50% 50%, #000 42%, rgba(0,0,0,0.55) 62%, transparent 78%)",
                WebkitMaskImage:
                  "radial-gradient(circle at 50% 50%, #000 42%, rgba(0,0,0,0.55) 62%, transparent 78%)",
              }}
            />

            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/brand/designer-district-on-dark.png"
              alt="Designer District"
              width={800}
              height={618}
              fetchPriority="high"
              className="relative w-[76%] [filter:drop-shadow(0_1px_2px_rgba(0,0,0,0.9))_drop-shadow(0_4px_22px_rgba(0,0,0,0.75))]"
            />
          </div>

          {/* White on a photograph needs more than colour: the shadow is what
              holds it together over the bright cells of the dome. */}
          <p
            className="mt-8 max-w-md animate-rise text-base font-semibold leading-relaxed text-white [text-shadow:0_1px_2px_rgba(0,0,0,1),0_2px_8px_rgba(0,0,0,0.95),0_0_30px_rgba(0,0,0,0.85)] sm:text-lg"
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
        <div className="mx-auto max-w-xl text-center [text-shadow:0_1px_2px_rgba(0,0,0,1),0_2px_8px_rgba(0,0,0,0.95),0_0_30px_rgba(0,0,0,0.85)]">
          <p className="eyebrow !text-white">The Collection</p>
          <h1 className="display mt-1.5 text-3xl text-white sm:text-4xl">
            Shop by brand
          </h1>
          {/* Said plainly, because it turned out not to be obvious: people
              shown this page read the grid as a logo wall and did not try
              clicking it. */}
          <p className="mt-3 text-sm font-medium text-white sm:text-base">
            Select a brand to view its products.
          </p>
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
