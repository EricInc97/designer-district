-- ============================================================
-- 15_casablanca_and_essentials_sets.sql
-- The co-ordinated sets that were not marked as sets.
-- Safe to re-run.
-- ============================================================
--
-- Supreme's three Ducati track sets were paired in 12. Two more houses sell
-- the same way and were still listed as loose garments: Casablanca has five
-- top-and-bottom sets, and Essentials has two fleece sets. Thirteen
-- products that a shopper would recognise as seven outfits.
--
-- Why this matters beyond a badge on a card: set_key is what the campaign
-- generator reads to dress a model in a whole outfit rather than a top from
-- one set and a bottom from another. Until a pair is keyed, every picture
-- using them is one bad roll of the dice away from a mismatch, and nothing
-- in the pipeline would catch it.
--
-- Keyed by SKU rather than by uuid. The SKUs are what the stockroom uses
-- and what was handed over, and a reviewer can check this file against a
-- shelf; a column of uuids can only be checked against another query.

-- ── Casablanca ───────────────────────────────────────────────────────────
/* Five sets, each one top and one bottom.
 *
 * The first three pair on colour and the descriptions already agreed: teal
 * with teal, black with black, white with white.
 *
 * The last two could not be settled from the text. Both are terry
 * towelling in the house's diamond-monogram jacquard, and three of the four
 * rows called themselves white or off-white, so on the written record they
 * were one indistinguishable pile. Opening the photographs separated them
 * immediately: one pair is cream with GREEN piping, the other is pale blue
 * with NAVY piping, and each pair carries the same red diamond patch in the
 * same place. Hence the keys name the piping, which is the thing you can
 * actually see from across a room.
 */
update public.products p set is_set = true, set_key = v.key
  from (values
        ('DD-CAS-00118', 'casablanca-teal'),         -- teal t-shirt
        ('DD-CAS-00119', 'casablanca-teal'),         -- teal shorts
        ('DD-CAS-00120', 'casablanca-black'),        -- black t-shirt
        ('DD-CAS-00133', 'casablanca-black'),        -- black shorts
        ('DD-CAS-00121', 'casablanca-white'),        -- white t-shirt
        ('DD-CAS-00122', 'casablanca-white'),        -- white shorts
        ('DD-CAS-00136', 'casablanca-terry-green'),  -- cream terry shirt, green piping
        ('DD-CAS-00126', 'casablanca-terry-green'),  -- cream terry shorts, green piping
        ('DD-CAS-00134', 'casablanca-terry-blue'),   -- pale blue terry shirt, navy piping
        ('DD-CAS-00127', 'casablanca-terry-blue')    -- pale blue terry shorts, navy piping
       ) as v(sku, key)
 where p.sku = v.sku;

-- ── Essentials ───────────────────────────────────────────────────────────
/* Two fleece sets, hoodie and matching shorts.
 *
 * Read off the photographs: the heather-grey hoodie and the heather-grey
 * shorts are the same fleece with the same flock print, and the black pair
 * likewise, down to the rubber waistband label.
 *
 * The two t-shirts are deliberately left loose. They share the colourways
 * exactly — there is a grey tee and a black tee — but they are jersey, not
 * fleece, so they are a matching piece rather than half of the set. Keying
 * a tee to the same shorts would also mean claiming those shorts belong to
 * two sets, which one set_key column cannot say and a shopper would not
 * believe. If they should be three-piece sets, add the tees to these same
 * two keys; nothing else has to change.
 */
update public.products p set is_set = true, set_key = v.key
  from (values
        ('DD-ESS-00081', 'essentials-fleece-grey'),  -- grey hoodie
        ('DD-ESS-00144', 'essentials-fleece-grey'),  -- grey shorts
        ('DD-ESS-00082', 'essentials-fleece-black'), -- black hoodie
        ('DD-ESS-00080', 'essentials-fleece-black')  -- black shorts
       ) as v(sku, key)
 where p.sku = v.sku;

-- ── what the photographs said and the rows did not ───────────────────────
/* Three corrections found while pairing. Each one is a thing the catalogue
 * asserted that the picture contradicts, so the picture wins.
 *
 * DD-CAS-00121 is sold as a "God Speed T-shirt" and is not one: the print
 * is the CASA BLANCA logo block and the neck label says Casablanca. It is
 * filed under Casablanca, priced as Casablanca and now named as Casablanca.
 *
 * The other two called pale blue terry "off-white" and "white", which is
 * what made the two terry sets impossible to tell apart on paper.
 */
update public.products set name = 'Casablanca T-shirt'
 where sku = 'DD-CAS-00121' and name <> 'Casablanca T-shirt';

update public.products set description = 'Pale blue Casablanca shirt.'
 where sku = 'DD-CAS-00134';

update public.products set description = 'Pale blue Casablanca shorts.'
 where sku = 'DD-CAS-00127';

-- ── say so in the copy, as the Supreme sets do ───────────────────────────
/* The existing sets end their description with this line, and it is the
 * only place a shopper reading a product page is told the thing comes with
 * a match. Appended rather than rewritten so the colour sentence survives,
 * and guarded so a re-run does not stack the sentence up twice.
 */
update public.products
   set description = coalesce(description, '') ||
       case when coalesce(description, '') = '' then '' else ' ' end ||
       'Sold as a matching set with its other half.'
 where set_key is not null
   and set_key not like 'supreme-%'
   and coalesce(description, '') not like '%matching set%';
