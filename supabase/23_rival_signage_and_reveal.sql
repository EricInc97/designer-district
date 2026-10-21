-- ============================================================
-- 23_rival_signage_and_reveal.sql
-- Boards that advertised a competitor in their own background.
-- Safe to re-run.
-- ============================================================
--
-- The prompt let shopfront signage read any of the fifteen house names,
-- which is right for a street scene and wrong for an advertisement.
-- Off-White's board came back with VALE across a screen two storeys high,
-- and Purple Brand's with an AMIRI shopfront beside the model: a
-- competitor's name, in the largest type in the frame, on a board paid
-- for by somebody else.
--
-- The generator now gives an own-house shot only its own name and the
-- district's, and offers blank as the preferred alternative -- a model
-- told only what it may not write will write something anyway.
--
-- Three boards stood down and replaced by pictures shot under that rule:
--
--   off-white-ksubi-photo   KSUBI on two screens behind the models
--   off-white-vale-photo    VALE across the top third of the frame
--   purple-brand-photo      an AMIRI storefront beside the model
--
-- Off-White's replacement is off-white-solo-photo, Purple Brand's is
-- purple-brand-two-photo. Both dress the half the house does not sell in
-- plain unbranded clothes, so nothing in either frame is for sale or on a
-- sign except the house itself.
--
-- Unpublished, not deleted; the files stay in public/campaigns.

update public.brand_media
   set is_published = false
 where kind = 'board'
   and image_url in (
     '/campaigns/off-white-ksubi-photo.webp',
     '/campaigns/off-white-vale-photo.webp',
     '/campaigns/purple-brand-photo.webp'
   );
