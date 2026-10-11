-- ============================================================
-- 19_batch_three_boards.sql
-- Six more photographs, and the first Chrome Hearts one retired.
-- Safe to re-run.
-- ============================================================
--
-- Chrome Hearts is why this batch exists. Its first photograph is a single
-- man shot from the waist up, and that framing was not a choice: the house
-- sells nineteen tops and not one pair of trousers, so there was nothing to
-- put on his legs. Borrowing Amiri denim fixes it properly — two models,
-- full length, and a collaboration both houses get a slide from.
--
-- Mostly 9:16, because the phone is the surface that matters and 9:16 is
-- the shape that fills one: 375 by 667, which is 82% of the screen, against
-- 563 for a 2:3. The trade is on a desktop, where upright boards are bounded
-- by height and centred, so a 9:16 comes out narrower than a 2:3. Worth it
-- in that order. Two of the six stay 2:3 so the street keeps a mix.
--
-- Bape skipped, as asked. It has no board now and sells only socks, so
-- there is nothing to photograph on its own.
--
-- The old Chrome Hearts board is unpublished rather than deleted, like
-- every other retirement here: the file is still in public/campaigns and
-- the row keeps its copy and product_ids.

update public.brand_media
   set is_published = false
 where kind = 'board'
   and image_url = '/campaigns/chrome-hearts-photo.webp';
