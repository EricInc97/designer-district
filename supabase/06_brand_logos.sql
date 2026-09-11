-- ============================================================
-- 06_brand_logos.sql
-- A bucket for brand marks, so one can be swapped without a deploy.
-- Safe to re-run.
-- ============================================================

-- Brand artwork has lived in public/brands, which means a new mark only reaches
-- the site on a deploy. Serving it from storage instead makes brands.logo_url
-- the only thing that has to change, exactly like product photography.
--
-- SVG is allowed here and not in product-images on purpose: brand marks are
-- line art and belong in vector, product photographs do not.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('brand-logos', 'brand-logos', true, 2097152, -- 2 MB
  array['image/svg+xml', 'image/png', 'image/jpeg', 'image/webp', 'image/avif'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists brand_logos_read on storage.objects;
create policy brand_logos_read on storage.objects
  for select using (bucket_id = 'brand-logos');

drop policy if exists brand_logos_insert on storage.objects;
create policy brand_logos_insert on storage.objects
  for insert to authenticated
  with check (bucket_id = 'brand-logos' and public.has_scope('products.manage'));

-- No update or delete policy, for the same reason as product-images: nothing in
-- the app needs either, and withholding them is what actually prevents artwork
-- being destroyed by a client that is already deployed.
