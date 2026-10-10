-- ============================================================
-- 17_retire_remaining_anime.sql
-- The rest of the hand-painted boards, stood down.
-- Safe to re-run.
-- ============================================================
--
-- 16 retired five drawings as five photographs arrived, one for one, so
-- that nothing was ever bare. This finishes the job on the other
-- thirty-nine without waiting for their replacements, which was asked for
-- directly after seeing the first five.
--
-- What that costs, stated plainly because it is not small: nine houses are
-- left with no campaign artwork at all — Bape, Balenciaga, Gallery Dept.,
-- Godspeed, Purple Brand, Off-White, Ksubi, Vale and Hellstar. Their pages
-- fall back to the house colourway with its mark centred, which is a real
-- designed state rather than a hole (see the note in BrandCampaign.tsx: it
-- was built for exactly this, because for a while it is what most houses
-- would show). Product pages carrying a campaign hero drop from 43 to 16;
-- the rest simply show no hero, which is the honest alternative to showing
-- a photograph of a different garment.
--
-- Unpublished rather than deleted, and the files are all still in
-- public/campaigns. Every one of these rows keeps its product_ids and its
-- copy, so bringing any of them back is one update.
--
-- Listed one by one rather than matched with a LIKE. Thirty-nine names is
-- longer but it is reviewable: you can read this file against the
-- directory and see exactly what went, and a pattern that drifts later
-- cannot quietly take something else with it.

update public.brand_media
   set is_published = false
 where kind = 'board'
   and image_url in (
     '/campaigns/amiri-detail.webp',
     '/campaigns/balenciaga-tower.webp',
     '/campaigns/balenciaga-wide.webp',
     '/campaigns/bape-detail.webp',
     '/campaigns/bape-rail.webp',
     '/campaigns/casablanca-vale.webp',
     '/campaigns/chrome-amiri.webp',
     '/campaigns/chrome-hearts-banner.webp',
     '/campaigns/chrome-hearts-beanie.webp',
     '/campaigns/chrome-hearts-day.webp',
     '/campaigns/chrome-hearts-night.webp',
     '/campaigns/chrome-hearts-snapback.webp',
     '/campaigns/crown-group.webp',
     '/campaigns/gallery-dept-back.webp',
     '/campaigns/gallery-dept-detail.webp',
     '/campaigns/gallery-dept-tower.webp',
     '/campaigns/godspeed-detail.webp',
     '/campaigns/godspeed-tower.webp',
     '/campaigns/hellstar-balenciaga.webp',
     '/campaigns/hellstar-banner.webp',
     '/campaigns/hellstar-night.webp',
     '/campaigns/ksubi-rail.webp',
     '/campaigns/off-white-detail.webp',
     '/campaigns/off-white-purple.webp',
     '/campaigns/off-white-tower.webp',
     '/campaigns/purple-brand-detail.webp',
     '/campaigns/purple-brand-tower.webp',
     '/campaigns/rhude-tower.webp',
     '/campaigns/rhude-twin.webp',
     '/campaigns/supreme-banner.webp',
     '/campaigns/supreme-day.webp',
     '/campaigns/supreme-ducati-three.webp',
     '/campaigns/supreme-ksubi-her.webp',
     '/campaigns/supreme-tower.webp',
     '/campaigns/supreme-track-blue.webp',
     '/campaigns/supreme-track-her.webp',
     '/campaigns/supreme-track-red.webp',
     '/campaigns/vale-day.webp',
     '/campaigns/vale-tower.webp'
   );
