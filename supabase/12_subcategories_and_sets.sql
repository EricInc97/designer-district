-- ============================================================
-- 12_subcategories_and_sets.sql
-- Sub-categories for products, and co-ordinated sets.
-- Safe to re-run.
-- ============================================================
--
-- Two problems, both of which show up as bad marketing rather than as bad
-- data.
--
-- ONE. "accessories" is doing too much work. Chrome Hearts has thirty-two
-- accessories in stock: twenty-three of them are beanies and snapbacks and
-- the rest are socks. Nothing in the schema can tell those apart, so asking
-- "what hats does this house sell?" means matching on the product name, and
-- a name match is a guess that silently goes wrong. It already did: reading
-- a truncated list of accessory names led to the conclusion that only
-- Godspeed sold headwear, which is off by twenty-three.
--
-- TWO. A hoodie and the pants that match it are two unrelated rows. Supreme
-- stocks the Ducati track top and the track pants in white/red, blue and
-- black, and the only place the colourway is recorded is inside the
-- photograph. So a "shop the look" that wants to put a matching set on a
-- model has nothing to join on, and pairing them by list order gets two of
-- the three wrong — the pants are not stored in the same order as the tops.

-- ── sub-categories ────────────────────────────────────────────────────────
-- Modelled on `categories`, which is the table next door: same shape, same
-- policies, so the admin can manage it the same way.

create table if not exists public.subcategories (
  id          uuid primary key default gen_random_uuid(),
  category_id uuid not null references public.categories(id) on delete cascade,
  name        text not null,
  slug        text not null,
  sort_order  integer not null default 100,
  created_at  timestamptz not null default now(),
  -- Slugs are unique within a parent, not globally: "caps" under headwear
  -- and "caps" under something else later should not collide.
  unique (category_id, slug)
);

alter table public.subcategories enable row level security;

do $$
begin
  if not exists (select 1 from pg_policy
                  where polrelid = 'public.subcategories'::regclass
                    and polname = 'subcategories_read') then
    create policy subcategories_read on public.subcategories
      for select using (true);
  end if;
  if not exists (select 1 from pg_policy
                  where polrelid = 'public.subcategories'::regclass
                    and polname = 'subcategories_write') then
    create policy subcategories_write on public.subcategories
      for all using (has_scope('products.manage'))
      with check (has_scope('products.manage'));
  end if;
end $$;

alter table public.products
  add column if not exists subcategory_id uuid
    references public.subcategories(id) on delete set null;

create index if not exists products_subcategory_idx
  on public.products (subcategory_id) where subcategory_id is not null;

comment on table public.subcategories is
  'A second level under categories: accessories splits into beanies, '
  'snapbacks, socks and so on. Lets the district ask a house for its hats '
  'without matching on product names.';

-- ── co-ordinated sets ─────────────────────────────────────────────────────
/* `is_set` is the flag that was asked for, and `set_key` is what makes it
 * useful.
 *
 * A boolean on its own can say "this garment is part of a set" but not
 * which set, so a look still cannot put the right pants with the right top:
 * with three colourways in stock a boolean gives three tops and three
 * bottoms and no way to tell which goes with which. The key is the join.
 * The flag is kept anyway because it is what the admin filters on, and
 * because "part of a set" and "which set" are genuinely two questions.
 */
alter table public.products
  add column if not exists is_set  boolean not null default false,
  add column if not exists set_key text;

create index if not exists products_set_idx
  on public.products (set_key) where set_key is not null;

comment on column public.products.is_set is
  'True when this garment is half of a co-ordinated set (a track top and '
  'its matching pants). Filterable on its own.';
comment on column public.products.set_key is
  'Which set, e.g. supreme-ducati-blue. Two rows sharing a key are meant to '
  'be worn together; is_set alone cannot say that.';

-- ── seed the sub-categories ───────────────────────────────────────────────

insert into public.subcategories (category_id, name, slug, sort_order)
select c.id, v.name, v.slug, v.sort_order
  from public.categories c
  join (values
        ('accessories', 'Beanies',  'beanies',  10),
        ('accessories', 'Snapbacks','snapbacks',20),
        ('accessories', 'Caps',     'caps',     30),
        ('accessories', 'Bucket hats','bucket-hats', 40),
        ('accessories', 'Socks',    'socks',    50),
        ('accessories', 'Underwear','underwear',60),
        ('accessories', 'Belts',    'belts',    70),
        ('accessories', 'Bags',     'bags',     80),
        ('hoodies',     'Track tops','track-tops', 10),
        ('bottoms',     'Track pants','track-pants', 10),
        ('bottoms',     'Shorts',   'shorts',   20),
        ('bottoms',     'Sweatpants','sweatpants', 30)
       ) as v(cat, name, slug, sort_order)
    on v.cat = c.slug
on conflict (category_id, slug) do nothing;

-- ── file the existing stock ───────────────────────────────────────────────
/* Name matching, done once, here, where it can be read and corrected —
 * rather than at every call site for ever. Anything that does not match
 * keeps a null sub-category, which simply means "not filed yet". */

update public.products p
   set subcategory_id = s.id
  from public.subcategories s
  join public.categories c on c.id = s.category_id
 where p.category_id = c.id
   and p.subcategory_id is null
   and case s.slug
         when 'beanies'     then p.name ~* '\mbeanie'
         when 'snapbacks'   then p.name ~* '\msnapback|\mfitted\M'
         when 'caps'        then p.name ~* '\mcap\M|\mhat\M' and p.name !~* 'bucket|beanie|snapback'
         when 'bucket-hats' then p.name ~* 'bucket'
         when 'socks'       then p.name ~* '\msock'
         when 'underwear'   then p.name ~* '\mbrief|\mboxer'
         when 'belts'       then p.name ~* '\mbelt'
         when 'bags'        then p.name ~* '\mbag\M|tote|backpack'
         when 'track-tops'  then p.name ~* 'track'
         when 'track-pants' then p.name ~* 'track'
         when 'shorts'      then p.name ~* '\mshort'
         when 'sweatpants'  then p.name ~* 'sweatpant|jogger'
         else false
       end;

-- ── the Supreme x Ducati track sets ───────────────────────────────────────
/* Paired by opening the six photographs, because the colourway is recorded
 * nowhere else: the names are all "Supreme Track Hoodie" or "Supreme Track
 * Pants", and the descriptions are empty. The tops and the bottoms are not
 * stored in the same order, so pairing them by position would have matched
 * blue to black and black to blue. */

update public.products set is_set = true, set_key = v.key
  from (values
        ('4bc42d5e-4ee9-4bc3-807c-56767afb0c3a'::uuid, 'supreme-ducati-white-red'),
        ('aa0a7ff2-53f4-43b9-90d7-cfa2a8df907e'::uuid, 'supreme-ducati-white-red'),
        ('36203eef-07e5-4219-bb78-dc0f8ae8fc0f'::uuid, 'supreme-ducati-blue'),
        ('68cb7a66-5997-49a7-8fa5-3a95d7bf4021'::uuid, 'supreme-ducati-blue'),
        ('3214dd62-ed02-465a-93a2-70bdec23dbd4'::uuid, 'supreme-ducati-black'),
        ('6c2dd3a5-1d83-4d6f-9b6b-44990e7aa9b7'::uuid, 'supreme-ducati-black')
       ) as v(id, key)
 where products.id = v.id;
