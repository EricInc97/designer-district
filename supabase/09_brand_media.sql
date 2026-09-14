-- ============================================================
-- 09_brand_media.sql
-- Campaign and lookbook artwork for brand pages.
-- Safe to re-run.
-- ============================================================
--
-- A brand page was a header and a grid. This gives it the shape a house's own
-- site has: a full-bleed campaign shot at the top, and editorial bands between
-- the product groups rather than one unbroken run of tiles.
--
-- kind is the slot, not the subject. 'hero' is the one at the top, 'lookbook'
-- are the bands; a house can have one hero and any number of bands, ordered by
-- sort_order and dropped between groups in sequence.

create table if not exists public.brand_media (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references public.brands(id) on delete cascade,
  kind text not null default 'lookbook' check (kind in ('hero', 'lookbook')),
  image_url text not null,
  headline text,
  subhead text,
  cta_label text,
  cta_href text,
  -- Overlaid type has to know whether it is sitting on a light or a dark
  -- photograph. Working that out from the image at render time is not worth
  -- the cost, and whoever uploads it already knows.
  ink text not null default 'light' check (ink in ('light', 'dark')),
  sort_order integer not null default 100,
  is_published boolean not null default true,
  created_at timestamptz not null default now(),
  created_by uuid references public.profiles(id) on delete set null
);

create index if not exists brand_media_brand_idx
  on public.brand_media (brand_id, kind, sort_order);

alter table public.brand_media enable row level security;

drop policy if exists brand_media_read on public.brand_media;
create policy brand_media_read on public.brand_media
  for select to anon, authenticated
  using (is_published or public.has_scope('products.manage'));

drop policy if exists brand_media_write on public.brand_media;
create policy brand_media_write on public.brand_media
  for all to authenticated
  using (public.has_scope('products.manage'))
  with check (public.has_scope('products.manage'));

-- Campaign photography runs larger than a product shot, so this bucket allows
-- more. As with every other bucket here there is deliberately no update or
-- delete policy: nothing in the app needs either, and withholding them is what
-- actually stops an already-deployed client destroying artwork.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('brand-media', 'brand-media', true, 10485760, -- 10 MB
  array['image/png', 'image/jpeg', 'image/webp', 'image/avif'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists brand_media_bucket_read on storage.objects;
create policy brand_media_bucket_read on storage.objects
  for select using (bucket_id = 'brand-media');

drop policy if exists brand_media_bucket_insert on storage.objects;
create policy brand_media_bucket_insert on storage.objects
  for insert to authenticated
  with check (bucket_id = 'brand-media' and public.has_scope('products.manage'));

-- No seed rows. Every house starts with no artwork and falls back to its own
-- colourway with its mark centred, which is a deliberate state rather than an
-- empty one: the same ground its tile uses on the homepage, so arriving on the
-- page feels like walking through the tile.
