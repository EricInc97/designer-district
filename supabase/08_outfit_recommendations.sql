-- ============================================================
-- 08_outfit_recommendations.sql
-- Outfit building, stock awareness and live activity in the recommender.
-- Safe to re-run. Requires 07_buyer_profiles.sql.
-- ============================================================
--
-- On a product page the useful question is not "what else might you like" but
-- "what goes with this". That needs three things the recommender did not have:
-- an anchor, a notion of which categories pair, and a reason not to answer
-- with nine pairs of the same shorts.

-- ---------------- WHAT PAIRS WITH WHAT ----------------
-- Data, not a CASE buried in the scorer, so pairings can be retuned without a
-- migration. Directional on purpose: socks pair with a shirt more readily than
-- a shirt pairs with socks, because the anchor is what the shopper already
-- wants.
create table if not exists public.category_complements (
  source_id uuid not null references public.categories(id) on delete cascade,
  target_id uuid not null references public.categories(id) on delete cascade,
  weight numeric(3,2) not null default 1.0,
  primary key (source_id, target_id)
);

alter table public.category_complements enable row level security;

drop policy if exists complements_read on public.category_complements;
create policy complements_read on public.category_complements
  for select to anon, authenticated using (true);

drop policy if exists complements_write on public.category_complements;
create policy complements_write on public.category_complements
  for all to authenticated
  using (public.has_scope('products.manage'))
  with check (public.has_scope('products.manage'));

-- Keyed on slugs so a rename does not silently empty the graph. Accessories is
-- where socks live in this catalog, which is why it complements itself:
-- someone looking at a pair of socks is in the market for socks.
insert into public.category_complements (source_id, target_id, weight)
select s.id, t.id, v.w
from (values
  ('shirts','bottoms',1.0), ('shirts','denim',1.0), ('shirts','accessories',0.9),
  ('shirts','hoodies',0.7), ('shirts','outerwear',0.6), ('shirts','footwear',0.7),
  ('polo-shirts','bottoms',1.0), ('polo-shirts','denim',0.9),
  ('polo-shirts','accessories',0.9), ('polo-shirts','footwear',0.7),
  ('hoodies','bottoms',1.0), ('hoodies','denim',1.0), ('hoodies','accessories',0.9),
  ('hoodies','shirts',0.7), ('hoodies','footwear',0.7),
  ('outerwear','bottoms',0.9), ('outerwear','denim',0.9), ('outerwear','shirts',0.9),
  ('outerwear','accessories',0.8),
  ('bottoms','shirts',1.0), ('bottoms','hoodies',0.9), ('bottoms','accessories',0.9),
  ('bottoms','footwear',0.9), ('bottoms','outerwear',0.6),
  ('denim','shirts',1.0), ('denim','hoodies',0.9), ('denim','accessories',0.9),
  ('denim','footwear',0.9), ('denim','outerwear',0.6),
  ('footwear','bottoms',0.9), ('footwear','denim',0.9), ('footwear','accessories',1.0),
  ('footwear','shirts',0.7),
  ('accessories','accessories',1.0), ('accessories','shirts',0.9),
  ('accessories','bottoms',0.9), ('accessories','denim',0.9),
  ('accessories','footwear',0.9), ('accessories','hoodies',0.8)
) as v(src, tgt, w)
join public.categories s on s.slug = v.src
join public.categories t on t.slug = v.tgt
on conflict (source_id, target_id) do update set weight = excluded.weight;

-- ---------------- LIVE ACTIVITY ----------------
-- Distinct sessions on a product in the last few minutes, which is what
-- "3 people are looking at this" actually means.
--
-- SECURITY DEFINER is required here, not incidental. product_views is readable
-- only by its owner or by staff with analytics.view, so as an invoker this
-- counted the caller's own rows and returned 0 for every shopper. It returns a
-- single integer and never a row, and it clamps its own window so a caller
-- cannot widen it into a general-purpose view counter.
create or replace function public.live_viewers(p_product_id uuid, p_minutes int default 10)
returns int
language sql
stable
security definer
set search_path = public, pg_temp
as $fn$
  select count(distinct coalesce(pv.session_id, pv.user_id::text))::int
    from public.product_views pv
   where pv.product_id = p_product_id
     and pv.created_at > now() - make_interval(mins => greatest(1, least(p_minutes, 60)));
$fn$;

revoke all on function public.live_viewers(uuid, int) from public;
grant execute on function public.live_viewers(uuid, int) to anon, authenticated;

-- ---------------- THE SCORER ----------------
-- recommend_products() gains p_anchor_product_id. The full weight table is in
-- the README; the additions this file is responsible for are:
--
--   outfit   complement weight x 6.0, plus same-house and price-tier nudges so
--            a pairing reads as deliberate. With an anchor the complement is
--            also a hard filter, not just a weight: a category that does not
--            pair with the anchor cannot appear at all. A shirt does not
--            complement a shirt; accessories complement accessories, which is
--            how socks still return socks.
--   stock    category stock depth, so a complement holding one lonely unit is
--            not pushed as hard as one that can dress a hundred people
--   live     distinct sessions in the last hour, log damped
--
-- and a diversity penalty that applies only when an anchor is present: each
-- further item from the same category is worth 2.2 less, so the best of
-- another category overtakes the second-best of this one. Nine pairs of shorts
-- is not an outfit. Without an anchor the penalty is off, because a shopper
-- devoted to one house should still be shown that house.
--
-- Two things the first version got wrong, both found by testing against a real
-- browsing history rather than a fresh session:
--
--   Affinity was a raw view count. Twenty views of one house scored 3.0 x 20 =
--   60 against an outfit term worth at most 6, so a shopper who had been
--   browsing shirts was answered with eight more shirts. Affinity is now a
--   share of recent views, bounded to [0,1], and can reorder the shelf but not
--   choose its contents.
--
--   This catalog carries many products under one name, so the shelf showed
--   "Chrome hearts T-shirt" five times. Results are deduplicated on house plus
--   name, keeping the best scoring of each.
--
-- The body is long and lives with the migration that introduced it. Re-running
-- this file recreates the complement graph and live_viewers only.
