-- ============================================================
-- 13_campaign_use.sql
-- Which products have already been photographed for a campaign.
-- Safe to re-run.
-- ============================================================
--
-- The same Chrome Hearts t-shirt kept turning up. Counted, it was in seven
-- of the campaign pictures, and the Purple Brand jeans in seven more — out
-- of two hundred and thirty-six products in stock. The generator was asking
-- for "this house's first shirt" every time, and the first shirt is the same
-- shirt every time.
--
-- A VIEW rather than a table, deliberately.
--
-- The record of what has been photographed already exists: every campaign
-- picture is a brand_media row and it carries product_ids. A second table
-- would have to be written alongside that on every ingest, and the first
-- time somebody deleted a picture, or replaced one, or inserted a row by
-- hand, the two would disagree — and the disagreement would be invisible,
-- because nothing would fail. It would simply start recommending garments
-- that are already on three hoardings.
--
-- A view cannot drift. It is the same fact, counted on demand.

create or replace view public.product_campaign_use as
select
  p.id                                             as product_id,
  p.brand_id,
  count(bm.id)                                     as appearances,
  max(bm.created_at)                               as last_used_at,
  coalesce(
    array_agg(bm.image_url order by bm.created_at desc)
      filter (where bm.image_url is not null),
    '{}'
  )                                                as used_in
from public.products p
left join public.brand_media bm
       on bm.kind = 'board'
      and bm.is_published
      and p.id = any (bm.product_ids)
group by p.id, p.brand_id;

comment on view public.product_campaign_use is
  'How many published campaign boards each product appears in, and which. '
  'Derived from brand_media.product_ids rather than recorded separately, so '
  'it cannot fall out of step with the pictures it describes. Use it to pick '
  'garments that have not been shot yet.';

-- Readable by anyone, like the two tables under it: the storefront reads it
-- to tell the generator what it has already used.
grant select on public.product_campaign_use to anon, authenticated;
