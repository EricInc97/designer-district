# Designer District

Premium streetwear storefront, Next.js 16 (App Router), Tailwind v4, Supabase.

Monochrome, high-contrast, paper-white design system. Catalog and brand pages,
product detail with size selection, a client-side cart with slide-out drawer,
customer account with orders + a live-chat ticketing system, a scope-gated staff
dashboard, and a behavioural recommendation algorithm.

---

## Setup

Nothing works until Supabase is connected. Four steps.

### 1. Create the Supabase project

**Already done.** Project `designer-district`, ref `dphfetxmgooyuzexrloy`, region
`us-east-1`, free tier. All four SQL files below have been applied to it and the
keys are already in `.env.local`, so steps 1–3 are complete, you only need
step 4.

To start over from scratch on a different project, create one at
[supabase.com/dashboard](https://supabase.com/dashboard) and re-run the SQL.

### 2. Add the keys

**Project Settings → API**, then put them in `.env.local`:

```
NEXT_PUBLIC_SUPABASE_URL=https://<your-ref>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<your anon key>
```

Both are public-by-design keys, every table is protected by row-level security,
not by key secrecy. `.env.local` is gitignored.

### 3. Run the SQL

**SQL Editor → New query.** Paste and run each file in order:

| File | What it creates |
|---|---|
| `supabase/01_schema.sql` | Tables, enums, triggers, the recommendation, checkout, refund and analytics functions |
| `supabase/02_rls.sql` | Row-level security on every table, the privilege guards, and realtime for live chat |
| `supabase/03_seed.sql` | The scope catalogue, 12 brands, 9 categories and 48 demo products |
| `supabase/04_hardening.sql` | Revokes RPC access to trigger functions, closes the write RPCs to anon, moves `pg_trgm` out of `public` |
| `supabase/09_brand_media.sql` | Campaign and lookbook artwork for brand pages, and the `brand-media` bucket |
| `supabase/08_outfit_recommendations.sql` | The category complement graph and `live_viewers()` |
| `supabase/07_buyer_profiles.sql` | Personalisation consent, request-geo columns, the `buyer_profiles` table and the classifier behind it |
| `supabase/06_brand_logos.sql` | The `brand-logos` bucket, so a brand mark can be swapped without a deploy |
| `supabase/05_product_media.sql` | Item numbers (the `sku` column, its sequence and trigger) and the `product-images` storage bucket with its policies |

### 4. Make yourself master admin

The one step left. Sign up through the app at `/login`, then run once in the
SQL Editor:

```sql
update public.profiles set role = 'master_admin' where email = 'you@example.com';
```

`master_admin` implicitly holds every scope. Reload and `/admin` appears in the nav.

This works from the SQL Editor specifically because `guard_profile_update()`
exempts a NULL `auth.uid()`, see the note in `02_rls.sql`. Through the API,
where a JWT is always present, nobody but an existing master admin can change a
role.

Then:

```bash
npm run dev
```

Runs on <http://localhost:3200>.

---

## Data model

```
brands ──< products >── categories
                │
profiles ──< orders ──< order_items
    │                        │
    ├──< tickets ────────────┘
    │       └──< ticket_messages      (live chat, Supabase Realtime)
    ├──< credit_ledger                (store credit; profiles.store_credit is the running balance)
    ├──< staff_scopes >── app_scopes   (the scope list)
    ├──< search_events                ┐
    └──< product_views                ┘ recommendation signals
```

### Roles and scopes

Two staff roles. `master_admin` implicitly holds every scope, including ones added
later. `admin` holds exactly the scopes granted to them in **Admin → Staff**.

| Scope | Grants |
|---|---|
| `products.view` | See unpublished products in the admin catalog |
| `products.manage` | Create and edit products, brands, categories |
| `products.publish` | Flip products between draft and live |
| `products.delete` | Permanently remove a product |
| `orders.view` | Read any customer order |
| `orders.manage` | Change order status |
| `tickets.view` | Read the full support queue |
| `tickets.reply` | Send live-chat messages on any ticket |
| `tickets.manage` | Assign, reprioritise, resolve, close |
| `tickets.refund` | Grant store-credit refunds |
| `customers.view` | Read customer profiles and balances |
| `analytics.view` | Revenue, orders, search and support analytics |
| `staff.manage` | Add employees and grant or revoke scopes |

Scopes are enforced in Postgres, in RLS policies and in `SECURITY DEFINER`
functions, not just in the UI. Hiding a button never grants anything; removing
the scope is what stops the write.

Employees join by signing up on the storefront first, then a master admin finds
them in **Admin → Staff** and grants a role plus scopes. Accounts are always
created by the person who owns the email address.

---

## The recommendation algorithm

Two memories, added together in `public.recommend_products()`.

**Short memory** is the browser session: brand and category affinity from the
last 100 views, search terms, and a log-damped popularity term. It works before
anyone signs in, which is the point of it.

**Long memory** is the buyer profile, and only exists for a signed-in customer
who opted in. It survives a cleared cookie and follows them to a second device,
which is the whole reason it is keyed on the account rather than the session.

| Term | Weight |
|---|---|
| Session brand affinity | 3.0 x views |
| Session category affinity | 2.0 x views |
| Search term match | 2.5 x matches |
| Popularity, 30 days | 0.5 x ln(1+n) |
| Profile's favoured house | 4.0 x share |
| Profile's favoured category | 2.5 x share |
| Price fit against their average | 2.0, falling off with distance |
| Discounted, for a bargain hunter | 2.0 |
| **Complements the anchor's category** | **6.0 x pairing weight** |
| Same house as the anchor | 1.5 |
| Price tier near the anchor | 1.5, falling off with distance |
| Category stock depth | 1.0 x share of the deepest |
| Live: distinct sessions, last hour | 1.2 x ln(1+n) |

The profile terms are scaled by *share*, not presence: a house that takes 90% of
someone's attention counts for more than one scraping 56%.

Reading `buyer_profiles` is itself the consent check. No row exists unless the
customer said yes, so an unconsented shopper falls through to exactly the
behaviour that was there before, with no branch needed to arrange it.

### Outfit building

On a product page the shelf answers a different question. Passing
`p_anchor_product_id` switches `recommend_products()` from "more of what you
like" to "what goes with this", and the complement term at 6.0 is dominant by
design: a stale browsing affinity should not outrank the thing in front of them.

Pairings live in `category_complements`, as data rather than a CASE in the
scorer. They are directional, because socks pair with a shirt more readily than
a shirt pairs with socks: the anchor is what the shopper already wants.
Accessories complements itself, which is how someone looking at socks gets more
socks alongside the rest of the outfit. Socks are filed under accessories in
this catalog.

The complement is a **filter as well as a weight**. A category that does not
pair with the anchor cannot appear at all, which is what keeps shirts off a
shirt's shelf while still letting socks return socks. Affinity reorders that
set; it cannot choose its contents.

Affinity is a **share** of recent views, not a count. As a raw count it was
unbounded: twenty views of one house scored 60 against an outfit term worth at
most 6, and a shopper who had been browsing shirts got eight more shirts. That
only shows up when you test with a real browsing history behind you.

Results are **deduplicated on house plus name**. This catalog carries many
products under one name, so the shelf was showing "Chrome hearts T-shirt" five
times over, which is noise however well it scores.

Diversity matters more than raw score here. Without it the top ten for a
t-shirt came back as nine pairs of shorts, which is not an outfit. Each further
item from one category is worth 2.2 less, so the best of another category
overtakes the second-best of this one. The penalty applies only when there is
an anchor: without one, a shopper devoted to a single house should still be
shown that house.

An anchored shelf also stops excluding already-seen products. They have not
bought it, they were comparing.

### Stock

Sold-out products were always excluded. The scorer now also weighs category
stock depth, so a complement category holding one lonely unit is not pushed as
hard as one that can dress a hundred people, and the shelf leans towards what
can actually be fulfilled.

### Live activity

`live_viewers(product_id)` counts distinct sessions on a product in the last ten
minutes, and the product page shows it once it reaches two. One viewer is the
shopper themselves, and saying so is both useless and faintly embarrassing.

The same signal over the last hour feeds the recommender as a trending term.
Distinct sessions only, so one person refreshing cannot manufacture a trend.

It must be `security definer`. `product_views` is readable only by its owner or
by staff with `analytics.view`, so as an invoker it counted the caller's own
rows and returned 0 for every shopper. It returns a single integer, never a
row, and clamps its own window.

### Buyer profiles

`compute_buyer_profile(user_id)` derives a segment from 90 days of viewing.
First match wins, so the order is the priority:

| Segment | Fires when |
|---|---|
| Too early to say | Fewer than 5 views |
| Bargain hunter | 35%+ of views are on discounted products |
| Top of the range | Average viewed price in the catalog's top 10% |
| Label loyalist | 55%+ of views on one house |
| Category specialist | 60%+ of views in one category |
| Explorer | 5+ houses, none above a third |
| Regular | Active, no single signal dominant |

Confidence is `min(1, views/20)`. It measures evidence, not how cleanly the rule
fired: a segment drawn from three views is a guess whatever the shares look like.

**Price thresholds are percentiles of the live catalog**, not fixed numbers, so
"top of the range" keeps meaning something as the range moves. There is a guard
on that: if the catalog is priced at a single point every percentile collapses
onto the same number, `avg >= p90` becomes true for anyone who has viewed
anything, and the entire customer base files under luxury. Price only speaks
when there is a spread for it to speak with; otherwise the band reads
`No signal` and the price rules sit out.

Profiles refresh through `touch_buyer_profile()`, called by the tracking
endpoint after a view lands. It rebuilds only when the profile is more than ten
minutes stale, so a burst of page views costs one rebuild rather than one each,
and no scheduled job is needed.

### Location

From `x-vercel-ip-country`, `-country-region` and `-city`, which the platform
attaches to every request on every plan. **No package and no third-party lookup
is needed**; `@vercel/functions` exposes the same values through
`geolocation()`, but it is a typed wrapper over these three headers and not
worth a dependency. `NextRequest.geo` was removed in Next 15.

**The IP is never read or stored.** A city is all a recommendation can use, and
the address is the part that identifies a person.

### Consent

Three states, because "never asked" has to be distinguishable from "said no" or
the banner nags someone who already declined. The cookie is what the tracker
reads, since it must answer synchronously in the browser;
`profiles.personalisation_consent` is the record of truth.

Declining is not a display preference. A trigger on the column deletes the
buyer profile and sets `user_id` to null on that person's views and searches, so
the history survives as anonymous popularity signal with nothing pointing back
at them, and the profile cannot be rebuilt. The tracker also stops sending, and
the endpoint checks again on arrival, because a cookie is the client's word for
it.

Staff see the result at `/admin/audience`, behind `customers.view`.

## Money and stock

Checkout never trusts the client. `POST /api/checkout` sends only
`{product_id, size, quantity}`; `public.place_order()` re-reads every price and
stock level from the database, locks each product row `FOR UPDATE` so two people
can't buy the last unit, applies any store credit, and writes the order.

Refunds are store credit. `public.issue_store_credit()` checks the
`tickets.refund` scope, writes a `credit_ledger` row, and a trigger moves
`profiles.store_credit`. The ledger is the audit trail; the column is the balance.

`guard_profile_update()` and `guard_ticket_update()` pin the fields a client must
not set, role, credit balance, ticket priority, assignment, `credit_issued`, so
even a hand-crafted PostgREST request can't escalate. The privileged functions
lower those guards for their own statement only.

---

## Project layout

```
src/
  app/
    page.tsx                    hero lockup + shop by brand (no products here)
    brands/[slug]/page.tsx      brand header, category chips, products grouped by category
    products/[id]/page.tsx      gallery, size selector, add to cart
    search/page.tsx             brand chooser until a query or brand is picked, then results
    login/page.tsx              sign in / sign up
    account/                    settings, orders, tickets (customer)
    admin/                      overview, products, tickets, staff (scope-gated)
    api/                        track, recommendations, checkout
    ph/[label]/route.ts         SVG placeholder generator
  components/                   UI, incl. charts/
  lib/                          supabase clients, auth, tracking, formatting
  store/cart.ts                 zustand cart (localStorage-persisted)
  proxy.ts                      session refresh + route gating
supabase/                       01_schema · 02_rls · 03_seed · 04_hardening · 05_product_media
```

## Theming

Colour lives entirely in the tokens at the top of `src/app/globals.css`, named
for the role they play rather than the colour they hold: `paper` is always the
ground, `ink` is always what sits on it. Flipping the theme is a matter of
changing those ten values.

Three things do not follow automatically and need a matching edit:

- **The logo.** Both colourways are committed. `designer-district*.png` is the
  ink artwork used on the current paper ground; `designer-district*-on-dark.png`
  is the paper artwork for a dark ground. Swap which one the JSX points at.
- **Brand hover colourways** in `src/lib/brandStyles.ts` are literal hex, since
  they are each house's own colours. Amiri's and Gallery Dept's are the ones to
  re-check when the theme flips, because a pale hover is invisible on a pale tile.
- **`/ph/[label]`** generates placeholder SVGs from the palette by hand. Its
  `Cache-Control` deliberately revalidates rather than being `immutable`, so a
  palette change actually reaches browsers holding the old colourway.

The favicon keeps a dark ground on purpose: a white-on-white icon disappears in
a light browser tab strip. It is the dome only, with the palms cropped away,
because at 16px the fronds are noise.

The `.ico` is written by hand rather than through Pillow's `sizes=` argument,
which resizes from one image and would apply the same treatment to every size.
Line art loses its strokes when it is averaged down, so each size is rendered
separately and the smaller ones have their strokes dilated first: 9px of
dilation at 16, 5 at 32, 3 at 48 and 64, none above that. Without it the rings
grey out into a smudge. See the generator note in this file's history.

## Branding

The Designer District lockup lives in `public/brand/`:

| File | Used by |
|---|---|
| `designer-district.png` | Hero headline, footer |
| `designer-district-mark.png` | Dome only, for compact contexts |
| `designer-district-wordmark.png` | Header centre. Cut from the logo and recomposed onto one line, so the lettering and its slits match the logo exactly rather than approximating the face with a web font |
| `src/app/favicon.ico` | Tab icon. The dome alone, on an opaque ink ground so it reads against a light tab strip |
| `src/app/icon.png` | 512px icon, same artwork |
| `src/app/apple-icon.png` | 180px, for an iOS home screen |

All three are keyed to transparency from the source artwork: luminance becomes
the alpha channel, so every antialiased edge survives and the white line art
sits on the site's near-black ground with no visible box.

### First-visit splash

`<Splash />` holds the full lockup on the ink ground with a slow pulse, then
fades out after ~1.3s. It shows once per tab session.

The mechanics matter: an inline, dependency-free script in `layout.tsx` stamps
`data-splash="skip"` on `<html>` before the splash markup paints, so a returning
visitor never sees a frame of it. That script mutates an element React owns, so
`<html>` carries `suppressHydrationWarning` (scoped to its own attributes, not
its children). Every state change in the component happens inside a timer rather
than an effect body, which keeps it clear of cascading-render lint and of
hydration mismatches.

`prefers-reduced-motion` drops the pulse and shortens the hold to 400ms.

### Brand pages

A brand page follows the shape a house's own site uses: a full-bleed campaign
shot at the top, then product groups broken up by editorial bands rather than
one unbroken run of tiles. Both come from `brand_media`, managed at
`/admin/brands`.

`kind` is the slot, not the subject. One `hero` at the top, any number of
`lookbook` bands dropped between groups in `sort_order`. A band deliberately
breaks out of the page's max width with `left-1/2 w-screen -translate-x-1/2`;
the grid above and below is held to a column, and the band only reads as an
interruption if it runs to the edges. Watch that it does not introduce
horizontal overflow on a phone when you change it.

Overlaid type carries its own gradient scrim rather than trusting the
photograph to be dark where the words land, and `ink` says which way round.
Whoever uploads the image knows; working it out at render time is not worth
the cost.

**A house with no artwork is a designed state, not an empty one.** It falls back
to its own colourway with its mark centred, the same ground its tile uses on the
homepage, so arriving on the page feels like walking through the tile. Most
houses will sit in that state for a while, so it has to hold up.

### How loud a shelf is

`RecommendationRail` takes a `tone`. `feature` is the default and looks like
part of the page: catalog-sized cards, which is right on a product page where
what goes with the thing in front of you is the point. `quiet` is an aside,
small rows on their own ground behind a rule.

A brand page uses `quiet`, and the reason is not only visual. That shelf
regularly contains other houses' products, so at catalog size and catalog
spacing it read as more of *this* brand's stock. The house is named on every
row for the same reason.

### Brand marks

`<BrandMark />` renders a house's own logo file when `brands.logo_url` points at
one, and otherwise falls back to a wordmark set in a face matching that house's
register: geometric oblique for Supreme, condensed block caps for Balenciaga, a
Didone serif for Amiri and Casablanca, gothic for Godspeed.

Bape, Chrome Hearts, Gallery Dept., Ksubi and Essentials have real artwork in
`public/brands/`. Chrome Hearts is a true vector: the supplied line art was
traced to Bezier paths with potrace (`potracer`, the pure-Python port) at 3x,
so the blackletter stays sharp at any size instead of softening the way the
210px raster it replaced did. The other four are rasters keyed off their
ground.
Each was keyed off the flat ground it was supplied on by
`scripts/key_brand_logo.py`, so none of them carries a visible box. Line art
(everything but Bape) has its luminance turned into the alpha channel
and is repainted in ink; the multi-colour Bape lockup is unblended per pixel
against its own palette, which brings the antialiased edges back as partial
alpha rather than a dark fringe. Re-run it against new source files to
regenerate.

**A logo drawn for a dark ground needs a second cut.** Bape ships white
lettering on black, which disappears on the paper tile, so there are two files:

| File | Used on |
|---|---|
| `bape.png` | The resting tile. Lettering remapped to ink. |
| `bape-on-dark.png` | The camo colourway, via `hover.logoUrl`. Lettering as drawn. |

`BrandMark` takes a `hovered` prop, set by the crossfade layer that sits on the
colourway, and prefers `hover.logoUrl` when the house defines one. Bape is the
only house that needs two cuts so far. **A house whose logo is ink needs a light
hover ground**, which is why Chrome Hearts got chrome, Gallery Dept. a spattered
grey, Ksubi a stonewash rather than raw indigo, and Essentials its own cement
taupe. Pick a dark colourway for one of those and the mark disappears into it.

A `label` array in `brandStyles` is an explicit two-line lockup and each line is
held together; a plain string label still wraps when a tile is too narrow.

The site menu (the burger, left of the header) is the primary way into the
catalog. Designers sit one level down from the root panel, each row using the
same crossfade as the grid tiles.

Its overlay is portalled to `<body>`, and must stay that way. `SiteMenu` renders
inside the header, and the header has a `backdrop-filter`; that establishes a
containing block for fixed-position descendants, so an un-portalled
`fixed inset-0` resolves against the 64px header instead of the viewport and the
panel collapses to the height of its own title bar.

Every tile carries its house's own colourway as its ground, built entirely from
CSS gradients: Bape's camo, Supreme's red box, Chrome Hearts' chrome,
Balenciaga's flat black, Amiri's bone, Gallery Dept's spattered studio floor,
Godspeed's votive gold, Off-White's crosswalk. See `hover` in
`src/lib/brandStyles.ts`.

The colourway used to be a hover reveal crossfading up from a cream panel, which
meant a touch device, where nothing hovers, saw a different page from a desktop.
The touch version was the one that read better, so it is the one that stayed:
the ground is always the house's and hover is a small lift of the mark. Menu
rows still crossfade, because twelve saturated rows in a list is a different
proposition from twelve tiles in a grid, and that is what the
`@media (hover: none)` rule in `globals.css` is still there for.

**The wordmarks are still stand-ins.** Houses without a file in
`public/brands/` are set in lookalike faces, not their real marks. Every brand's
actual logo is their trademark and has to come from them, a press kit or your
wholesale account. To add one: drop the file at `public/brands/<slug>.<ext>`,
set that brand's `logo_url`, and add a `hover.logoUrl` cut if the artwork was
drawn for the opposite ground. No code change either way.

## Adding products

`/admin/products` is the whole loop: photography, price, brand, description,
stock. It needs the `products.manage` scope, which `master_admin` holds
implicitly.

Images can be **dropped straight onto the box**, and **thumbnails dragged to
reorder** — the first one is what the storefront leads with, so ordering is how
you choose the main shot.

Two kinds of drag happen in that box and they must not be confused: files
arriving from the desktop, and a thumbnail being moved within the strip.
`dataTransfer.types` separates them, since a file drag always carries `"Files"`
and a thumbnail drag never does. Without that check, picking up a thumbnail lit
the drop zone as though a file were incoming. `dragenter` and `dragleave` also
fire for every child the pointer crosses, so the highlight counts entries
against leaves rather than toggling a boolean, which would flicker.

The star button stays alongside the dragging. Native drag and drop is not
keyboard accessible, so promoting an image to main has to remain possible
without a pointer.

**Photographs go straight from the browser to Supabase Storage**, never through
the server action. A server action body is capped at 1MB by default and product
photography passes that immediately, so `<ProductImageUploader />` uploads to
the `product-images` bucket and submits only the resulting public URLs, in two
hidden fields. The first image is `image_url`, the one the storefront leads
with; the rest become `gallery`, and the product page shows them as thumbnails.

The bucket is public, because product photography is public by definition and a
public bucket means `<img src>` works with no signing round-trip. Uploading is
gated on `has_scope('products.manage')`, the same scope that gates editing the
product row, so the component being on screen is never what grants it. Files are
capped at 5MB and limited to PNG, JPEG, WebP and AVIF by the bucket itself.

**Nothing can delete or overwrite an object**, by design: the bucket has no
update or delete policy. Removing an image in the editor only detaches it from
the product. An unreferenced file costs a few kilobytes; a destroyed photograph
cannot be recovered, and an earlier build that tried to be tidy about it
deleted photographs that saved products were still pointing at. Cleaning up
orphans is a dashboard or service-role job.

Because a file can still go missing by other means, `<ProductImage />` falls
back to the generated `/ph/` placeholder on error rather than letting the
browser draw a broken-image icon.

### Item numbers

Every product carries one, in the form `DD-BAP-00042`: the house's code taken
from its slug, then a counter. It is assigned by a database trigger off a
sequence, not by the application, so two people saving at the same moment cannot
land on the same number, and a product created by the seed file gets one exactly
like a product created through the form. The column is `not null` with a unique
index.

Gaps are normal and expected. A rejected insert still consumes a sequence value,
because the trigger runs before the RLS check that turns it down. An item number
is an identifier, not a count.

The number shows in the admin list, in the editor, and on the product page, so a
shopper can quote it back on a support ticket.

### Where a saved product goes

The storefront has no "all products" route by design: a product is reachable
only through its house. Saving therefore rebuilds `/brands/<slug>` as well as
`/`, `/brands`, `/search` and the product's own page, and the success message
names both the item number and the brand it landed under. An unpublished product
is saved but stays out of all of them.

## Replacing the placeholder imagery

Products with no uploaded photograph fall back to `/ph/<slug>`, a route that
renders a deterministic SVG, so the grid never has holes in it. Uploading an
image through `/admin/products` replaces it; the route simply stops being called
for that product.

## Deploying to Vercel

The build is production-clean and needs no `vercel.json`: Vercel auto-detects
Next.js, and the default Node version already satisfies Next 16.

**1. Sign in.** This one is yours to run, it opens a browser to authenticate:

```
npx vercel login
```

**2. Create the project and deploy a preview.** Accept the detected framework
settings when prompted:

```
npx vercel
```

**3. Give it the Supabase keys.** Without these the deployed site renders the
setup notice instead of the storefront. Both are public-by-design keys; the
database is protected by RLS, not by key secrecy:

```
echo https://dphfetxmgooyuzexrloy.supabase.co | npx vercel env add NEXT_PUBLIC_SUPABASE_URL production
echo https://dphfetxmgooyuzexrloy.supabase.co | npx vercel env add NEXT_PUBLIC_SUPABASE_URL preview
```

Then the same for `NEXT_PUBLIC_SUPABASE_ANON_KEY`, using the anon key from
`.env.local`.

**4. Ship it.**

```
npx vercel --prod
```

**5. Point Supabase Auth at the deployed domain.** Until you do, confirmation
and password-reset links keep pointing at `localhost:3200`. In the Supabase
dashboard, under Authentication then URL Configuration:

- Site URL: your production Vercel domain
- Redirect URLs: add the production domain and `https://*.vercel.app/**` so
  preview deployments can sign in too

### Note on git

The repo has no remote yet, so this deploys straight from the working
directory. If you push it to GitHub later and connect the repo in Vercel, you
get per-branch preview deployments automatically. Vercel builds the default
branch for production, so `master` would need this work merged into it first.

## Commands

```bash
npm run dev     # http://localhost:3200
npm run build
npm run lint
```
