-- ============================================================
-- DESIGNER DISTRICT, Core schema
-- Run order: 01_schema.sql -> 02_rls.sql -> 03_seed.sql
-- ============================================================

create extension if not exists "pgcrypto";
create extension if not exists "pg_trgm";

-- ---------- enums ----------
do $$ begin
  create type user_role as enum ('customer', 'admin', 'master_admin');
exception when duplicate_object then null; end $$;

do $$ begin
  create type ticket_kind as enum ('refund', 'return', 'complaint', 'order_issue', 'general');
exception when duplicate_object then null; end $$;

do $$ begin
  create type ticket_status as enum ('open', 'pending_customer', 'resolved', 'closed');
exception when duplicate_object then null; end $$;

do $$ begin
  create type ticket_priority as enum ('low', 'normal', 'high', 'urgent');
exception when duplicate_object then null; end $$;

do $$ begin
  create type order_status as enum ('pending', 'paid', 'fulfilled', 'shipped', 'delivered', 'cancelled', 'refunded');
exception when duplicate_object then null; end $$;

do $$ begin
  create type credit_reason as enum ('refund', 'return', 'goodwill', 'promo', 'spend', 'adjustment');
exception when duplicate_object then null; end $$;

-- ============================================================
-- CATALOG
-- ============================================================

create table if not exists public.brands (
  id          uuid primary key default gen_random_uuid(),
  name        text not null unique,
  slug        text not null unique,
  logo_url    text,
  description text,
  is_active   boolean not null default true,
  sort_order  int not null default 0,
  created_at  timestamptz not null default now()
);

create table if not exists public.categories (
  id         uuid primary key default gen_random_uuid(),
  name       text not null unique,
  slug       text not null unique,
  created_at timestamptz not null default now()
);

create table if not exists public.products (
  id           uuid primary key default gen_random_uuid(),
  brand_id     uuid not null references public.brands(id) on delete cascade,
  category_id  uuid references public.categories(id) on delete set null,
  name         text not null,
  slug         text unique,
  description  text,
  price        numeric(10,2) not null check (price >= 0),
  compare_at_price numeric(10,2) check (compare_at_price >= 0),
  image_url    text,
  gallery      text[] not null default '{}',
  sizes        text[] not null default '{S,M,L,XL}',
  stock_count  int not null default 0 check (stock_count >= 0),
  is_published boolean not null default false,
  is_featured  boolean not null default false,
  created_by   uuid references auth.users(id) on delete set null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index if not exists products_brand_idx     on public.products(brand_id);
create index if not exists products_category_idx  on public.products(category_id);
create index if not exists products_published_idx on public.products(is_published) where is_published;
create index if not exists products_name_trgm_idx on public.products using gin (name gin_trgm_ops);

-- ============================================================
-- IDENTITY / STAFF SCOPES
-- ============================================================

create table if not exists public.profiles (
  id            uuid primary key references auth.users(id) on delete cascade,
  email         text,
  full_name     text,
  phone         text,
  address_line1 text,
  address_line2 text,
  city          text,
  state         text,
  postal_code   text,
  country       text default 'US',
  role          user_role not null default 'customer',
  store_credit  numeric(10,2) not null default 0 check (store_credit >= 0),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- canonical scope list (drives the "add employee + give them scopes" UI)
create table if not exists public.app_scopes (
  key         text primary key,
  label       text not null,
  description text,
  category    text not null default 'general',
  sort_order  int not null default 0
);

create table if not exists public.staff_scopes (
  user_id    uuid not null references public.profiles(id) on delete cascade,
  scope_key  text not null references public.app_scopes(key) on delete cascade,
  granted_by uuid references public.profiles(id) on delete set null,
  granted_at timestamptz not null default now(),
  primary key (user_id, scope_key)
);

-- ---------- auth helpers (SECURITY DEFINER = no RLS recursion) ----------
create or replace function public.current_user_role()
returns user_role language sql stable security definer set search_path = public as $fn$
  select coalesce((select role from public.profiles where id = auth.uid()), 'customer'::user_role);
$fn$;

create or replace function public.is_staff()
returns boolean language sql stable security definer set search_path = public as $fn$
  select public.current_user_role() in ('admin', 'master_admin');
$fn$;

create or replace function public.is_master()
returns boolean language sql stable security definer set search_path = public as $fn$
  select public.current_user_role() = 'master_admin';
$fn$;

-- master_admin implicitly holds every scope
create or replace function public.has_scope(p_scope text)
returns boolean language sql stable security definer set search_path = public as $fn$
  select public.is_master()
      or exists (select 1 from public.staff_scopes
                 where user_id = auth.uid() and scope_key = p_scope);
$fn$;

-- auto-create a profile row on signup
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $fn$
begin
  insert into public.profiles (id, email, full_name)
  values (new.id, new.email, coalesce(new.raw_user_meta_data ->> 'full_name', ''))
  on conflict (id) do nothing;
  return new;
end; $fn$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============================================================
-- ORDERS
-- ============================================================

create table if not exists public.orders (
  id             uuid primary key default gen_random_uuid(),
  order_number   text not null unique default ('DD-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8))),
  user_id        uuid not null references public.profiles(id) on delete cascade,
  status         order_status not null default 'paid',
  subtotal       numeric(10,2) not null default 0,
  credit_applied numeric(10,2) not null default 0,
  total          numeric(10,2) not null default 0,
  shipping_address jsonb,
  placed_at      timestamptz not null default now()
);

create index if not exists orders_user_idx on public.orders(user_id, placed_at desc);

create table if not exists public.order_items (
  id           uuid primary key default gen_random_uuid(),
  order_id     uuid not null references public.orders(id) on delete cascade,
  product_id   uuid references public.products(id) on delete set null,
  -- denormalised so order history survives product deletion
  product_name text not null,
  brand_name   text,
  image_url    text,
  size         text,
  quantity     int not null default 1 check (quantity > 0),
  unit_price   numeric(10,2) not null
);

create index if not exists order_items_order_idx on public.order_items(order_id);

-- ============================================================
-- TICKETS + LIVE CHAT
-- ============================================================

create table if not exists public.tickets (
  id            uuid primary key default gen_random_uuid(),
  ticket_number text not null unique default ('T-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 6))),
  user_id       uuid not null references public.profiles(id) on delete cascade,
  order_id      uuid references public.orders(id) on delete set null,
  order_item_id uuid references public.order_items(id) on delete set null,
  kind          ticket_kind not null default 'general',
  status        ticket_status not null default 'open',
  priority      ticket_priority not null default 'normal',
  subject       text not null,
  assigned_to   uuid references public.profiles(id) on delete set null,
  credit_issued numeric(10,2) not null default 0,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists tickets_user_idx   on public.tickets(user_id, created_at desc);
create index if not exists tickets_status_idx on public.tickets(status, updated_at desc);

-- every chat turn lives here; Supabase Realtime subscribes to this table
create table if not exists public.ticket_messages (
  id         uuid primary key default gen_random_uuid(),
  ticket_id  uuid not null references public.tickets(id) on delete cascade,
  sender_id  uuid references public.profiles(id) on delete set null,
  is_staff   boolean not null default false,
  body       text not null check (length(btrim(body)) > 0),
  created_at timestamptz not null default now()
);

create index if not exists ticket_messages_ticket_idx on public.ticket_messages(ticket_id, created_at);

-- bump tickets.updated_at whenever a message lands (drives the staff inbox sort)
create or replace function public.touch_ticket()
returns trigger language plpgsql security definer set search_path = public as $fn$
begin
  update public.tickets set updated_at = now() where id = new.ticket_id;
  return new;
end; $fn$;

drop trigger if exists on_ticket_message on public.ticket_messages;
create trigger on_ticket_message
  after insert on public.ticket_messages
  for each row execute function public.touch_ticket();

-- ---------- store credit ledger ----------
create table if not exists public.credit_ledger (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles(id) on delete cascade,
  ticket_id  uuid references public.tickets(id) on delete set null,
  order_id   uuid references public.orders(id) on delete set null,
  amount     numeric(10,2) not null,           -- positive = issued, negative = spent
  reason     credit_reason not null default 'refund',
  note       text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists credit_ledger_user_idx on public.credit_ledger(user_id, created_at desc);

-- keep profiles.store_credit as the running balance
create or replace function public.apply_credit_delta()
returns trigger language plpgsql security definer set search_path = public as $fn$
begin
  -- guard_profile_update() (02_rls.sql) freezes store_credit against direct
  -- client writes. This ledger trigger is the one legitimate writer, so it
  -- lowers the guard for exactly this statement (set_config local = true).
  perform set_config('app.profile_guard', 'off', true);

  update public.profiles
     set store_credit = greatest(0, store_credit + new.amount)
   where id = new.user_id;

  perform set_config('app.profile_guard', 'on', true);
  return new;
end; $fn$;

drop trigger if exists on_credit_ledger on public.credit_ledger;
create trigger on_credit_ledger
  after insert on public.credit_ledger
  for each row execute function public.apply_credit_delta();

-- staff action: issue store credit and resolve the ticket, atomically + scope-checked
create or replace function public.issue_store_credit(
  p_ticket_id uuid, p_amount numeric, p_note text default null
) returns numeric language plpgsql security definer set search_path = public as $fn$
declare v_user uuid; v_balance numeric;
begin
  if not public.has_scope('tickets.refund') then
    raise exception 'insufficient scope: tickets.refund';
  end if;
  if p_amount <= 0 then raise exception 'amount must be positive'; end if;

  select user_id into v_user from public.tickets where id = p_ticket_id;
  if v_user is null then raise exception 'ticket not found'; end if;

  insert into public.credit_ledger (user_id, ticket_id, amount, reason, note, created_by)
  values (v_user, p_ticket_id, p_amount, 'refund', p_note, auth.uid());

  -- guard_ticket_update() (02_rls.sql) pins credit_issued for anyone without
  -- tickets.manage; tickets.refund is a separate grant, so lower it here.
  perform set_config('app.ticket_guard', 'off', true);

  update public.tickets
     set credit_issued = credit_issued + p_amount, status = 'resolved', updated_at = now()
   where id = p_ticket_id;

  perform set_config('app.ticket_guard', 'on', true);

  select store_credit into v_balance from public.profiles where id = v_user;
  return v_balance;
end; $fn$;

-- ============================================================
-- RECOMMENDATION SIGNALS
-- ============================================================

create table if not exists public.search_events (
  id           bigserial primary key,
  user_id      uuid references public.profiles(id) on delete cascade,
  session_id   text,
  query        text not null,
  result_count int not null default 0,
  created_at   timestamptz not null default now()
);

create index if not exists search_events_user_idx on public.search_events(user_id, created_at desc);
create index if not exists search_events_sess_idx on public.search_events(session_id, created_at desc);

create table if not exists public.product_views (
  id         bigserial primary key,
  user_id    uuid references public.profiles(id) on delete cascade,
  session_id text,
  product_id uuid not null references public.products(id) on delete cascade,
  source     text default 'direct',            -- direct | search | recommendation | brand
  created_at timestamptz not null default now()
);

create index if not exists product_views_user_idx on public.product_views(user_id, created_at desc);
create index if not exists product_views_sess_idx on public.product_views(session_id, created_at desc);
create index if not exists product_views_prod_idx on public.product_views(product_id);

-- ---------- THE ALGORITHM ----------
-- Scores every published product against the visitor's recent behaviour:
--   3.0  brand affinity    , brands whose products they viewed
--   2.0  category affinity , categories they viewed
--   2.5  search-term match , their last 20 queries, matched against name/description/brand
--   0.5  global popularity , views in the last 30 days, log-damped so hits don't dominate
-- Anything already viewed is excluded, so it always surfaces something new.
create or replace function public.recommend_products(
  p_session_id text default null,
  p_user_id    uuid default null,
  p_limit      int  default 8
) returns table (
  id uuid, name text, price numeric, image_url text, slug text,
  brand_name text, brand_slug text, score numeric
) language sql stable set search_path = public as $fn$
  with seen as (
    select pv.product_id
      from public.product_views pv
     where (p_user_id is not null and pv.user_id = p_user_id)
        or (p_session_id is not null and pv.session_id = p_session_id)
     order by pv.created_at desc
     limit 100
  ),
  viewed as (
    select p.brand_id, p.category_id
      from seen s
      join public.products p on p.id = s.product_id
  ),
  brand_aff as (
    select v.brand_id, count(*)::numeric as n from viewed v group by v.brand_id
  ),
  cat_aff as (
    select v.category_id, count(*)::numeric as n
      from viewed v where v.category_id is not null group by v.category_id
  ),
  terms as (
    select distinct lower(btrim(se.query)) as q
      from public.search_events se
     where length(btrim(se.query)) >= 2
       and ((p_user_id is not null and se.user_id = p_user_id)
         or (p_session_id is not null and se.session_id = p_session_id))
     limit 20
  ),
  popularity as (
    select pv.product_id, count(*)::numeric as n
      from public.product_views pv
     where pv.created_at > now() - interval '30 days'
     group by pv.product_id
  )
  select p.id, p.name, p.price, p.image_url, p.slug,
         b.name as brand_name, b.slug as brand_slug,
         round(
             3.0 * coalesce(ba.n, 0)
           + 2.0 * coalesce(ca.n, 0)
           + 2.5 * (select count(*) from terms t
                     where p.name ilike '%' || t.q || '%'
                        or coalesce(p.description, '') ilike '%' || t.q || '%'
                        or b.name ilike '%' || t.q || '%')
           + 0.5 * ln(1 + coalesce(pop.n, 0))
         , 3) as score
    from public.products p
    join public.brands b     on b.id = p.brand_id
    left join brand_aff ba   on ba.brand_id = p.brand_id
    left join cat_aff ca     on ca.category_id = p.category_id
    left join popularity pop on pop.product_id = p.id
   where p.is_published
     and p.stock_count > 0
     and not exists (select 1 from seen s where s.product_id = p.id)
   order by score desc, p.created_at desc
   limit greatest(1, least(p_limit, 24));
$fn$;

-- ============================================================
-- ANALYTICS (master_admin dashboard)
-- ============================================================
create or replace function public.admin_analytics(p_days int default 30)
returns jsonb language plpgsql stable security definer set search_path = public as $fn$
declare
  result jsonb;
  since  timestamptz := now() - make_interval(days => greatest(1, p_days));
begin
  if not public.has_scope('analytics.view') then
    raise exception 'insufficient scope: analytics.view';
  end if;

  select jsonb_build_object(
    'revenue',       (select coalesce(sum(total), 0) from orders where placed_at > since and status <> 'cancelled'),
    'order_count',   (select count(*) from orders where placed_at > since),
    'avg_order',     (select coalesce(round(avg(total), 2), 0) from orders where placed_at > since and status <> 'cancelled'),
    'new_customers', (select count(*) from profiles where created_at > since),
    'open_tickets',  (select count(*) from tickets where status in ('open', 'pending_customer')),
    'credit_issued', (select coalesce(sum(amount), 0) from credit_ledger where amount > 0 and created_at > since),
    'low_stock',     (select count(*) from products where is_published and stock_count <= 3),
    'top_products',  (select coalesce(jsonb_agg(x), '[]'::jsonb) from (
                        select oi.product_name, sum(oi.quantity) as units,
                               sum(oi.quantity * oi.unit_price) as revenue
                          from order_items oi join orders o on o.id = oi.order_id
                         where o.placed_at > since
                         group by oi.product_name order by units desc limit 5) x),
    'top_brands',    (select coalesce(jsonb_agg(x), '[]'::jsonb) from (
                        select oi.brand_name, sum(oi.quantity * oi.unit_price) as revenue
                          from order_items oi join orders o on o.id = oi.order_id
                         where o.placed_at > since and oi.brand_name is not null
                         group by oi.brand_name order by revenue desc limit 5) x),
    'top_searches',  (select coalesce(jsonb_agg(x), '[]'::jsonb) from (
                        select lower(btrim(query)) as term, count(*) as n
                          from search_events where created_at > since and length(btrim(query)) > 1
                         group by 1 order by n desc limit 8) x),
    'revenue_series', (select coalesce(jsonb_agg(y.x order by y.x ->> 'day'), '[]'::jsonb) from (
                        select jsonb_build_object('day', d::date, 'revenue',
                               coalesce((select sum(total) from orders
                                          where placed_at::date = d::date and status <> 'cancelled'), 0)) as x
                          from generate_series(since::date, now()::date, '1 day') d) y)
  ) into result;

  return result;
end; $fn$;

-- ============================================================
-- CHECKOUT
-- ============================================================
-- Prices, stock and totals are all resolved server-side from the products
-- table; the client only ever sends {product_id, size, quantity}. Runs as
-- SECURITY DEFINER so it can decrement stock, but every write is pinned to
-- auth.uid(), so a caller can only ever create their own order.
create or replace function public.place_order(
  p_items jsonb,
  p_use_credit boolean default true
) returns jsonb language plpgsql security definer set search_path = public as $fn$
declare
  v_user     uuid := auth.uid();
  v_order    uuid;
  v_number   text;
  v_subtotal numeric(10,2) := 0;
  v_credit   numeric(10,2) := 0;
  v_avail    numeric(10,2) := 0;
  v_item     jsonb;
  v_qty      int;
  v_prod     record;
  v_addr     jsonb;
begin
  if v_user is null then raise exception 'not authenticated'; end if;
  if p_items is null or jsonb_array_length(p_items) = 0 then
    raise exception 'cart is empty';
  end if;

  insert into public.orders (user_id, status) values (v_user, 'paid')
  returning id, order_number into v_order, v_number;

  for v_item in select * from jsonb_array_elements(p_items) loop
    v_qty := greatest(1, coalesce((v_item ->> 'quantity')::int, 1));

    -- FOR UPDATE serialises concurrent buyers of the last unit.
    select p.id, p.name, p.price, p.image_url, p.stock_count, p.is_published, b.name as brand_name
      into v_prod
      from public.products p
      join public.brands b on b.id = p.brand_id
     where p.id = (v_item ->> 'product_id')::uuid
     for update of p;

    if not found then raise exception 'product not found'; end if;
    if not v_prod.is_published then raise exception 'product % is not available', v_prod.name; end if;
    if v_prod.stock_count < v_qty then
      raise exception 'only % left of %', v_prod.stock_count, v_prod.name;
    end if;

    insert into public.order_items
      (order_id, product_id, product_name, brand_name, image_url, size, quantity, unit_price)
    values
      (v_order, v_prod.id, v_prod.name, v_prod.brand_name, v_prod.image_url,
       nullif(v_item ->> 'size', ''), v_qty, v_prod.price);

    update public.products
       set stock_count = stock_count - v_qty, updated_at = now()
     where id = v_prod.id;

    v_subtotal := v_subtotal + (v_prod.price * v_qty);
  end loop;

  -- Store credit is spent before card, capped at the order total.
  if p_use_credit then
    select store_credit into v_avail from public.profiles where id = v_user;
    v_credit := least(coalesce(v_avail, 0), v_subtotal);
    if v_credit > 0 then
      insert into public.credit_ledger (user_id, order_id, amount, reason, note, created_by)
      values (v_user, v_order, -v_credit, 'spend', 'Applied to order ' || v_number, v_user);
    end if;
  end if;

  select jsonb_build_object(
           'line1', address_line1, 'line2', address_line2, 'city', city,
           'state', state, 'postal_code', postal_code, 'country', country,
           'name', full_name, 'phone', phone)
    into v_addr
    from public.profiles where id = v_user;

  update public.orders
     set subtotal = v_subtotal,
         credit_applied = v_credit,
         total = v_subtotal - v_credit,
         shipping_address = v_addr
   where id = v_order;

  return jsonb_build_object(
    'order_id', v_order, 'order_number', v_number,
    'subtotal', v_subtotal, 'credit_applied', v_credit, 'total', v_subtotal - v_credit);
end; $fn$;

-- ============================================================
-- STAFF ADMINISTRATION (master_admin only)
-- ============================================================
-- Promote an existing signed-up user to staff and set their scopes in one call.
create or replace function public.set_staff_access(
  p_user_id uuid,
  p_role    user_role,
  p_scopes  text[] default '{}'
) returns void language plpgsql security definer set search_path = public as $fn$
begin
  if not public.is_master() then
    raise exception 'only a master admin can manage staff';
  end if;
  if p_user_id = auth.uid() and p_role <> 'master_admin' then
    raise exception 'you cannot demote yourself';
  end if;

  update public.profiles set role = p_role, updated_at = now() where id = p_user_id;

  delete from public.staff_scopes where user_id = p_user_id;

  if p_role = 'customer' then return; end if;

  insert into public.staff_scopes (user_id, scope_key, granted_by)
  select p_user_id, s.key, auth.uid()
    from public.app_scopes s
   where s.key = any(p_scopes)
  on conflict do nothing;
end; $fn$;

-- Scopes held by the caller, drives which admin tiles and buttons render.
create or replace function public.my_scopes()
returns text[] language sql stable security definer set search_path = public as $fn$
  select case
    when public.is_master() then (select coalesce(array_agg(key), '{}') from public.app_scopes)
    else (select coalesce(array_agg(scope_key), '{}') from public.staff_scopes where user_id = auth.uid())
  end;
$fn$;
