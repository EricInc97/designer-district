-- ============================================================
-- 20_set_names_and_supreme_trim.sql
-- Names for the co-ordinated sets, and one Supreme board stood down.
-- Safe to re-run.
-- ============================================================
--
-- Sets get a name of their own so they can be merchandised. A set_key is a
-- slug and reads like one; deriving "Ducati Track Set, Black" from
-- "supreme-ducati-black" with a title-case helper would be guessing at
-- copy. This is copy, so it lives in the data.
--
-- And the Supreme page was advertising the same jackets twice. Two boards
-- carried the Ducati track sets: supreme-sets-photo with all six halves,
-- all three colourways, and supreme-hoodie-photo with the black set on its
-- own. The second says nothing the first does not, so it goes. Unpublished
-- rather than deleted, like every other retirement here.

alter table public.products
  add column if not exists set_name text;

comment on column public.products.set_name is
  'What a co-ordinated set is called on a collection band. Lives beside '
  'set_key rather than being derived from it: a slug reads as a slug, and '
  'merchandising copy belongs in the data, not in a title-case helper.';

update public.products p set set_name = v.name
  from (values
        ('supreme-ducati-white-red', 'Ducati Track Set, Cream'),
        ('supreme-ducati-blue',      'Ducati Track Set, Blue'),
        ('supreme-ducati-black',     'Ducati Track Set, Black'),
        ('casablanca-teal',          'Teal Two-Piece'),
        ('casablanca-black',         'Black Two-Piece'),
        ('casablanca-white',         'White Two-Piece'),
        ('casablanca-terry-green',   'Green Terry Set'),
        ('casablanca-terry-blue',    'Blue Terry Set'),
        ('essentials-fleece-grey',   'Grey Fleece Set'),
        ('essentials-fleece-black',  'Black Fleece Set')
       ) as v(key, name)
 where p.set_key = v.key;

update public.brand_media
   set is_published = false
 where kind = 'board'
   and image_url = '/campaigns/supreme-hoodie-photo.webp';
