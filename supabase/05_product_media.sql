-- ============================================================
-- 05_product_media.sql
-- Item numbers for inventory, and a bucket for product photography.
-- Safe to re-run.
-- ============================================================

-- ---------------- ITEM NUMBERS ----------------
-- Every product carries a stable, human-quotable item number: DD-BAP-00007.
-- The brand code comes from the slug so it survives a brand being renamed,
-- and the counter is a real sequence rather than a count(*), so two people
-- saving at the same moment cannot land on the same number.

create sequence if not exists public.product_sku_seq;

alter table public.products add column if not exists sku text;

create or replace function public.brand_code(p_brand_id uuid)
returns text
language sql
stable
set search_path = public, pg_temp
as $$
  select upper(left(regexp_replace(coalesce(b.slug, b.name), '[^a-zA-Z]', '', 'g'), 3))
  from public.brands b
  where b.id = p_brand_id;
$$;

create or replace function public.assign_product_sku()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if new.sku is null or btrim(new.sku) = '' then
    new.sku := 'DD-'
      || coalesce(nullif(public.brand_code(new.brand_id), ''), 'XXX')
      || '-'
      || lpad(nextval('public.product_sku_seq')::text, 5, '0');
  end if;
  return new;
end;
$$;

drop trigger if exists trg_product_sku on public.products;
create trigger trg_product_sku
  before insert on public.products
  for each row execute function public.assign_product_sku();

-- Backfill in a deterministic order, so re-running the seed from scratch and
-- running this against a live table produce the same numbering.
with ordered as (
  select id, row_number() over (order by created_at, slug, id) as rn
  from public.products
  where sku is null
)
update public.products p
set sku = 'DD-'
  || coalesce(nullif(public.brand_code(p.brand_id), ''), 'XXX')
  || '-' || lpad(o.rn::text, 5, '0')
from ordered o
where o.id = p.id;

select setval(
  'public.product_sku_seq',
  greatest((select count(*) from public.products), 1),
  true
);

alter table public.products alter column sku set not null;

create unique index if not exists products_sku_key on public.products (sku);

-- The trigger runs as the caller, so the caller needs the counter.
grant usage, select on sequence public.product_sku_seq to authenticated;
revoke all on function public.brand_code(uuid) from public;
revoke all on function public.assign_product_sku() from public;
grant execute on function public.brand_code(uuid) to authenticated;
grant execute on function public.assign_product_sku() to authenticated;

-- ---------------- PRODUCT IMAGERY ----------------
-- Public bucket: product photography is public by definition, and a public
-- bucket means <img src> works with no signing round-trip. Writing is still
-- gated on the same scope that gates editing the product itself.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'product-images',
  'product-images',
  true,
  5242880, -- 5 MB
  array['image/png', 'image/jpeg', 'image/webp', 'image/avif']
)
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists product_images_read on storage.objects;
create policy product_images_read on storage.objects
  for select
  using (bucket_id = 'product-images');

drop policy if exists product_images_insert on storage.objects;
create policy product_images_insert on storage.objects
  for insert to authenticated
  with check (bucket_id = 'product-images' and public.has_scope('products.manage'));

-- No update or delete policy, deliberately.
--
-- Every upload takes a fresh uuid path, so nothing legitimately overwrites an
-- existing object, and nothing in the app needs to delete one: deleting a
-- product removes the row and leaves the file, and the uploader only detaches
-- an image from a product.
--
-- An earlier build of the uploader did delete, and destroyed photographs that
-- saved products were still pointing at. Withholding the permission here is
-- what actually prevents that, because it holds for every client already
-- deployed rather than depending on shipping new JavaScript. Housekeeping of
-- unreferenced files is a dashboard or service-role job, both of which bypass
-- RLS; note that Postgres also blocks deleting from storage.objects directly,
-- so it has to go through the Storage API.
