-- ============================================================
-- 16_retire_anime_boards.sql
-- The first five anime boards stood down for photographs.
-- Safe to re-run.
-- ============================================================
--
-- The district is moving from hand-painted cel artwork to photography. All
-- forty-four of the drawn boards go eventually; they go one at a time, as a
-- photograph arrives to take the place of each, so nothing is ever bare.
-- Five in, five out: the published count did not move.
--
-- Unpublished, not deleted. The files are still on disk and the rows still
-- carry their product_ids, so any of this is one update away from coming
-- back if the photographs turn out worse than the drawings.
--
-- Which five, and why each:
--
--   chrome-hearts-tower  the most over-exposed board in the catalogue, at
--                        thirteen prior appearances across its two garments
--   amiri-tower          same shape as its replacement, highest reuse of the
--                        two Amiri boards
--   rhude-day            all three Rhude boards tie on reuse; this is the
--                        9:16, the shape the street has most of
--   casablanca-wide      chosen over casablanca-vale deliberately: that one
--                        is a collaboration carrying Vale shorts, and
--                        retiring it would have quietly taken a slide off
--                        Vale's page too, which nobody asked for
--   essentials-tower     not about exposure. This one is wrong: it shows a
--                        grey hoodie with black shorts, halves of two
--                        different sets, because set_key did not exist when
--                        it was generated. Its replacement is the black set
--                        shot as a set.

update public.brand_media
   set is_published = false
 where kind = 'board'
   and image_url in (
     '/campaigns/chrome-hearts-tower.webp',
     '/campaigns/casablanca-wide.webp',
     '/campaigns/amiri-tower.webp',
     '/campaigns/rhude-day.webp',
     '/campaigns/essentials-tower.webp'
   );
