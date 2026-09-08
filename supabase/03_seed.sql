-- ============================================================
-- DESIGNER DISTRICT, Scope catalogue + mock catalog data
-- Safe to re-run (idempotent on natural keys).
-- ============================================================

-- ---------------- THE SCOPE LIST ----------------
insert into public.app_scopes (key, label, description, category, sort_order) values
  ('products.view',    'View draft products',   'See unpublished products in the admin catalog',        'Catalog',   10),
  ('products.manage',  'Add & edit products',   'Create and edit products, brands and categories',      'Catalog',   20),
  ('products.publish', 'Publish products',      'Flip products between draft and live on the storefront','Catalog',   30),
  ('products.delete',  'Delete products',       'Permanently remove a product from the catalog',        'Catalog',   40),
  ('orders.view',      'View orders',           'Read any customer order and its line items',           'Orders',    50),
  ('orders.manage',    'Manage orders',         'Change order status, mark fulfilled / shipped',        'Orders',    60),
  ('tickets.view',     'View tickets',          'Read the full support queue',                          'Support',   70),
  ('tickets.reply',    'Reply in chat',         'Send live-chat messages on any ticket',                'Support',   80),
  ('tickets.manage',   'Manage tickets',        'Assign, reprioritise, resolve and close tickets',      'Support',   90),
  ('tickets.refund',   'Issue store credit',    'Grant store-credit refunds against a ticket',          'Support',  100),
  ('customers.view',   'View customers',        'Read customer profiles and store-credit balances',     'Customers',110),
  ('analytics.view',   'View analytics',        'Revenue, orders, search and support analytics',        'Insights', 120),
  ('staff.manage',     'Manage staff',          'Add employees and grant or revoke scopes',             'Admin',    130)
on conflict (key) do update
  set label = excluded.label,
      description = excluded.description,
      category = excluded.category,
      sort_order = excluded.sort_order;

-- ---------------- CATEGORIES ----------------
insert into public.categories (name, slug) values
  ('Hoodies',     'hoodies'),
  ('T-Shirts',    't-shirts'),
  ('Outerwear',   'outerwear'),
  ('Denim',       'denim'),
  ('Accessories', 'accessories'),
  ('Footwear',    'footwear')
on conflict (slug) do nothing;

-- ---------------- BRANDS ----------------
-- logo_url is the house's own mark. Where it is null, BrandMark falls back to
-- a wordmark set in a lookalike face. Drop an asset at public/brands/<slug>.<ext>
-- and point this column at '/brands/<slug>.<ext>' to use the real one.
insert into public.brands (name, slug, logo_url, description, sort_order) values
  ('Bape',          'bape',          '/brands/bape.png', 'A Bathing Ape. Ura-Harajuku camo, shark hoodies and 1st Camo since 1993.', 10),
  ('Chrome Hearts', 'chrome-hearts', '/brands/chrome-hearts.png', 'Hollywood-born sterling silver, leather and gothic cross motifs.',          20),
  ('Supreme',       'supreme',       null, 'The downtown New York box logo. Skate, art and weekly drops since 1994.',   30),
  ('Amiri',         'amiri',         null, 'Mike Amiri''s Los Angeles house. Rock-and-roll tailoring, hand-distressed denim and bone-and-black restraint.', 40),
  ('Balenciaga',    'balenciaga',    null, 'The Paris house rebuilt around utility. Condensed logo type, exaggerated volume and the sneaker that started it.', 50),
  ('Gallery Dept.', 'gallery-dept',  '/brands/gallery-dept.png', 'Josue Thomas'' Los Angeles studio. Hand-painted, distressed and reworked, one piece at a time.', 60),
  ('Godspeed',      'godspeed',      null, 'New York streetwear with a gothic streak. Religious motifs, boxy cuts and limited drops.', 70),
  ('Purple Brand',  'purple-brand',  null, 'Los Angeles denim label built on premium washes, painted wordmarks and a low-rise silhouette.', 80),
  ('Off-White',     'off-white',     null, 'Virgil Abloh''s Milan house. Helvetica caps, quotation marks and the diagonal crosswalk stripe.', 90),
  ('Casablanca',    'casablanca',    null, 'Charaf Tajer''s Paris label. Apres-sport luxury in silk, pastel prints and Mediterranean colour.', 100),
  ('Ksubi',         'ksubi',         '/brands/ksubi.png', 'Sydney denim house turned Los Angeles. Shredded washes, the scrawled signature and a hard rock-and-roll cut.', 110),
  ('Essentials',    'essentials',    '/brands/essentials.png', 'Fear of God''s core line. Oversized basics in cement, taupe and bone, with the rubberised logo.', 120)
on conflict (slug) do update
  set logo_url = excluded.logo_url,
      description = excluded.description,
      sort_order = excluded.sort_order;

-- ---------------- PRODUCTS ----------------
-- No sku column here on purpose: 05_product_media.sql installs a trigger that
-- assigns the item number off a sequence, for seeded and admin-created rows
-- alike.
insert into public.products
  (brand_id, category_id, name, slug, description, price, compare_at_price, image_url, sizes, stock_count, is_published, is_featured)
select b.id, c.id, v.name, v.slug, v.description, v.price, v.compare_at, '/ph/' || v.slug,
       '{S,M,L,XL}'::text[], v.stock, true, v.featured
from (values
  -- Bape
  ('bape','hoodies',    'Shark Full-Zip Hoodie',        'shark-full-zip-hoodie',        'The icon. Full-zip 1st Camo shell with the shark-face hood, WGM sleeve embroidery and heavyweight brushed-back fleece.', 528.00, 620.00, 12, true),
  ('bape','t-shirts',   'ABC Camo Ape Head Tee',        'abc-camo-ape-head-tee',        'Heavyweight cotton tee with a woven ABC camo ape-head applique at the chest.', 145.00, null, 34, false),
  ('bape','outerwear',  '1st Camo Coach Jacket',        '1st-camo-coach-jacket',        'Water-repellent coach jacket in 1st Camo with snap placket and rubber Ape Head patch.', 465.00, null, 7, true),
  ('bape','accessories','Ape Head Trucker Cap',         'ape-head-trucker-cap',         'Six-panel trucker with mesh back and embroidered Ape Head.', 118.00, null, 21, false),
  -- Chrome Hearts
  ('chrome-hearts','t-shirts',   'Cemetery Cross Tee',    'cemetery-cross-tee',    'Made in USA heavyweight cotton with the Cemetery Cross print at the back and horseshoe logo at the chest.', 395.00, null, 9, true),
  ('chrome-hearts','hoodies',    'Horseshoe Logo Hoodie', 'horseshoe-logo-hoodie', 'Boxy French terry hoodie with flocked horseshoe logo and dagger-print sleeve.', 890.00, 980.00, 4, true),
  ('chrome-hearts','accessories','Sterling Cross Ring',   'sterling-cross-ring',   '925 sterling silver band with hand-finished cross detail. Made in Hollywood.', 745.00, null, 6, false),
  ('chrome-hearts','outerwear',  'Leather Cross Patch Jacket','leather-cross-patch-jacket','Full-grain black leather jacket with signature cross patch panelling and silver hardware.', 8400.00, null, 1, true),
  -- Supreme
  ('supreme','t-shirts',   'Box Logo Tee',          'box-logo-tee',          'The white-on-red box logo on a mid-weight cotton tee. The one everybody queues for.', 68.00, null, 48, true),
  ('supreme','hoodies',    'Box Logo Hooded Sweatshirt','box-logo-hooded-sweatshirt','Heavyweight crossgrain fleece hoodie with the embroidered box logo. Cotton/poly blend.', 168.00, 220.00, 5, true),
  ('supreme','outerwear',  'S Logo Puffer Jacket',  's-logo-puffer-jacket',  'Down-filled puffer with water-resistant shell and reflective S logo.', 398.00, null, 8, false),
  ('supreme','accessories','Canvas Duffle Bag',     'canvas-duffle-bag',     'Cordura-reinforced duffle with the printed logo webbing strap.', 178.00, null, 16, false),
  -- Amiri
  ('amiri','denim',        'MX1 Bandana Patch Jean',        'mx1-bandana-patch-jean',        'Hand-distressed stretch denim with leather and bandana panelling at the knee, finished in Los Angeles.', 1090.00, null,    6,  true),
  ('amiri','t-shirts',     'Bones Logo Tee',                'bones-logo-tee',                'Garment-dyed cotton tee with the bones lettering screen-printed at the chest.', 390.00, null,   17, false),
  ('amiri','hoodies',      'Core Logo Hoodie',              'amiri-core-logo-hoodie',        'Loop-back cotton hoodie carrying the slender serif wordmark across the chest.', 690.00, 790.00, 8,  true),
  ('amiri','footwear',     'Skel-Top Low Sneaker',          'skel-top-low-sneaker',          'Leather low-top with the skeletal overlay at the side and a vulcanised sole.', 595.00, null,   11, false),
  -- Balenciaga
  ('balenciaga','hoodies',     'Campaign Logo Hoodie',      'campaign-logo-hoodie',          'Oversized brushed-fleece hoodie with the condensed logo printed front and back.', 1150.00, null,    5,  true),
  ('balenciaga','t-shirts',    'Logo Oversized Tee',        'logo-oversized-tee',            'Boxy heavyweight jersey tee with the wordmark at the chest and dropped shoulders.', 650.00, 750.00, 13, false),
  ('balenciaga','footwear',    'Triple S Trainer',          'triple-s-trainer',              'The quadruple-stacked sole in mesh, nubuck and leather. The one that reset the category.', 1190.00, null,    4,  true),
  ('balenciaga','accessories', 'Cities Logo Cap',           'cities-logo-cap',               'Cotton-drill six-panel cap with the embroidered city lettering at the front.', 495.00, null,   19, false),
  -- Gallery Dept.
  ('gallery-dept','denim',     'Paint Splatter Carpenter Jean', 'paint-splatter-carpenter-jean', 'Reworked vintage carpenter denim, hand-splattered and sun-faded. No two pairs alike.', 850.00, null,    7,  true),
  ('gallery-dept','t-shirts',  'ATK Logo Tee',              'atk-logo-tee',                  'Washed cotton tee with the hand-drawn logo printed off-register at the chest.', 295.00, null,   21, false),
  ('gallery-dept','hoodies',   'Painted Logo Hoodie',       'painted-logo-hoodie',           'Heavyweight fleece hoodie with the wordmark laid on by hand in acrylic.', 625.00, 720.00, 9,  false),
  ('gallery-dept','outerwear', 'Hand-Painted Work Jacket',  'hand-painted-work-jacket',      'Vintage cotton-drill chore jacket, stripped, repainted and patched in the studio.', 1250.00, null,    3,  true),
  -- Godspeed
  ('godspeed','hoodies',     'Angel Wings Hoodie',          'angel-wings-hoodie',            'Heavyweight boxy hoodie with the puff-print wing graphic across the back.', 180.00, null,   26, true),
  ('godspeed','t-shirts',    'Salvation Tee',               'salvation-tee',                 'Oversized cotton tee with the gothic lettering front and the salvation graphic at the back.', 95.00, null,   38, false),
  ('godspeed','outerwear',   'Souvenir Varsity Jacket',     'souvenir-varsity-jacket',       'Satin varsity with chain-stitch lettering, striped rib trims and a quilted lining.', 340.00, 395.00, 10, true),
  ('godspeed','accessories', 'Gothic Logo Beanie',          'gothic-logo-beanie',            'Ribbed cuffed beanie with the embroidered gothic wordmark.', 65.00, null,   44, false),
  -- Purple Brand
  ('purple-brand','denim',      'P001 Low Rise Skinny Jean', 'p001-low-rise-skinny-jean', 'Premium stretch denim in a low-rise skinny cut, with the painted wordmark down the leg and a cowhide patch at the back.', 295.00, null,   14, false),
  ('purple-brand','denim',      'P005 Straight Leg Jean',    'p005-straight-leg-jean',    'Rigid straight-leg denim, five-pocket styling, bar-tack stitching and chambray lining.', 320.00, 380.00, 9,  false),
  ('purple-brand','t-shirts',   'Painted Wordmark Tee',      'painted-wordmark-tee',      'Heavyweight cotton tee carrying the flocked wordmark across the chest.', 165.00, null,   22, false),
  ('purple-brand','hoodies',    'Core Logo Hoodie',          'purple-core-logo-hoodie',   'Loop-back cotton hoodie with the letterspaced logo printed at the chest.', 285.00, null,   11, true),
  -- Off-White
  ('off-white','hoodies',    'Diag Arrow Hoodie',      'diag-arrow-hoodie',      'Cotton hoodie carrying the diagonal stripe at the back and the arrows motif at the chest.', 685.00, null,   7,  true),
  ('off-white','t-shirts',   'Caravaggio Print Tee',   'caravaggio-print-tee',   'Oversized cotton tee with the Renaissance print at the back and quotation-mark lettering at the front.', 395.00, null,   16, false),
  ('off-white','accessories','Industrial Belt',        'industrial-belt',        'The signature webbing belt in industrial yellow with a metal buckle and keeper.', 245.00, null,   19, false),
  ('off-white','footwear',   'Out Of Office Sneaker',  'out-of-office-sneaker',  'Low-top leather sneaker with the arrows at the side and a chunky rubber sole.', 540.00, 620.00, 6,  true),
  -- Casablanca
  ('casablanca','outerwear', 'Laurel Silk Shirt',      'laurel-silk-shirt',      'Silk twill shirt with the laurel print, camp collar and mother-of-pearl buttons.', 720.00, null,   5,  true),
  ('casablanca','t-shirts',  'Tennis Club Tee',        'tennis-club-tee',        'Cotton tee with the Tennis Club crest screen-printed at the chest.', 310.00, null,   18, false),
  ('casablanca','outerwear', 'Monogram Track Jacket',  'monogram-track-jacket',  'Full-zip track jacket in monogram jacquard with contrast piping at the sleeve.', 890.00, 990.00, 4,  false),
  ('casablanca','footwear',  'Casa Sport Sneaker',     'casa-sport-sneaker',     'Leather and suede low-top on a gum sole, with the monogram at the heel.', 495.00, null,   8,  false),
  -- Ksubi
  ('ksubi','denim',        'Chitch Pure Dynamite Jean', 'chitch-pure-dynamite-jean', 'Slim tapered denim in a hard black wash, with the shredded knee and the scrawled signature at the back pocket.', 295.00, null,   12, true),
  ('ksubi','denim',        'Van Winkle Vaporize Jean',  'van-winkle-vaporize-jean',  'Relaxed straight leg in a bleached stonewash, heavily abraded and repaired by hand.', 340.00, 395.00, 8,  false),
  ('ksubi','t-shirts',     'Kash Signature Tee',        'kash-signature-tee',        'Boxy cotton tee with the scrawled logo printed oversized across the chest.', 135.00, null,   24, false),
  ('ksubi','hoodies',      'Seeing Lines Hoodie',       'seeing-lines-hoodie',       'Heavyweight brushed-back hoodie with the Seeing Lines graphic at the back.', 265.00, null,   10, true),
  -- Essentials
  ('essentials','hoodies',     'Pull-Over Logo Hoodie', 'essentials-pull-over-logo-hoodie', 'Oversized cotton-blend hoodie in cement, with the rubberised logo at the chest and a dropped shoulder.', 110.00, null,   38, true),
  ('essentials','t-shirts',    '3D Silicone Logo Tee',  '3d-silicone-logo-tee',            'Heavyweight jersey tee with the raised silicone logo and a boxy, longline cut.', 70.00,  null,   52, false),
  ('essentials','outerwear',   'Nylon Coach Jacket',    'essentials-nylon-coach-jacket',   'Water-repellent nylon coach jacket with a snap placket and the flocked logo at the back.', 180.00, 210.00, 16, true),
  ('essentials','accessories', 'Knit Logo Beanie',      'essentials-knit-logo-beanie',     'Ribbed wool-blend beanie with the woven logo patch at the cuff.', 60.00,  null,   45, false)
) as v(brand_slug, cat_slug, name, slug, description, price, compare_at, stock, featured)
join public.brands b     on b.slug = v.brand_slug
join public.categories c on c.slug = v.cat_slug
on conflict (slug) do update
  set price = excluded.price,
      description = excluded.description,
      stock_count = excluded.stock_count,
      is_published = excluded.is_published,
      is_featured = excluded.is_featured;

-- ---------------- promote yourself to master_admin ----------------
-- After you sign up through the app, run this once with your own email:
--
--   update public.profiles set role = 'master_admin' where email = 'you@example.com';
--
-- master_admin implicitly holds every scope, so no staff_scopes rows are needed for it.
