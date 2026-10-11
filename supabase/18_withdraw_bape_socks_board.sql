-- ============================================================
-- 18_withdraw_bape_socks_board.sql
-- Bape's socks picture, taken down again.
-- Safe to re-run.
-- ============================================================
--
-- Withdrawn on request, for now. The file stays in public/campaigns and
-- the row keeps its copy and its four product_ids, so putting it back is
-- one update.
--
-- What this costs, so it is not a surprise later: Bape has no other
-- published board, so its page returns to the house colourway with its
-- mark centred. Vale drops from two slides to one — it was in this
-- picture too, because Bape sells no clothing and the shorts above the
-- socks had to come from somewhere. Product pages carrying a hero go from
-- 45 to 41: the two Bape socks and the two Vale shorts in the shot lose
-- theirs, and none of the four appears in any other picture, by design —
-- the generator will not photograph the same garment twice.
--
-- Worth remembering if Bape is ever shot again: it stocks seven sock SKUs
-- and not one garment, so any Bape picture is a socks picture and will
-- always need another house's clothing in frame above it.

update public.brand_media
   set is_published = false
 where kind = 'board'
   and image_url = '/campaigns/bape-socks-photo.webp';
