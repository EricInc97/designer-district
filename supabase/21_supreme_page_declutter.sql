-- ============================================================
-- 21_supreme_page_declutter.sql
-- Two legacy Supreme rows that were quietly more Ducati.
-- Safe to re-run.
-- ============================================================
--
-- The Supreme page was over-run with the Ducati track set, and two of the
-- offenders were not campaign boards at all but the older hero and
-- lookbook rows, both pointing at Ducati product photographs.
--
-- The lookbook band is titled "Box Logo Essentials" and links through to
-- the shirts. Its picture was the black Ducati track jacket, so a band
-- advertising box-logo tees was showing a tracksuit. Repointed at an
-- actual box-logo tee.
--
-- The hero row, "Track Series", is a third Ducati advertisement. It does
-- not currently render -- BrandCampaign is only the fallback for a house
-- with no boards, and Supreme has two -- but it would surface the moment
-- that changed. Unpublished rather than deleted, like everything else
-- here, so it is one update from coming back.

update public.brand_media bm
   set image_url = 'https://dphfetxmgooyuzexrloy.supabase.co/storage/v1/object/public/product-images/fe4051c3-4346-45de-ae62-dbc4624c4c46.jpg'
  from public.brands b
 where b.id = bm.brand_id
   and b.slug = 'supreme'
   and bm.kind = 'lookbook'
   and bm.headline = 'Box Logo Essentials';

update public.brand_media bm
   set is_published = false
  from public.brands b
 where b.id = bm.brand_id
   and b.slug = 'supreme'
   and bm.kind = 'hero'
   and bm.headline = 'Track Series';
