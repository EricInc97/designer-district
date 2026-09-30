-- ============================================================
-- 14_shoppable_brands.sql
-- The houses that actually have something to sell.
-- Safe to re-run.
-- ============================================================
--
-- There are sixteen rows in `brands` and only fifteen shops. The sixteenth
-- is "Designer District" itself, sort_order 999, and it has never had a
-- product. It was drawing a tile at the end of the homepage grid that opens
-- onto an empty shop — the one tile on a page whose own copy says "Select a
-- brand to view its products".
--
-- Why not simply deactivate it: it is load-bearing.
--
-- That row owns a published brand_media board — the artwork on the wide
-- crown screen above the end block in the 3D district, which belongs to the
-- district rather than to any one house. That is the whole reason the row
-- exists. And `brands` is read under `using (is_active or is_staff())`, so
-- clearing is_active does not merely hide a tile: it makes the row invisible
-- to the `brands!inner(slug)` join the storefront API uses to fetch boards,
-- and the crown goes dark for everyone who is not staff. Measured, not
-- guessed — the advert disappeared from /api/storefront the moment the flag
-- was cleared, and came back when it was restored.
--
-- So the rule is stated where the mistake actually was, in the listing. A
-- house earns a tile by having something behind it. That is true of the
-- district row today and stays true for any house whose last product is
-- unpublished tomorrow, which a hardcoded slug would not have caught.
--
-- The condition matches what the storefront itself considers sellable —
-- published, and carrying a photograph — so "has a tile" and "has something
-- to show once you click it" cannot drift apart.

create or replace view public.shoppable_brands
with (security_invoker = true) as
select b.*
  from public.brands b
 where b.is_active
   and exists (
     select 1
       from public.products p
      where p.brand_id = b.id
        and p.is_published
        and p.image_url is not null
   );

comment on view public.shoppable_brands is
  'Active houses with at least one published, photographed product: the '
  'brands worth listing to a shopper. The storefront grids, the navbar and '
  'the search facets all read this rather than `brands` directly, so an '
  'empty house never gets a tile. Not a substitute for `brands` — the house '
  'brand is absent here but still owns the crown screen artwork in the '
  'district, and reads of brand_media must keep going through the table.';

-- security_invoker above means this is read as whoever queries it, so the
-- brands and products policies both still apply. No new surface.
grant select on public.shoppable_brands to anon, authenticated;
