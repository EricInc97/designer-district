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
| `supabase/03_seed.sql` | The scope catalogue, 6 brands, 6 categories and 24 products |
| `supabase/04_hardening.sql` | Revokes RPC access to trigger functions, closes the write RPCs to anon, moves `pg_trgm` out of `public` |

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

`public.recommend_products(session_id, user_id, limit)` scores every published,
in-stock product against the visitor's recent behaviour:

| Weight | Signal |
|---|---|
| ×3.0 | **Brand affinity**, brands whose products they viewed |
| ×2.0 | **Category affinity**, categories they viewed |
| ×2.5 | **Search-term match**, their last 20 queries against name, description and brand |
| ×0.5 | **Popularity**, views in the last 30 days, `ln`-damped so hits don't dominate |

Anything already viewed is excluded, so it always surfaces something new.

Events are collected by `POST /api/track` from `src/lib/track.ts`, searches from
the nav typeahead and the `/search` page, views from every product page. Anonymous
visitors are tracked by a `dd_sid` cookie minted in `proxy.ts`, so recommendations
work before anyone signs in and carry over once they do.

Surfaced two ways:

- **`<RecommendationRail />`**, inline section (`layout="rail"`) or sidebar column
  (`layout="sidebar"`, used on `/search`).
- **`<RecommendationPopup />`**, bottom-left card, global. Appears after 9 seconds,
  and only when the top results score above zero. A zero score means we'd be showing
  random stock, so it stays quiet. Dismissal is remembered for the session.

---

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
supabase/                       01_schema · 02_rls · 03_seed
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
a light browser tab strip.

## Branding

The Designer District lockup lives in `public/brand/`:

| File | Used by |
|---|---|
| `designer-district.png` | Hero headline, footer |
| `designer-district-mark.png` | Dome only, for compact contexts |
| `designer-district-wordmark.png` | Header centre. Cut from the logo and recomposed onto one line, so the lettering and its slits match the logo exactly rather than approximating the face with a web font |
| `src/app/icon.png` | Favicon (opaque ground so it reads on a light tab bar) |

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

### Brand marks

`<BrandMark />` renders a house's own logo file when `brands.logo_url` points at
one, and otherwise falls back to a wordmark set in a face matching that house's
register: geometric oblique for Supreme, condensed block caps for Balenciaga, a
Didone serif for Amiri and Casablanca, gothic for Godspeed.

Bape, Chrome Hearts, Gallery Dept., Ksubi and Essentials have real artwork in
`public/brands/`.
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

On hover, a tile or menu row crossfades to that house's own colourway, built
entirely from CSS gradients: Bape's camo, Supreme's red box, Chrome Hearts'
chrome, Balenciaga's flat black, Amiri's bone, Gallery Dept's spattered studio
floor, Godspeed's votive gold, Off-White's crosswalk. See `hover` in
`src/lib/brandStyles.ts`.

**The wordmarks are still stand-ins.** Houses without a file in
`public/brands/` are set in lookalike faces, not their real marks. Every brand's
actual logo is their trademark and has to come from them, a press kit or your
wholesale account. To add one: drop the file at `public/brands/<slug>.<ext>`,
set that brand's `logo_url`, and add a `hover.logoUrl` cut if the artwork was
drawn for the opposite ground. No code change either way.

## Replacing the placeholder imagery

Seeded products point at `/ph/<slug>`, a route that renders a deterministic SVG.
Real product photography and brand logos are licensed assets, so nothing is
hotlinked. Point `products.image_url` / `brands.logo_url` at your own CDN or a
Supabase Storage bucket and the route simply stops being called.

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
