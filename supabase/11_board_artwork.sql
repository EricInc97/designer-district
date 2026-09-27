-- ============================================================
-- 11_board_artwork.sql
-- Campaign artwork for the hoardings in the 3D district.
-- Safe to re-run.
-- ============================================================
--
-- The boards over the street have been advertising a product card: a small
-- photograph in a tile, the name, the price. It does not work, and the reason
-- is geometry rather than taste. The boards are turned to face the approach,
-- so they are read at an angle and from thirty metres or more, and at that
-- size a product name truncates to "Balenc…" and a 140-pixel tile of a folded
-- t-shirt is a grey smudge.
--
-- What reads at that distance is one picture and three words. So a house can
-- now have campaign artwork for its boards: a full-bleed image, a line of
-- type, and a call to action. The product card stays as the fallback for any
-- house without artwork yet.
--
-- A new kind rather than a new table. brand_media already carries an image, a
-- headline, a subhead, a CTA and an `ink` flag saying whether overlaid type
-- should be light or dark on it, which is exactly the shape a board needs,
-- and it is already managed by the Brand artwork page in the admin.

/* Drop whatever the old check is actually called.
 *
 * 09 declared it inline — `check (kind in ('hero','lookbook'))` — so its name
 * was generated, and `drop constraint if exists brand_media_kind_check` would
 * quietly do nothing if the generated name differed. The add below would then
 * succeed and the *old* constraint would still be there rejecting 'board',
 * which is the kind of failure that looks like the migration ran. */
do $$
declare c record;
begin
  for c in
    select conname
      from pg_constraint
     where conrelid = 'public.brand_media'::regclass
       and contype = 'c'
       and pg_get_constraintdef(oid) ilike '%kind%'
  loop
    execute format('alter table public.brand_media drop constraint %I', c.conname);
  end loop;
end $$;

alter table public.brand_media
  add constraint brand_media_kind_check
  check (kind in ('hero', 'lookbook', 'board'));

-- The district asks for these by brand on every catalogue refresh, so the
-- lookup wants to be cheap and to skip anything unpublished.
create index if not exists brand_media_board_idx
  on public.brand_media (brand_id, sort_order)
  where kind = 'board' and is_published;

comment on column public.brand_media.kind is
  'hero = top of the brand page; lookbook = editorial bands between product '
  'groups; board = campaign artwork for the LED hoardings in the 3D district.';

/* Which shape the artwork was made for.
 *
 * The hoardings are not one shape: there are eight aspect classes on the
 * street, from a 0.48 portrait flanker to a 4.33 facade banner. A board
 * draws its artwork to *cover*, so hanging a 21:9 image on a 3.17 board
 * crops a quarter of its height away, and a full-length figure loses its
 * head. Recording what a piece was composed for lets each board pick the
 * closest thing it has rather than the first thing in the list.
 *
 * Free text rather than an enum: the generator writes whatever ratio it
 * actually asked for, and a null simply means "unknown, use it anywhere".
 */
alter table public.brand_media
  add column if not exists aspect text;

comment on column public.brand_media.aspect is
  'Aspect the artwork was composed for, e.g. 2:3, 16:9, 21:9. Boards pick the '
  'closest match to their own shape. Null means no preference.';
