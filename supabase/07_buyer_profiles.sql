-- ============================================================
-- 07_buyer_profiles.sql
-- A durable, per-customer buyer profile derived from viewing behaviour,
-- plus the consent that gates it. Safe to re-run.
-- ============================================================
--
-- Two things make this different from the session-scoped signals that were
-- already here:
--
--   * it is keyed on the user, not the browser. A session id dies with the
--     cookie; a profile accumulates across devices and months, which is the
--     only way a segment means anything.
--   * it is consented. Nothing is computed for a customer who has not said
--     yes, and withdrawing consent does not merely stop the computation, it
--     destroys the profile and detaches the history behind it.

-- ---------------- CONSENT ----------------
-- null means never asked, which is what the banner keys off. It is deliberately
-- three-state: a false is a decision and must not be mistaken for a blank.
alter table public.profiles
  add column if not exists personalisation_consent boolean,
  add column if not exists consent_updated_at timestamptz;

-- ---------------- GEO ----------------
-- Derived from the request at ingest, never the raw IP. The address itself is
-- of no use to a recommendation and is the part that is genuinely sensitive,
-- so it is resolved to country/region/city and discarded.
alter table public.product_views
  add column if not exists country text,
  add column if not exists region  text,
  add column if not exists city    text;

-- ---------------- THE PROFILE ----------------
create table if not exists public.buyer_profiles (
  user_id uuid primary key references public.profiles(id) on delete cascade,

  segment text not null default 'new',
  segment_confidence numeric(4,3) not null default 0,

  views_90d int not null default 0,
  searches_90d int not null default 0,
  orders_lifetime int not null default 0,

  distinct_brands int not null default 0,
  distinct_categories int not null default 0,
  top_brand_id uuid references public.brands(id) on delete set null,
  top_brand_share numeric(4,3) not null default 0,
  top_category_id uuid references public.categories(id) on delete set null,
  top_category_share numeric(4,3) not null default 0,

  avg_viewed_price numeric(10,2) not null default 0,
  max_viewed_price numeric(10,2) not null default 0,
  price_band text not null default 'unknown',
  sale_affinity numeric(4,3) not null default 0,

  primary_country text,
  primary_region text,
  primary_city text,

  first_seen_at timestamptz,
  last_seen_at timestamptz,
  computed_at timestamptz not null default now()
);

create index if not exists buyer_profiles_segment_idx on public.buyer_profiles (segment);
create index if not exists product_views_user_idx on public.product_views (user_id, created_at desc);

-- ---------------- THE CLASSIFIER ----------------
-- Price thresholds are percentiles of the live catalog rather than fixed
-- numbers, so "luxury" keeps meaning something if the range shifts.
create or replace function public.compute_buyer_profile(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $fn$
declare
  v_consent boolean;
  m record;
  v_segment text;
  v_band text;
  p33 numeric; p66 numeric; p90 numeric;
begin
  select personalisation_consent into v_consent
    from public.profiles where id = p_user_id;

  -- No consent, no profile. Withdrawal is handled by the trigger below, but
  -- this keeps a stray call from quietly rebuilding one.
  if v_consent is not true then
    delete from public.buyer_profiles where user_id = p_user_id;
    return;
  end if;

  select percentile_cont(0.33) within group (order by price),
         percentile_cont(0.66) within group (order by price),
         percentile_cont(0.90) within group (order by price)
    into p33, p66, p90
    from public.products where is_published;

  with v as (
    select pv.product_id, pv.created_at, pv.country, pv.region, pv.city,
           p.brand_id, p.category_id, p.price,
           (p.compare_at_price is not null and p.compare_at_price > p.price) as on_sale
      from public.product_views pv
      join public.products p on p.id = pv.product_id
     where pv.user_id = p_user_id
       and pv.created_at > now() - interval '90 days'
  ),
  brand_rank as (
    select brand_id, count(*)::numeric n from v group by brand_id order by n desc limit 1
  ),
  cat_rank as (
    select category_id, count(*)::numeric n from v
     where category_id is not null group by category_id order by n desc limit 1
  ),
  geo_rank as (
    select country, region, city, count(*) n from v
     where country is not null group by country, region, city order by n desc limit 1
  )
  select
    (select count(*) from v)                                        as views,
    (select count(distinct brand_id) from v)                        as brands,
    (select count(distinct category_id) from v
      where category_id is not null)                                as cats,
    (select brand_id from brand_rank)                               as top_brand,
    coalesce((select n from brand_rank), 0)                         as top_brand_n,
    (select category_id from cat_rank)                              as top_cat,
    coalesce((select n from cat_rank), 0)                           as top_cat_n,
    coalesce((select avg(price) from v), 0)                         as avg_price,
    coalesce((select max(price) from v), 0)                         as max_price,
    coalesce((select avg(case when on_sale then 1 else 0 end) from v), 0) as sale_share,
    (select min(created_at) from v)                                 as first_seen,
    (select max(created_at) from v)                                 as last_seen,
    (select country from geo_rank)                                  as geo_country,
    (select region  from geo_rank)                                  as geo_region,
    (select city    from geo_rank)                                  as geo_city,
    (select count(*) from public.search_events se
      where se.user_id = p_user_id
        and se.created_at > now() - interval '90 days')             as searches,
    (select count(*) from public.orders o where o.user_id = p_user_id) as orders
  into m;

  v_band := case
    when m.views = 0        then 'unknown'
    when m.avg_price >= p90 then 'luxury'
    when m.avg_price >= p66 then 'premium'
    when m.avg_price >= p33 then 'mid'
    else 'entry'
  end;

  -- First match wins, so the order is the priority. Price intent beats
  -- concentration, because someone who only looks at discounts is a bargain
  -- hunter whichever label they happen to favour.
  v_segment := case
    when m.views < 5 then 'new'
    when m.sale_share >= 0.35 then 'bargain'
    when m.avg_price >= p90 then 'luxury'
    when m.views > 0 and m.top_brand_n / m.views >= 0.55 then 'loyalist'
    when m.top_cat_n > 0 and m.top_cat_n / m.views >= 0.60 then 'specialist'
    when m.brands >= 5 and m.top_brand_n / m.views < 0.35 then 'explorer'
    else 'regular'
  end;

  insert into public.buyer_profiles as bp (
    user_id, segment, segment_confidence,
    views_90d, searches_90d, orders_lifetime,
    distinct_brands, distinct_categories,
    top_brand_id, top_brand_share, top_category_id, top_category_share,
    avg_viewed_price, max_viewed_price, price_band, sale_affinity,
    primary_country, primary_region, primary_city,
    first_seen_at, last_seen_at, computed_at
  ) values (
    p_user_id, v_segment,
    -- Confidence is about evidence, not about how cleanly the rule fired: a
    -- segment off three views is a guess whatever the shares look like.
    least(1.0, m.views / 20.0)::numeric(4,3),
    m.views, m.searches, m.orders,
    m.brands, m.cats,
    m.top_brand, case when m.views > 0 then (m.top_brand_n / m.views)::numeric(4,3) else 0 end,
    m.top_cat,   case when m.views > 0 then (m.top_cat_n   / m.views)::numeric(4,3) else 0 end,
    round(m.avg_price, 2), round(m.max_price, 2), v_band, m.sale_share::numeric(4,3),
    m.geo_country, m.geo_region, m.geo_city,
    m.first_seen, m.last_seen, now()
  )
  on conflict (user_id) do update set
    segment = excluded.segment,
    segment_confidence = excluded.segment_confidence,
    views_90d = excluded.views_90d,
    searches_90d = excluded.searches_90d,
    orders_lifetime = excluded.orders_lifetime,
    distinct_brands = excluded.distinct_brands,
    distinct_categories = excluded.distinct_categories,
    top_brand_id = excluded.top_brand_id,
    top_brand_share = excluded.top_brand_share,
    top_category_id = excluded.top_category_id,
    top_category_share = excluded.top_category_share,
    avg_viewed_price = excluded.avg_viewed_price,
    max_viewed_price = excluded.max_viewed_price,
    price_band = excluded.price_band,
    sale_affinity = excluded.sale_affinity,
    primary_country = excluded.primary_country,
    primary_region = excluded.primary_region,
    primary_city = excluded.primary_city,
    first_seen_at = least(bp.first_seen_at, excluded.first_seen_at),
    last_seen_at = excluded.last_seen_at,
    computed_at = now();
end; $fn$;

-- Rebuild everyone who has consented. Cheap at this scale; if the customer
-- table ever gets large this is the thing to put on a schedule.
create or replace function public.refresh_buyer_profiles()
returns int
language plpgsql
security definer
set search_path = public, pg_temp
as $fn$
declare n int := 0; r record;
begin
  if not public.has_scope('analytics.view') then
    raise exception 'insufficient scope: analytics.view';
  end if;
  for r in select id from public.profiles where personalisation_consent is true loop
    perform public.compute_buyer_profile(r.id);
    n := n + 1;
  end loop;
  return n;
end; $fn$;

-- ---------------- CONSENT WITHDRAWAL ----------------
-- Saying no has to mean something. The profile goes, and the behaviour behind
-- it is detached from the person so it cannot be rebuilt: the rows stay as
-- anonymous popularity signal, with nothing pointing back at them.
create or replace function public.on_consent_change()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $fn$
begin
  if new.personalisation_consent is distinct from old.personalisation_consent then
    new.consent_updated_at := now();

    if new.personalisation_consent is not true then
      delete from public.buyer_profiles where user_id = new.id;
      update public.product_views set user_id = null where user_id = new.id;
      update public.search_events  set user_id = null where user_id = new.id;
    end if;
  end if;
  return new;
end; $fn$;

drop trigger if exists on_profile_consent on public.profiles;
create trigger on_profile_consent
  before update on public.profiles
  for each row execute function public.on_consent_change();

-- ---------------- ACCESS ----------------
alter table public.buyer_profiles enable row level security;

drop policy if exists buyer_profiles_read on public.buyer_profiles;
create policy buyer_profiles_read on public.buyer_profiles
  for select to authenticated
  using (user_id = auth.uid() or public.has_scope('customers.view'));

-- No insert/update/delete policy: the profile is only ever written by
-- compute_buyer_profile(), which runs as definer.

revoke all on function public.compute_buyer_profile(uuid) from public;
revoke all on function public.refresh_buyer_profiles() from public;
revoke all on function public.on_consent_change() from public;
grant execute on function public.compute_buyer_profile(uuid) to authenticated;
grant execute on function public.refresh_buyer_profiles() to authenticated;
