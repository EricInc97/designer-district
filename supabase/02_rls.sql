-- ============================================================
-- DESIGNER DISTRICT, Row Level Security
-- Every table is deny-by-default; policies below open the minimum.
-- ============================================================

alter table public.brands          enable row level security;
alter table public.categories      enable row level security;
alter table public.products        enable row level security;
alter table public.profiles        enable row level security;
alter table public.app_scopes      enable row level security;
alter table public.staff_scopes    enable row level security;
alter table public.orders          enable row level security;
alter table public.order_items     enable row level security;
alter table public.tickets         enable row level security;
alter table public.ticket_messages enable row level security;
alter table public.credit_ledger   enable row level security;
alter table public.search_events   enable row level security;
alter table public.product_views   enable row level security;

-- ---------------- CATALOG ----------------
drop policy if exists brands_read on public.brands;
create policy brands_read on public.brands
  for select to anon, authenticated
  using (is_active or public.is_staff());

drop policy if exists brands_write on public.brands;
create policy brands_write on public.brands
  for all to authenticated
  using (public.has_scope('products.manage'))
  with check (public.has_scope('products.manage'));

drop policy if exists categories_read on public.categories;
create policy categories_read on public.categories
  for select to anon, authenticated using (true);

drop policy if exists categories_write on public.categories;
create policy categories_write on public.categories
  for all to authenticated
  using (public.has_scope('products.manage'))
  with check (public.has_scope('products.manage'));

-- customers only ever see published stock; staff with products.view see drafts too
drop policy if exists products_read on public.products;
create policy products_read on public.products
  for select to anon, authenticated
  using (is_published or public.has_scope('products.view'));

drop policy if exists products_insert on public.products;
create policy products_insert on public.products
  for insert to authenticated
  with check (public.has_scope('products.manage'));

drop policy if exists products_update on public.products;
create policy products_update on public.products
  for update to authenticated
  using (public.has_scope('products.manage'))
  with check (public.has_scope('products.manage'));

-- publishing is a separate, narrower grant than editing
drop policy if exists products_delete on public.products;
create policy products_delete on public.products
  for delete to authenticated
  using (public.has_scope('products.delete'));

-- ---------------- PROFILES ----------------
drop policy if exists profiles_self_read on public.profiles;
create policy profiles_self_read on public.profiles
  for select to authenticated
  using (id = auth.uid() or public.has_scope('customers.view'));

drop policy if exists profiles_self_update on public.profiles;
create policy profiles_self_update on public.profiles
  for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

-- only a master_admin may change roles / staff records
drop policy if exists profiles_admin_update on public.profiles;
create policy profiles_admin_update on public.profiles
  for update to authenticated
  using (public.is_master())
  with check (public.is_master());

-- guard: a customer updating their own row must not escalate their role or credit.
create or replace function public.guard_profile_update()
returns trigger language plpgsql security definer set search_path = public as $fn$
begin
  -- apply_credit_delta() lowers this flag for its own statement; everything
  -- else that is not a master admin gets role and balance pinned to their
  -- previous values, whatever the update tried to set.
  --
  -- A NULL auth.uid() means there is no PostgREST JWT at all, the SQL editor
  -- or the service role. Those are already trusted, and exempting them is what
  -- lets you bootstrap the very first master admin. It is not a hole: no RLS
  -- policy on profiles grants the anon role UPDATE, so an unauthenticated API
  -- request never reaches this trigger.
  if auth.uid() is not null
     and coalesce(current_setting('app.profile_guard', true), 'on') <> 'off'
     and not public.is_master() then
    new.role := old.role;
    new.store_credit := old.store_credit;
  end if;
  new.updated_at := now();
  return new;
end; $fn$;

drop trigger if exists on_profile_update on public.profiles;
create trigger on_profile_update
  before update on public.profiles
  for each row execute function public.guard_profile_update();

-- ---------------- SCOPES ----------------
drop policy if exists app_scopes_read on public.app_scopes;
create policy app_scopes_read on public.app_scopes
  for select to authenticated using (public.is_staff());

drop policy if exists app_scopes_write on public.app_scopes;
create policy app_scopes_write on public.app_scopes
  for all to authenticated
  using (public.is_master()) with check (public.is_master());

drop policy if exists staff_scopes_read on public.staff_scopes;
create policy staff_scopes_read on public.staff_scopes
  for select to authenticated
  using (user_id = auth.uid() or public.is_master());

drop policy if exists staff_scopes_write on public.staff_scopes;
create policy staff_scopes_write on public.staff_scopes
  for all to authenticated
  using (public.is_master()) with check (public.is_master());

-- ---------------- ORDERS ----------------
drop policy if exists orders_read on public.orders;
create policy orders_read on public.orders
  for select to authenticated
  using (user_id = auth.uid() or public.has_scope('orders.view'));

drop policy if exists orders_insert on public.orders;
create policy orders_insert on public.orders
  for insert to authenticated with check (user_id = auth.uid());

drop policy if exists orders_staff_update on public.orders;
create policy orders_staff_update on public.orders
  for update to authenticated
  using (public.has_scope('orders.manage'))
  with check (public.has_scope('orders.manage'));

drop policy if exists order_items_read on public.order_items;
create policy order_items_read on public.order_items
  for select to authenticated
  using (exists (select 1 from public.orders o
                  where o.id = order_id
                    and (o.user_id = auth.uid() or public.has_scope('orders.view'))));

drop policy if exists order_items_insert on public.order_items;
create policy order_items_insert on public.order_items
  for insert to authenticated
  with check (exists (select 1 from public.orders o
                       where o.id = order_id and o.user_id = auth.uid()));

-- ---------------- TICKETS ----------------
drop policy if exists tickets_read on public.tickets;
create policy tickets_read on public.tickets
  for select to authenticated
  using (user_id = auth.uid() or public.has_scope('tickets.view'));

drop policy if exists tickets_insert on public.tickets;
create policy tickets_insert on public.tickets
  for insert to authenticated with check (user_id = auth.uid());

-- customers may close their own ticket; staff with tickets.manage may do anything
drop policy if exists tickets_update on public.tickets;
create policy tickets_update on public.tickets
  for update to authenticated
  using (user_id = auth.uid() or public.has_scope('tickets.manage'))
  with check (user_id = auth.uid() or public.has_scope('tickets.manage'));

drop policy if exists ticket_messages_read on public.ticket_messages;
create policy ticket_messages_read on public.ticket_messages
  for select to authenticated
  using (exists (select 1 from public.tickets t
                  where t.id = ticket_id
                    and (t.user_id = auth.uid() or public.has_scope('tickets.view'))));

drop policy if exists ticket_messages_insert on public.ticket_messages;
create policy ticket_messages_insert on public.ticket_messages
  for insert to authenticated
  with check (
    sender_id = auth.uid()
    and exists (select 1 from public.tickets t
                 where t.id = ticket_id
                   and (t.user_id = auth.uid() or public.has_scope('tickets.reply')))
  );

-- guard: tickets_update lets a customer touch their own ticket, but only to
-- open or close it. Priority, assignment, subject and credit_issued are staff
-- fields, pinned to their previous values for anyone without tickets.manage.
create or replace function public.guard_ticket_update()
returns trigger language plpgsql security definer set search_path = public as $fn$
begin
  if auth.uid() is not null
     and coalesce(current_setting('app.ticket_guard', true), 'on') <> 'off'
     and not public.has_scope('tickets.manage') then
    new.user_id       := old.user_id;
    new.order_id      := old.order_id;
    new.order_item_id := old.order_item_id;
    new.kind          := old.kind;
    new.subject       := old.subject;
    new.priority      := old.priority;
    new.assigned_to   := old.assigned_to;
    new.credit_issued := old.credit_issued;
    new.ticket_number := old.ticket_number;

    if new.status not in ('open', 'closed') then
      new.status := old.status;
    end if;
  end if;

  new.updated_at := now();
  return new;
end; $fn$;

drop trigger if exists on_ticket_update on public.tickets;
create trigger on_ticket_update
  before update on public.tickets
  for each row execute function public.guard_ticket_update();

-- ---------------- STORE CREDIT ----------------
drop policy if exists credit_read on public.credit_ledger;
create policy credit_read on public.credit_ledger
  for select to authenticated
  using (user_id = auth.uid() or public.has_scope('customers.view'));

-- issuing credit goes through issue_store_credit(); no direct client insert.

-- ---------------- BEHAVIOUR SIGNALS ----------------
-- anonymous visitors are tracked by session_id only
drop policy if exists search_insert on public.search_events;
create policy search_insert on public.search_events
  for insert to anon, authenticated
  with check (user_id is null or user_id = auth.uid());

drop policy if exists search_read on public.search_events;
create policy search_read on public.search_events
  for select to authenticated
  using (user_id = auth.uid() or public.has_scope('analytics.view'));

drop policy if exists views_insert on public.product_views;
create policy views_insert on public.product_views
  for insert to anon, authenticated
  with check (user_id is null or user_id = auth.uid());

drop policy if exists views_read on public.product_views;
create policy views_read on public.product_views
  for select to authenticated
  using (user_id = auth.uid() or public.has_scope('analytics.view'));

-- ---------------- REALTIME ----------------
-- live chat: broadcast inserts on ticket_messages to subscribed clients
do $$ begin
  alter publication supabase_realtime add table public.ticket_messages;
exception when duplicate_object then null; end $$;

do $$ begin
  alter publication supabase_realtime add table public.tickets;
exception when duplicate_object then null; end $$;
