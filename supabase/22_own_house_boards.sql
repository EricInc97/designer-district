-- ============================================================
-- 22_own_house_boards.sql
-- Four pictures that sell one house each, and two that did not.
-- Safe to re-run.
-- ============================================================
--
-- Until now, a house that sold only one half of an outfit had the other
-- half borrowed from a neighbour. Chrome Hearts stocks nineteen tops and
-- no trousers; Purple Brand and Ksubi sell denim and no tops. Somebody has
-- to be dressed, so every such picture became a collaboration -- and then
-- advertised a rival on the page it hung from.
--
-- The fix is plain clothes. The half a house does not sell is now an
-- unbranded white or black tee, or plain unbranded denim: described in the
-- prompt rather than referenced from a photograph, carrying no product_id,
-- so nothing in the frame is for sale except this house's own work.
--
-- Two consequences worth recording.
--
-- Purple Brand and Ksubi have a board of their own for the first time.
-- Both sell bottoms and nothing else, so until now they could only ever
-- appear as somebody else's guest.
--
-- And two cross-branded boards are stood down, each replaced by a
-- single-house picture of the same house: chrome-amiri-photo by
-- chrome-hearts-solo-photo, and supreme-ksubi-two-photo by
-- supreme-solo-photo. Unpublished, not deleted.

update public.brand_media
   set is_published = false
 where kind = 'board'
   and image_url in (
     '/campaigns/chrome-amiri-photo.webp',
     '/campaigns/supreme-ksubi-two-photo.webp'
   );
