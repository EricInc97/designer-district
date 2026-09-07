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
-- logo_url stays null: <BrandMark /> renders a typographic wordmark per brand.
-- Drop a licensed asset at public/brands/<slug>.svg and set this column to
-- '/brands/<slug>.svg' to use the real mark instead.
insert into public.brands (name, slug, logo_url, description, sort_order) values
  ('Bape',          'bape',          null, 'A Bathing Ape. Ura-Harajuku camo, shark hoodies and 1st Camo since 1993.', 10),
  ('Chrome Hearts', 'chrome-hearts', null, 'Hollywood-born sterling silver, leather and gothic cross motifs.',          20),
  ('Palm Angels',   'palm-angels',   null, 'Milanese tailoring filtered through Los Angeles skate culture.',           30),
  ('Supreme',       'supreme',       null, 'The downtown New York box logo. Skate, art and weekly drops since 1994.',   40),
  ('Rhude',         'rhude',         null, 'Rhuigi Villasenor''s luxury-meets-Americana take on LA streetwear.',       50),
  ('Stussy',        'stussy',        null, 'The original streetwear signature. Surf, skate and sound system.',        60),
  ('Purple Brand',  'purple-brand',  null, 'Los Angeles denim label built on premium washes, painted wordmarks and a low-rise silhouette.', 70),
  ('Off-White',     'off-white',     null, 'Virgil Abloh''s Milan house. Helvetica caps, quotation marks and the diagonal crosswalk stripe.', 80),
  ('Casablanca',    'casablanca',    null, 'Charaf Tajer''s Paris label. Apres-sport luxury in silk, pastel prints and Mediterranean colour.', 90)
on conflict (slug) do update
  set logo_url = excluded.logo_url,
      description = excluded.description,
      sort_order = excluded.sort_order;

-- ---------------- PRODUCTS ----------------
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
  -- Palm Angels
  ('palm-angels','hoodies',    'Classic Logo Hoodie',      'classic-logo-hoodie',      'Cotton-jersey hoodie with the contrast racing-stripe sleeve and screen-printed logo.', 620.00, null, 18, true),
  ('palm-angels','t-shirts',   'Palm Tree Print Tee',      'palm-tree-print-tee',      'Relaxed cotton tee with the sprayed palm-tree graphic at the back.', 320.00, 395.00, 26, false),
  ('palm-angels','outerwear',  'Track Jacket Bear',        'track-jacket-bear',        'Technical track jacket with the Palm Angels bear intarsia and side taping.', 745.00, null, 11, true),
  ('palm-angels','denim',      'Distressed Straight Jean', 'distressed-straight-jean', 'Rigid Japanese denim, straight leg, hand-abraded at the knee.', 480.00, null, 14, false),
  -- Supreme
  ('supreme','t-shirts',   'Box Logo Tee',          'box-logo-tee',          'The white-on-red box logo on a mid-weight cotton tee. The one everybody queues for.', 68.00, null, 48, true),
  ('supreme','hoodies',    'Box Logo Hooded Sweatshirt','box-logo-hooded-sweatshirt','Heavyweight crossgrain fleece hoodie with the embroidered box logo. Cotton/poly blend.', 168.00, 220.00, 5, true),
  ('supreme','outerwear',  'S Logo Puffer Jacket',  's-logo-puffer-jacket',  'Down-filled puffer with water-resistant shell and reflective S logo.', 398.00, null, 8, false),
  ('supreme','accessories','Canvas Duffle Bag',     'canvas-duffle-bag',     'Cordura-reinforced duffle with the printed logo webbing strap.', 178.00, null, 16, false),
  -- Rhude
  ('rhude','t-shirts',  'Moonlight Racing Tee',    'moonlight-racing-tee',    'Garment-dyed cotton tee with the Moonlight Racing motorsport graphic.', 295.00, null, 19, false),
  ('rhude','hoodies',   'Rhude Logo Hoodie',       'rhude-logo-hoodie',       'Loop-back cotton hoodie with tonal flocked logo across the chest.', 545.00, null, 10, true),
  ('rhude','denim',     'Snap Track Pant',         'snap-track-pant',         'Satin track pant with full side-snap placket and contrast piping.', 620.00, 720.00, 6, false),
  ('rhude','footwear',  'Rhecess Low Sneaker',     'rhecess-low-sneaker',     'Low-top leather sneaker on a vulcanised gum sole.', 495.00, null, 12, true),
  -- Stussy
  ('stussy','t-shirts',   'Basic Stock Logo Tee', 'basic-stock-logo-tee', 'The Stock logo in a soft-hand print on midweight cotton.', 65.00, null, 52, false),
  ('stussy','hoodies',    '8 Ball Fleece Hoodie', '8-ball-fleece-hoodie', 'Pigment-dyed heavyweight fleece with the 8 Ball graphic at the back.', 165.00, null, 23, true),
  ('stussy','outerwear',  'Work Shell Jacket',    'work-shell-jacket',    'Cotton-canvas work shell with corduroy collar and hand-warmer pockets.', 245.00, null, 9, false),
  ('stussy','accessories','Stock Bucket Hat',     'stock-bucket-hat',     'Cotton-twill bucket hat with the embroidered Stock logo.', 75.00, null, 31, false),
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
  ('casablanca','footwear',  'Casa Sport Sneaker',     'casa-sport-sneaker',     'Leather and suede low-top on a gum sole, with the monogram at the heel.', 495.00, null,   8,  false)
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
