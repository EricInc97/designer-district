/* Board artwork.
 *
 * The rule that matters here: every garment in every picture is resolved
 * from real stock BEFORE anything is sent, and the bill of items is printed
 * so it can be read. Nothing is described from memory.
 *
 * That is what "poll the items first" is for. A prompt that says "a cap"
 * gets a cap the shop does not sell; a prompt built from a row in the
 * catalogue gets the cap, its photograph as a reference, and a product id to
 * link the advert to. Slots that cannot be filled from stock are dropped and
 * said out loud rather than quietly invented.
 *
 *   node scripts/campaigns/generate.mjs             everything missing
 *   node scripts/campaigns/generate.mjs --poll      bill of items only, no calls
 *   node scripts/campaigns/generate.mjs crown-group just one
 *   node scripts/campaigns/generate.mjs --all       redo everything
 */
import fs from "node:fs";
import { fileURLToPath } from "node:url";

const OUT = fileURLToPath(new URL("../../.campaigns-out/", import.meta.url));
fs.mkdirSync(OUT, { recursive: true });

const env = fs.readFileSync(fileURLToPath(new URL("../../.env.local", import.meta.url)), "utf8");
const KEY = (env.match(/^HF_CREDENTIALS=(.*)$/m) || [])[1]?.trim();
if (!KEY) throw new Error("no HF_CREDENTIALS in .env.local");
const BASE = "https://api.higgsfield.ai";
const scrub = (s) => String(s).split(KEY).join("<key>");

const call = async (path, init) => {
  const r = await fetch(`${BASE}${path}`, {
    ...init,
    headers: { Authorization: `Key ${KEY}`, "Content-Type": "application/json", ...(init?.headers || {}) },
  });
  return { status: r.status, body: await r.text() };
};

/**
 * A reference URL the image API will accept.
 *
 * AVIF originals fail — tested head to head, the same prompt with one AVIF
 * reference returns "Generation failed" every time and the same prompt with
 * a JPEG completes. Supabase transcodes on the way out and its render
 * endpoint answers a plain Accept with image/jpeg.
 */
const refUrl = (u) =>
  /\.avif($|\?)/i.test(u)
    ? u.replace("/storage/v1/object/public/", "/storage/v1/render/image/public/") +
      "?width=1024&quality=90"
    : u;

const cat = await (await fetch(process.env.DD_API || "http://localhost:3200/api/storefront")).json();
if (!cat.ok) throw new Error("storefront not answering");

/**
 * A house's stock, the least-photographed first.
 *
 * This is the fix for everybody wearing the same t-shirt. The pickers below
 * ask for "this house's first shirt", and the first shirt was the same shirt
 * every run: counted across the campaign, one Chrome Hearts tee was in seven
 * pictures and the Purple Brand jeans in seven more, while two hundred and
 * one garments in stock had never been photographed at all.
 *
 * `used` comes from the product_campaign_use view, which counts the
 * published boards each product already appears on. Sorting by it means the
 * generator reaches for something new by default and only repeats a garment
 * when a house has nothing else of that kind.
 *
 * Ties break on name, so a run is repeatable rather than depending on the
 * order the catalogue happened to arrive in.
 */
/* What this run has already spent.
 *
 * `used` is a snapshot taken before the run, so on its own it only stops the
 * generator repeating what previous runs shot — every picture in a single
 * batch would still reach for the same least-used shirt, because nothing
 * told it the shirt had just been taken. Each pick is counted here and
 * weighs double, so within a batch a garment moves to the back of the queue
 * the moment it is used.
 */
const takenThisRun = new Map();
const cost = (p) => (p.used ?? 0) + (takenThisRun.get(p.id) ?? 0) * 2;

/* And what it has already spent the look of.
 *
 * Ids are not enough. Vale sells three distinct pairs of shorts all
 * described "Grey Vale shorts", and Godspeed four charcoal t-shirts, so
 * picking two unused ids for two models dressed them identically — the
 * picture shows the same garment twice and the board lists two products a
 * shopper cannot tell apart. For casting purposes a description is the
 * garment, so a note taken once is spent for the rest of the run. */
const notesThisRun = new Set();
const noteOf = (p) => (p.note || p.name || "").trim().toLowerCase();

const live = (slug) =>
  (cat.brands[slug] || [])
    .filter((p) => p.image && (p.stock ?? 0) > 0)
    .sort((a, b) => cost(a) - cost(b) || String(a.name).localeCompare(String(b.name)));

/* ── the pickers ─────────────────────────────────────────────────────────
 * Each returns a real row or undefined. Undefined is a dropped slot, never
 * a licence to describe something generic.
 */
const byCat = (slug, c, n = 0) => live(slug).filter((p) => p.cat === c)[n];
const bySub = (slug, sub, n = 0) => live(slug).filter((p) => p.sub === sub)[n];

/* ── never photographed, and never twice ─────────────────────────────────
 *
 * `live` already sorts the least-used first, which makes a repeat unlikely.
 * These make it impossible, which is a different thing: a garment that has
 * been in a picture before, or has already been taken earlier in this run,
 * is not returned at all. Undefined comes back instead and the slot is
 * dropped and said out loud, rather than quietly handing back the shirt
 * that is already on three hoardings.
 *
 * With a hundred and ninety-eight garments in stock never yet photographed,
 * there is no reason to reach for one twice.
 */
const unshot = (p) => (p.used ?? 0) === 0 && !takenThisRun.has(p.id);

/* Half of a co-ordinated set is never returned by a category pick.
 *
 * Casablanca has five sets and Essentials two, and asking for "a fresh
 * shirt" and "a fresh pair of shorts" from a house that sells sets will
 * cheerfully hand back one half of one and one half of another. That is
 * exactly the mismatch already found on essentials-tower, a grey top with
 * black shorts, and it is not a thing the shop sells.
 *
 * So anything carrying a set_key is invisible to freshCat and freshSub. A
 * set has to be asked for by name, through wholeSet, which returns both
 * halves together. It is not possible to split one by accident any more.
 */
const loose = (p) => unshot(p) && !p.setKey && !notesThisRun.has(noteOf(p));
const freshCat = (slug, c) => live(slug).filter((p) => p.cat === c && loose(p))[0];
const freshSub = (slug, sub) => live(slug).filter((p) => p.sub === sub && loose(p))[0];
const setHalves = (slug, key) => {
  const both = live(slug).filter((p) => p.setKey === key);
  return [both.find((p) => p.cat === "hoodies"), both.find((p) => p.cat === "bottoms")].filter(Boolean);
};

/* Both halves of a co-ordinated set, whatever they are made of.
 *
 * Deliberately NOT filtered by `unshot`, and that exception is the whole
 * point of the sets work. Essentials has exactly one hoodie and one pair of
 * shorts never photographed, and they are halves of two different sets —
 * the black hoodie and the grey shorts. Asking for fresh garments by
 * category would have dressed a model in one half of each, which is
 * precisely the mismatch that is already on essentials-tower and the reason
 * set_key exists. A set is shot as a set; a repeated half is a far smaller
 * cost than advertising an outfit the shop does not sell.
 */
/* One named garment, whether or not it has been photographed before.
 *
 * For a reshoot. The fresh pickers exist so a new picture reaches for
 * stock nobody has seen, and that is exactly wrong when the job is to
 * photograph the same board again because the first attempt got something
 * wrong — the yellow Gallery Dept. tee came back with its chest print
 * across the shoulders when the garment actually reads COACH there, and
 * replacing the tee would not fix that, it would just change the subject.
 *
 * Matched on the description rather than an id so the pin is readable: a
 * line here says which garment it means, and a stale one drops the slot
 * loudly instead of silently shooting something else.
 */
const exact = (slug, note) =>
  live(slug).find(
    (p) => (p.note || "").trim().toLowerCase() === note.trim().toLowerCase(),
  );

const wholeSet = (slug, key) => {
  const both = live(slug).filter((p) => p.setKey === key);
  const top = both.find((q) => ["hoodies", "shirts", "track-tops"].includes(q.cat) || q.sub === "track-tops");
  const bottom = both.find((q) => q.cat === "bottoms" || q.cat === "denim");
  return [top, bottom].filter(Boolean);
};

/* ── the look of the place ───────────────────────────────────────────── */

const STYLE =
  "Anime film still, hand-painted cel animation, 2000s Japanese animated feature " +
  "aesthetic. Painterly background art, soft rim light, gentle film grain, rich " +
  "saturated colour, clean linework. Not a photograph, not 3D.";

const STREET =
  "a straight open-air pedestrian shopping street paved in pale travertine, lined " +
  "both sides with low concrete shopfronts two and three storeys tall, their " +
  "facades broken by tall narrow vertical fins in saturated crimson, ochre and " +
  "teal, big bright LED advertising screens mounted on the shopfronts, wind-blown " +
  "coconut palms in square planters down the middle, yellow canvas parasols, deep " +
  "blue sky, and far beyond the rooftops a Miami seafront skyline of pale white " +
  "and mint towers standing shoulder to shoulder";

const PLACES = {
  street: STREET,
  crown:
    "the paved plaza that closes the district, three enormous LED screens side by " +
    "side above a pale diamond-lattice wall, palms either side, and the pale Miami " +
    "seafront skyline behind them",
  doorway:
    "the deep arched openings of a concrete shopfront colonnade, cool shade inside, " +
    "pale travertine paving and a palm shadow across it",
  hoarding:
    "a low angle looking up past a large bright LED screen mounted on a concrete " +
    "shopfront, palm fronds and deep blue sky behind it",
};

/* What a house's name looks like on a shopfront, where it differs from
 * its slug. Only the ones a slug would get wrong. */
const HOUSE_SIGN = {
  "chrome-hearts": "CHROME HEARTS",
  "purple-brand": "PURPLE BRAND",
  "off-white": "OFF-WHITE",
  "gallery-dept": "GALLERY DEPT",
  "godspeed": "GODSPEED",
};

const HOUSES = "BAPE, CHROME HEARTS, SUPREME, AMIRI, BALENCIAGA, GALLERY DEPT, GODSPEED, " +
  "PURPLE BRAND, OFF-WHITE, CASABLANCA, KSUBI, RHUDE, VALE, HELLSTAR, ESSENTIALS";
const SIGNAGE =
  `Any shopfront or screen signage may only read from this list: ${HOUSES}, or ` +
  "DESIGNER DISTRICT. Everything else blank. No other real fashion brand names.";

/* Signage for a picture that belongs to one house.
 *
 * The open list above is right for a street scene and wrong for an
 * advertisement. Off-White's board came back with VALE across a screen two
 * storeys high, and Purple Brand's with an AMIRI shopfront beside the
 * model — a competitor's name, in the largest type in the frame, on a
 * board paid for by somebody else. The models can wear another label as
 * styling; the architecture should not be selling one.
 *
 * So an own-house shot gets its own name and the district's, and nothing
 * else. Blank is explicitly offered as the alternative, because a model
 * told only what it may not write will write something anyway.
 */
/* `own` marks a board that belongs to a single house, which is a separate
 * question from whether anybody in it is wearing something plain. The two
 * used to share the `plain` flag, so a board with no plain garment could
 * not ask for its own signage and fell back to the open list — which is
 * how a Supreme board came to permit an AMIRI shopfront in the largest
 * type in the frame. `plain` still implies `own`, so nothing that already
 * set it changes. */
const ownSignage = (house) =>
  `Any shopfront, screen or sign visible anywhere in this photograph may ` +
  `read only ${house.toUpperCase()} or DESIGNER DISTRICT, or be completely ` +
  `blank. No other fashion brand name, logo or wordmark appears anywhere in ` +
  `the frame — not on a storefront, a screen, a banner, an awning or a bag. ` +
  `Blank signage is preferred over inventing a name.`;
const FIDELITY =
  "Reproduce every garment exactly as shown in its reference photograph — same " +
  "colour, same cut, same printed graphics and lettering. Do not restyle or " +
  "substitute any of the clothing.";
/* How these three houses actually cut a jean.
 *
 * Amiri, Purple Brand and Ksubi all sell a tapered slim leg — the
 * reference photographs show it plainly, narrow through the thigh and
 * closing to a small ankle — and the model kept putting them on the
 * figures as baggy wide-leg denim stacked over the shoe, which is the
 * silhouette streetwear photography is soaked in. Naming the cut is the
 * only thing that holds it, because the reference alone was not enough.
 */
const TAPERED_DENIM =
  "The jeans are cut tapered and slim exactly as their reference photograph " +
  "shows: close through the thigh, narrowing through the knee to a small " +
  "ankle opening, breaking just above the shoe. They are not baggy, not " +
  "wide-leg, not oversized and not stacked or puddled over the footwear.";

/* What a second photograph of the same garment means.
 *
 * Several of these carry a different print front and back — the yellow
 * Gallery Dept. tee says DEPT. on the chest and COACH across the shoulders
 * — and a shot that turns a model away was sending only the front. The
 * back came out wearing the front's print, which is a garment the shop
 * does not sell.
 */
const TWO_SIDES =
  "Where two reference photographs are given for one garment they are its " +
  "front and its back. Reproduce whichever side faces the camera from the " +
  "photograph of that side: a model turned away shows the back print, and " +
  "the front print never appears on the back.";
const NO_TAGS =
  "The clothes are being worn, so they carry no retail hang tags, no price tags " +
  "and no swing tickets anywhere.";
const CEL =
  "Render the entire image as hand-painted 2D anime cel animation. It must not " +
  "look like a photograph or a 3D render — painted backgrounds, visible linework, " +
  "flat cel shading.";

/* ── the other look: photographed rather than drawn ──────────────────────
 *
 * The cel style is the district's house style and stays the default. These
 * two constants are its opposite number, picked by `real: true` on a single
 * picture, so a realistic set can be tried on two boards without touching
 * the forty-four that are already hanging.
 *
 * Both halves are needed. Saying "photorealistic" at the top and nothing at
 * the bottom leaves the closing instruction still demanding cel shading,
 * and the model obeys whichever it read last; the anime conditioning on
 * these fashion prompts is strong enough that it has to be refused at both
 * ends.
 */
const PHOTO =
  "Photorealistic fashion campaign photograph, shot on a full-frame camera with " +
  "a fast prime lens in natural daylight. Shallow depth of field, true-to-life " +
  "skin texture, visible fabric weave and stitching, physically accurate shadows " +
  "and reflections. Not an illustration, not anime, not a painting, not a 3D render.";
/* What makes it look like a shoot rather than a snapshot.
 *
 * The two photoreal boards already made were photoreal and still read as
 * someone standing in a street. The difference between that and a campaign
 * is not the camera, it is that somebody lit it, styled it and cast it — so
 * that is what this says, in those terms.
 */
/* What goes on the half of the body this house does not sell.
 *
 * Chrome Hearts sells nineteen tops and no trousers; Purple Brand and Ksubi
 * sell denim and no tops. Somebody has to be dressed, and until now the
 * missing half was borrowed from another house in the district. That made
 * every such picture a collaboration, which then advertised a rival on the
 * page it hung from — Supreme headlined "Supreme x Ksubi" with Ksubi jeans
 * for sale underneath it.
 *
 * A plain garment solves it at the root. It is not a product, carries no
 * product_id, and is described rather than referenced, so nothing in the
 * picture is for sale except this house's own work.
 *
 * The last line is the one that has to hold. Left to itself a fashion model
 * puts a logo on a t-shirt, because almost every t-shirt it has ever seen
 * has one.
 */
const PLAIN_TEE_WHITE =
  "a plain white cotton t-shirt, completely unbranded";
const PLAIN_TEE_BLACK =
  "a plain black cotton t-shirt, completely unbranded";
const PLAIN_JEANS_BLACK =
  "plain black denim jeans, completely unbranded";
const PLAIN_JEANS_INDIGO =
  "plain indigo denim jeans, completely unbranded";
const PLAIN_SHORTS_BLACK =
  "plain black cotton shorts, completely unbranded";
const UNBRANDED =
  "Any garment described as plain or unbranded must be exactly that: no " +
  "logo, no wordmark, no print, no graphic, no slogan, no embroidery and no " +
  "visible label anywhere on it, front or back. Only the garments named from " +
  "their reference photographs carry branding of any kind.";

const SHOOT =
  "An art-directed editorial fashion campaign shoot. Professional model casting, " +
  "hair and makeup done, clothes steamed and styled, deliberate lighting with a " +
  "key and a soft fill and a clean rim separating the figure from the ground. " +
  "Composed by a fashion photographer: intentional pose, confident eyeline, " +
  "shallow depth of field, magazine-grade colour and retouching, sharp on the " +
  "garment. Nothing snapshot, nothing candid, no phone-camera look.";

/* Two people, two angles.
 *
 * One of each so a shopper sees the garment on a body like theirs, and the
 * two are turned differently so one piece is read from the front while the
 * other is read from the side. A flat-lay gives you one view; a campaign
 * picture can give two for the same money.
 *
 * The last sentence is the important one. Turning somebody away from camera
 * invites the model to invent whatever it likes on the back, and most of
 * these garments carry their print on the front only. A three-quarter turn
 * shows the cut, the drape and the side seam without requiring a back that
 * nothing in the reference photographs supports.
 */
const ANGLES =
  "Two models together in frame, one man and one woman, both full length and " +
  "both complete outfits clearly visible. They are turned differently on " +
  "purpose: one stands square to camera so the front of the clothing reads, " +
  "the other stands at a three-quarter turn so the cut, the drape and the side " +
  "of the same kind of garment read. Natural distance between them, neither " +
  "obscuring the other. " +
  "Where a garment's reference photograph only shows the front, keep the rest " +
  "of it plain: do not invent a print, a graphic or lettering on a back or a " +
  "sleeve that the reference does not show.";

const PHOTO_FINISH =
  "Render the entire image as a real photograph: photographic detail throughout, " +
  "natural skin and flyaway hair, accurate cloth drape and folds, real lens depth " +
  "of field and fine sensor grain. No linework, no cel shading, no painted or " +
  "illustrated surfaces anywhere, and no anime styling in the faces or figures.";

/* ── the cast ────────────────────────────────────────────────────────────
 * The women read as tomboys in the last set, which was the prompt's fault:
 * they were described only by their hair. Femininity here is carried by
 * styling and bearing rather than by changing a single garment, because the
 * garments are the product and have to stay exactly as photographed.
 */
const CAST = {
  man:
    "a young man with tousled black hair, relaxed confident posture",
  woman1:
    "a strikingly feminine young woman with long dark box braids swept over one " +
    "shoulder, gold hoop earrings and a delicate chain, soft makeup with a warm " +
    "lip, long lashes, slender build, elegant graceful posture with a slight " +
    "contrapposto and one hip eased out, manicured nails",
  woman2:
    "a strikingly feminine young woman with a glossy dark bob tucked behind one " +
    "ear, small gold studs and a fine necklace, soft natural makeup, delicate " +
    "features, slender build, poised graceful stance with her weight on one leg " +
    "and a soft turn of the shoulders",
};
const CAST_EXTRA = {
  man2:
    "a young man with a short fade and a trimmed beard, broad shoulders, calm " +
    "assured stance, hands easy at his sides",
  woman3:
    "a strikingly feminine young woman with long loose auburn waves, fine gold " +
    "jewellery, soft makeup, slender build, an easy confident stance with her " +
    "weight on one hip",
};
Object.assign(CAST, CAST_EXTRA);

const FEM =
  "Style the women's clothes so they read as feminine without altering the " +
  "garments themselves: the t-shirt tucked or knotted at the waist so the " +
  "silhouette is defined, sleeves turned once, clean white trainers or simple " +
  "sandals, a small shoulder bag. The garments' colours, graphics and cut stay " +
  "exactly as their reference photographs show.";

/* ── the plan ────────────────────────────────────────────────────────────
 * Deliberately mixed across houses. A district where every outfit is head to
 * toe in one label is a catalogue, not a street; and the shop sells the
 * jeans of one house and the shirt of another to the same person.
 */
const SET = [
  /* ── the photographed set ──────────────────────────────────────────────
   *
   * Five houses, five aesthetics, written from each one's own description
   * in the catalogue rather than from a house style invented here. The
   * point of doing them as five different houses at once is that it is a
   * fair test: if the look holds for Chrome Hearts gothic silver and for
   * Casablanca Mediterranean silk, it holds.
   *
   * Every garment is one that has never been photographed, and none
   * appears twice across the five — enforced by the pickers, not by me
   * reading the bill and hoping.
   *
   * Two shots are shaped by what is actually in stock rather than by
   * preference, which is the whole reason for polling first:
   *
   * Chrome Hearts sells no bottoms at all. A full-length look would have
   * had to borrow trousers from another house and would then be mostly
   * somebody else; waist-up is the honest framing and it suits a house
   * whose case is silver, leather and gothic type anyway.
   *
   * Essentials is shot as a whole set. Its only never-photographed hoodie
   * and its only never-photographed shorts are halves of two different
   * sets, so asking for fresh garments by category would have produced
   * exactly the grey-top-black-bottom mismatch already sitting on
   * essentials-tower. This picture replaces that one.
   */
  /* ── batch two: the nine houses left with no campaign ───────────────
   *
   * Seven pictures rather than nine, because four of these houses cannot
   * dress two people on their own and pairing them covers two at once. A
   * collaboration is filed under one house but shows on both carousels,
   * since those are looked up by the garments in the picture rather than
   * by whose board it is.
   *
   * What the stock dictated, found by polling rather than assumed:
   *
   *   off-white   shirts only, no bottoms        -> paired with Ksubi denim
   *   ksubi       denim only, no tops            -> the other half of that
   *   purple      bottoms only, no tops          -> paired with Gallery Dept.
   *   gallery     shirts and one jacket, no legs -> the other half of that
   *   bape        sells nothing but socks, seven SKUs and not one garment,
   *               so its picture is a socks picture: a low, close frame
   *               where the socks and the shoes are the subject, with the
   *               clothing above them borrowed from Vale.
   */
  /* ── batch three: a Chrome Hearts that works on a phone, and seconds
   *    for nine other houses. Bape skipped.
   *
   * Mostly 9:16. A phone is the surface that matters here and 9:16 is the
   * shape that fills one: at 375 across it is 667 tall against 563 for a
   * 2:3. The trade is on a desktop, where upright boards are bounded by
   * height and centred, so a 9:16 comes out narrower than a 2:3 — 279
   * against 331. Worth it in that order, and two of the six stay 2:3 so the
   * street keeps a mix of shapes.
   *
   * Chrome Hearts is the reason this batch exists. Its first picture is a
   * single man, waist up, because the house sells nineteen tops and not one
   * pair of trousers — there was nothing to put on his legs. Borrowing
   * Amiri denim fixes that properly: two models, full length, and a
   * collaboration that both houses get a slide out of.
   */
  /* ── batch four: one house per picture ──────────────────────────────
   *
   * Every one of these dresses the half the house does not sell in a plain
   * unbranded garment instead of a rival's. Purple Brand and Ksubi get a
   * board of their own for the first time — both sell denim and no tops, so
   * until now they could only appear as somebody else's guest.
   */
  {
    tag: "off-white-solo-photo", aspect: "9:16", house: "off-white",
    place: "street", real: true, cast: ["man", "woman2"], angles: true,
    plain: true,
    look:
      "Milan industrial: Helvetica caps and quotation marks, flat hard light, " +
      "black and white with the concrete doing the rest. Graphic, exact, cold.",
    shot: "Side by side on open paving",
    slots: {
      "his tee": () => freshCat("off-white", "shirts"),
      "her tee": () => freshCat("off-white", "shirts"),
    },
    wear: (x) =>
      `He wears ${d(x["his tee"])} with ${PLAIN_JEANS_BLACK}. ` +
      `She wears ${d(x["her tee"])} with ${PLAIN_JEANS_INDIGO}.`,
  },
  {
    tag: "purple-brand-two-photo", aspect: "9:16", house: "purple-brand",
    place: "doorway", real: true, cast: ["man2", "woman3"], angles: true,
    plain: true,
    look:
      "Los Angeles denim in shade: premium washes and painted wordmarks " +
      "against raw concrete, one hard shaft of sun. The denim is the whole " +
      "picture.",
    shot: "A tall vertical frame under a concrete colonnade, the two of " +
          "them close together, both full length from head to shoes, the " +
          "legs of the jeans unobstructed their whole length",
    // Pinned: a reshoot for the cut of the denim, not a change of goods.
    slots: {
      "his jeans": () => exact("purple-brand", "Dark wash Purple Brand jeans."),
      "her jeans": () => exact("purple-brand", "Black Purple Brand jeans."),
    },
    wear: (x) =>
      `He wears ${PLAIN_TEE_WHITE} with ${d(x["his jeans"])}. ` +
      `She wears ${PLAIN_TEE_BLACK} with ${d(x["her jeans"])}. ` +
      `The denim is the subject of the photograph.`,
  },
  {
    tag: "purple-brand-photo", aspect: "9:16", house: "purple-brand",
    place: "street", real: true, cast: ["man2", "woman1"], angles: true,
    plain: true,
    look:
      "Los Angeles denim: premium washes and painted wordmarks against pale " +
      "travertine in hard midday sun. The denim is the whole picture, so " +
      "everything above the waist is quiet.",
    shot: "Side by side, both full length, the denim filling the lower half " +
          "of the frame",
    slots: {
      "his jeans":  () => freshCat("purple-brand", "denim"),
      "her shorts": () => freshSub("purple-brand", "shorts"),
    },
    wear: (x) =>
      `He wears ${PLAIN_TEE_WHITE} with ${d(x["his jeans"])}. ` +
      `She wears ${PLAIN_TEE_BLACK} with ${d(x["her shorts"])}. ` +
      `The denim is the subject of the photograph.`,
  },
  {
    tag: "ksubi-photo", aspect: "9:16", house: "ksubi",
    place: "doorway", real: true, cast: ["man", "woman3"], angles: true,
    plain: true,
    look:
      "Sydney denim turned Los Angeles: shredded washes and the scrawled " +
      "signature, cool shade with one hard shaft of sun. Hard, rock-and-roll, " +
      "nothing fussy.",
    shot: "A tall vertical frame, the two of them close together and both " +
          "full length from head to shoes, the denim clearly readable from " +
          "waist to hem and the leg unobstructed its whole length",
    /* Pinned: a reshoot for the cut of the denim, not a change of goods.
     * These two pairs were chosen when it was first shot — the second one
     * by least-used rather than never-used, because Ksubi stocks five pairs
     * and only one had never been photographed, and a repeated pair costs
     * far less than a picture with one person in it. */
    slots: {
      "his jeans": () => exact("ksubi", "Mid wash Ksubi jeans."),
      "her jeans": () => exact("ksubi", "Dark wash Ksubi jeans."),
    },
    wear: (x) =>
      `He wears ${PLAIN_TEE_BLACK} with ${d(x["his jeans"])}. ` +
      `She wears ${PLAIN_TEE_WHITE} with ${d(x["her jeans"])}. ` +
      `The denim is the subject of the photograph.`,
  },
  {
    tag: "chrome-hearts-solo-photo", aspect: "9:16", house: "chrome-hearts",
    place: "doorway", real: true, cast: ["man2", "woman2"], angles: true,
    plain: true,
    look:
      "Hollywood gothic: hard directional sun and deep shade, a silver, black " +
      "and bone palette, sterling jewellery and gothic lettering catching the " +
      "light.",
    shot: "Side by side in the shade of an arched concrete colonnade",
    slots: {
      "his shirt": () => freshCat("chrome-hearts", "shirts"),
      "his cap":   () => freshSub("chrome-hearts", "snapbacks"),
      "her shirt": () => freshCat("chrome-hearts", "shirts"),
    },
    wear: (x) =>
      `He wears ${d(x["his shirt"])} with ${PLAIN_JEANS_BLACK}` +
      `${x["his cap"] ? ` and ${d(x["his cap"])}` : ""}. ` +
      `She wears ${d(x["her shirt"])} with ${PLAIN_JEANS_INDIGO}.`,
  },
  {
    tag: "supreme-solo-photo", aspect: "9:16", house: "supreme",
    place: "crown", real: true, cast: ["man", "woman1"], angles: true,
    plain: true,
    look:
      "Downtown New York: the box logo on white cotton, bright flat daylight, " +
      "red and white against pale concrete. Direct and graphic.",
    shot: "Side by side in the plaza that closes the district",
    slots: {
      "his tee": () => freshCat("supreme", "shirts"),
      "her tee": () => freshCat("supreme", "shirts"),
    },
    wear: (x) =>
      `He wears ${d(x["his tee"])} with ${PLAIN_JEANS_INDIGO}. ` +
      `She wears ${d(x["her tee"])} with ${PLAIN_JEANS_BLACK}.`,
  },
  {
    tag: "chrome-amiri-photo", aspect: "9:16", house: "chrome-hearts",
    place: "doorway", real: true, cast: ["man2", "woman2"], angles: true,
    look:
      "Hollywood gothic over Los Angeles denim: sterling silver and gothic " +
      "lettering above hand-distressed indigo. Hard directional sun, deep " +
      "shade, a silver-black-and-bone palette. Tight and expensive.",
    shot: "Side by side in the shade of an arched concrete colonnade",
    slots: {
      "his shirt": () => freshCat("chrome-hearts", "shirts"),
      "his jeans": () => freshCat("amiri", "denim"),
      "his cap":   () => freshSub("chrome-hearts", "snapbacks"),
      "her shirt": () => freshCat("chrome-hearts", "shirts"),
      "her jeans": () => freshCat("amiri", "denim"),
    },
    wear: (x) =>
      `He wears ${d(x["his shirt"])} with ${d(x["his jeans"])}` +
      `${x["his cap"] ? ` and ${d(x["his cap"])}` : ""}. ` +
      `She wears ${d(x["her shirt"])} with ${d(x["her jeans"])}.`,
  },
  {
    /* Both models in complete sets, asked for by name. Casablanca sells
     * five of them and a category pick would have split two. */
    tag: "casablanca-sets-photo", aspect: "9:16", house: "casablanca",
    place: "street", real: true, cast: ["man", "woman3"], angles: true,
    look:
      "Mediterranean apres-sport: late sun, warm pastel light, towelling and " +
      "silk. Colour and ease, nothing stiff.",
    shot: "Side by side on pale travertine with palms behind them",
    slots: {
      "his shirt":  () => wholeSet("casablanca", "casablanca-black")[0],
      "his shorts": () => wholeSet("casablanca", "casablanca-black")[1],
      "her shirt":  () => wholeSet("casablanca", "casablanca-teal")[0],
      "her shorts": () => wholeSet("casablanca", "casablanca-teal")[1],
    },
    wear: (x) =>
      `He wears ${d(x["his shirt"])} with ${d(x["his shorts"])}, the matching ` +
      `set they are sold as. She wears ${d(x["her shirt"])} with ` +
      `${d(x["her shorts"])}, likewise a matching set.`,
  },
  {
    tag: "supreme-ksubi-two-photo", aspect: "9:16", house: "supreme",
    place: "crown", real: true, cast: ["man", "woman1"], angles: true,
    look:
      "Downtown New York over Sydney denim: the box logo against shredded " +
      "washes. Bright flat daylight, red and indigo, graphic and direct.",
    shot: "Side by side in the plaza that closes the district",
    slots: {
      "his tee":   () => freshCat("supreme", "shirts"),
      "his jeans": () => freshCat("ksubi", "denim"),
      "her tee":   () => freshCat("supreme", "shirts"),
      "her jeans": () => freshCat("ksubi", "denim"),
    },
    wear: (x) =>
      `He wears ${d(x["his tee"])} with ${d(x["his jeans"])}. ` +
      `She wears ${d(x["her tee"])} with ${d(x["her jeans"])}.`,
  },
  {
    tag: "off-white-vale-photo", aspect: "9:16", house: "off-white",
    place: "hoarding", real: true, cast: ["man2", "woman3"], angles: true,
    look:
      "Milan industrial meets collegiate: Helvetica caps and quotation marks " +
      "over arched varsity lettering. Clean hard light, black and white with " +
      "one warm note.",
    shot: "Side by side at a low angle under a bright screen",
    slots: {
      "his tee":    () => freshCat("off-white", "shirts"),
      "his shorts": () => freshSub("vale", "shorts"),
      "her tee":    () => freshCat("off-white", "shirts"),
      "her shorts": () => freshSub("vale", "shorts"),
    },
    wear: (x) =>
      `He wears ${d(x["his tee"])} with ${d(x["his shorts"])}. ` +
      `She wears ${d(x["her tee"])} with ${d(x["her shorts"])}.`,
  },
  {
    tag: "godspeed-two-photo", aspect: "2:3", house: "godspeed",
    place: "street", real: true, cast: ["man", "woman2"], angles: true,
    look:
      "New York gothic streetwear in daylight for once: religious motifs and " +
      "boxy cuts under a flat bright sky, black and bone against pale paving.",
    shot: "Side by side on the open promenade",
    slots: {
      "his shirt":  () => freshCat("godspeed", "shirts"),
      "his shorts": () => freshSub("godspeed", "shorts"),
      "her shirt":  () => freshCat("godspeed", "shirts"),
      "her shorts": () => freshSub("godspeed", "shorts"),
    },
    wear: (x) =>
      `He wears ${d(x["his shirt"])} with ${d(x["his shorts"])}. ` +
      `She wears ${d(x["her shirt"])} with ${d(x["her shorts"])}.`,
  },
  {
    tag: "gallery-purple-two-photo", aspect: "2:3", house: "gallery-dept",
    place: "street", real: true, cast: ["man2", "woman1"], angles: true,
    look:
      "Two Los Angeles studios in full sun: hand-painted and repaired cotton " +
      "over premium denim washes. Bone, rust and indigo, everything worn in.",
    shot: "A tall vertical frame on the promenade, the two of them close " +
          "together with her turned away from camera so the back of her " +
          "t-shirt reads, both full length from head to shoes, the skyline " +
          "behind them",
    /* Pinned. This is the shot the yellow tee is wrong in: it says DEPT. on
     * the chest and COACH across the shoulders, and the first attempt put
     * the chest print on her back. Swapping in a different shirt would not
     * have corrected that, only changed the subject. */
    slots: {
      "his shirt":  () => exact("gallery-dept", "Orange Gallery Dept. shirt."),
      "his jeans":  () => exact("purple-brand", "Black Purple Brand jeans."),
      "her shirt":  () => exact("gallery-dept", "Yellow Gallery Dept. t-shirt."),
      "her shorts": () => exact("purple-brand", "Grey Purple Brand shorts."),
    },
    wear: (x) =>
      `He wears ${d(x["his shirt"])} with ${d(x["his jeans"])}. ` +
      `She wears ${d(x["her shirt"])} with ${d(x["her shorts"])}.`,
  },
  {
    tag: "balenciaga-photo", aspect: "9:16", house: "balenciaga",
    place: "street", real: true, cast: ["man2", "woman1"], angles: true,
    // The house has one pair of shorts nobody has photographed and two
    // people in the frame, so hers are plain. `plain` is what carries
    // UNBRANDED into the prompt, without which the model puts a logo on
    // anything it is not shown — and a logo it invented on a Balenciaga
    // board is a garment the shop cannot sell.
    plain: true,
    look:
      "Paris rebuilt around utility: exaggerated volume, condensed logo type, " +
      "a cool grey-and-black palette under flat bright daylight. Severe, " +
      "architectural, expensive.",
    shot: "A tall vertical frame, the two of them standing close together " +
          "with him a half step behind her shoulder, both full length from " +
          "head to shoes, the street receding behind them, headroom above " +
          "and pale paving below",
    slots: {
      "his shirt":   () => freshCat("balenciaga", "shirts"),
      "his shorts":  () => freshSub("balenciaga", "shorts"),
      "her shirt":   () => freshCat("balenciaga", "shirts"),
      "her shorts":  () => freshSub("balenciaga", "shorts"),
    },
    wear: (x) =>
      `He wears ${d(x["his shirt"])} with ${d(x["his shorts"])}. ` +
      `She wears ${d(x["her shirt"])} with ` +
      `${x["her shorts"] ? d(x["her shorts"]) : PLAIN_SHORTS_BLACK}.`,
  },
  {
    tag: "godspeed-photo", aspect: "9:16", house: "godspeed",
    place: "doorway", real: true, cast: ["man", "woman2"], angles: true,
    plain: true,
    look:
      "New York streetwear with a gothic streak: religious motifs, boxy cuts, " +
      "deep shade and a hard shaft of light. Moody, high contrast, serious.",
    shot: "A tall vertical frame under a concrete colonnade arch, the two " +
          "of them close together with her a half step forward of him, both " +
          "full length from head to shoes, the arch rising the full height " +
          "of the picture and a hard shaft of light across the paving",
    slots: {
      "his shirt":  () => freshCat("godspeed", "shirts"),
      "his shorts": () => freshSub("godspeed", "shorts"),
      "his cap":    () => freshSub("godspeed", "snapbacks"),
      "her shirt":  () => freshCat("godspeed", "shirts"),
      "her shorts": () => freshSub("godspeed", "shorts"),
    },
    wear: (x) =>
      `He wears ${d(x["his shirt"])} with ${d(x["his shorts"])}` +
      `${x["his cap"] ? ` and ${d(x["his cap"])}` : ""}. ` +
      `She wears ${d(x["her shirt"])} with ` +
      `${x["her shorts"] ? d(x["her shorts"]) : PLAIN_SHORTS_BLACK}.`,
  },
  {
    tag: "hellstar-photo", aspect: "9:16", house: "hellstar",
    place: "hoarding", real: true, cast: ["man2", "woman3"], angles: true,
    own: true,
    look:
      "Los Angeles graphic wear: flame and star iconography, hot low sun, " +
      "long shadows, saturated colour against pale concrete.",
    shot: "A tall vertical frame from a low angle looking slightly up at " +
          "them, the two standing close together and full length from head " +
          "to shoes, palm fronds and deep blue sky filling the height above " +
          "them",
    slots: {
      "his tee":    () => freshCat("hellstar", "shirts"),
      "his shorts": () => freshSub("hellstar", "shorts"),
      "her tee":    () => freshCat("hellstar", "shirts"),
      "her shorts": () => freshSub("hellstar", "shorts"),
    },
    wear: (x) =>
      `He wears ${d(x["his tee"])} with ${d(x["his shorts"])}. ` +
      `She wears ${d(x["her tee"])} with ${d(x["her shorts"])}.`,
  },
  {
    tag: "vale-photo", aspect: "9:16", house: "vale",
    place: "street", real: true, cast: ["man", "woman1"], angles: true,
    plain: true,
    look:
      "Collegiate, worn off campus: arched varsity lettering on heavyweight " +
      "cotton, clean midday light, a relaxed all-American ease.",
    shot: "A tall vertical frame on the promenade, the two of them close " +
          "together with one a half step behind the other, both full length " +
          "from head to shoes, palms rising the full height behind them",
    slots: {
      "his tee":    () => freshCat("vale", "shirts"),
      "his shorts": () => freshSub("vale", "shorts"),
      "her tee":    () => freshCat("vale", "shirts"),
      "her shorts": () => freshSub("vale", "shorts"),
    },
    wear: (x) =>
      `He wears ${d(x["his tee"])} with ${d(x["his shorts"])}. ` +
      `She wears ${x["her tee"] ? d(x["her tee"]) : PLAIN_TEE_WHITE} with ` +
      `${d(x["her shorts"])}.`,
  },
  {
    tag: "off-white-ksubi-photo", aspect: "21:9", house: "off-white",
    place: "crown", real: true, cast: ["man2", "woman2"], angles: true,
    look:
      "Milan meets Sydney denim: Helvetica caps and quotation marks over " +
      "shredded washes. Clean bright light, a white-and-indigo palette, " +
      "graphic and sharp.",
    shot: "Side by side and wide, both full length in a cinematic frame",
    slots: {
      "his tee":   () => freshCat("off-white", "shirts"),
      "his jeans": () => freshCat("ksubi", "denim"),
      "her tee":   () => freshCat("off-white", "shirts"),
      "her jeans": () => freshCat("ksubi", "denim"),
    },
    wear: (x) =>
      `He wears ${d(x["his tee"])} with ${d(x["his jeans"])}. ` +
      `She wears ${d(x["her tee"])} with ${d(x["her jeans"])}.`,
  },
  {
    tag: "gallery-purple-photo", aspect: "9:16", house: "gallery-dept",
    place: "doorway", real: true, cast: ["man", "woman3"], angles: true,
    look:
      "Two Los Angeles studios: hand-painted and reworked cotton over premium " +
      "denim washes. Warm dusty light, bone and indigo, everything a little " +
      "worn in.",
    shot: "A tall vertical frame filled by an arched concrete doorway, the " +
          "two of them standing close together inside it and full length " +
          "from head to shoes, the arch rising the full height of the " +
          "picture",
    // Pinned: a reshoot for the fit of the denim, not a change of goods.
    slots: {
      "his shirt": () => exact("gallery-dept", "White Gallery Dept. t-shirt."),
      "his jeans": () => exact("purple-brand", "Dark wash Purple Brand jeans."),
      "her shirt": () => exact("gallery-dept", "Off-white Gallery Dept. t-shirt."),
      "her shorts": () => exact("purple-brand", "Charcoal Purple Brand shorts."),
    },
    wear: (x) =>
      `He wears ${d(x["his shirt"])} with ${d(x["his jeans"])}. ` +
      `She wears ${d(x["her shirt"])} with ${d(x["her shorts"])}.`,
  },
  {
    /* The socks picture. Bape has no garments at all, so the frame has to
     * go to where the socks are rather than pretending there is an outfit
     * to photograph. Low and close, legs and feet filling it. */
    tag: "bape-socks-photo", aspect: "16:9", house: "bape",
    place: "street", real: true, cast: ["man2", "woman1"],
    look:
      "Ura-Harajuku: the classic camo logo, bright flat daylight on pale " +
      "travertine, a playful streetwear energy. Colour in the socks, " +
      "everything else quiet.",
    /* No `angles` flag on this one, and that is the fix rather than an
     * oversight. ANGLES opens with "both full length", which flatly
     * contradicts a frame cropped at the knee — the first attempt obeyed the
     * shared line and ignored the specific one, and came back as an ordinary
     * full-length portrait. The two-angle instruction is written into the
     * shot itself instead, where nothing argues with it.
     *
     * Cropping above the shorts also solves a second problem. Bape sells no
     * tops, so anything above the waist would have to be invented, and the
     * first attempt duly put both models in plain white t-shirts the shop
     * does not stock. What is not in frame cannot be made up. */
    shot: "A low, tight frame cropped at mid-thigh, camera near the ground. " +
          "Two pairs of legs side by side on pale travertine paving, shown " +
          "from the hem of the shorts down. The socks and trainers fill the " +
          "middle of the picture and are the subject. One pair square to " +
          "camera, the other turned to show the side and heel of the sock. " +
          "No faces, no torsos, nothing above mid-thigh in frame at all",
    slots: {
      "his socks":  () => freshSub("bape", "socks"),
      "his shorts": () => freshSub("vale", "shorts"),
      "her socks":  () => freshSub("bape", "socks"),
      "her shorts": () => freshSub("vale", "shorts"),
    },
    wear: (x) =>
      `He wears ${d(x["his socks"])} with ${d(x["his shorts"])}. ` +
      `She wears ${d(x["her socks"])} with ${d(x["her shorts"])}. ` +
      `The socks are the subject of the photograph and their logos and ` +
      `colourways must match their reference photographs exactly.`,
  },
  {
    tag: "chrome-hearts-photo", aspect: "2:3", house: "chrome-hearts",
    place: "doorway", real: true, cast: ["man2"],
    look:
      "Hollywood gothic: hard directional sun and deep shade, a silver-grey and " +
      "black palette, the sterling jewellery and the gothic lettering catching " +
      "the light. Tight, moody, expensive.",
    shot: "Three-quarter view from the waist up, shoulders square to camera, " +
          "the shirt graphic and the cap both clearly readable",
    slots: {
      shirt: () => freshCat("chrome-hearts", "shirts"),
      cap:   () => freshSub("chrome-hearts", "snapbacks"),
    },
    wear: (x) =>
      `He wears ${d(x.shirt)}` + (x.cap ? ` with ${d(x.cap)}` : "") + ".",
  },
  {
    tag: "casablanca-photo", aspect: "2:3", house: "casablanca",
    place: "street", real: true, cast: ["woman3"],
    look:
      "Mediterranean apres-sport: late afternoon sun, warm pastel light, a " +
      "relaxed resort ease. Silk and towelling, colour everywhere, nothing " +
      "stiff.",
    shot: "Full length, head to shoes, the whole outfit clearly visible, " +
          "centred with headroom above and paving below",
    slots: {
      shirt:  () => wholeSet("casablanca", "casablanca-terry-green")[0],
      shorts: () => wholeSet("casablanca", "casablanca-terry-green")[1],
    },
    wear: (x) =>
      `She wears ${d(x.shirt)} with ${d(x.shorts)}, worn together as the ` +
      `matching set they are sold as.`,
  },
  {
    tag: "amiri-photo", aspect: "2:3", house: "amiri",
    place: "doorway", real: true, cast: ["man"],
    own: true,
    look:
      "Los Angeles rock-and-roll tailoring: bone and black, low contrast, " +
      "cool shade with one hard shaft of sun. Hand-distressed denim, nothing " +
      "loud, restraint doing the work.",
    shot: "A tall vertical frame, full length from head to shoes, the " +
          "whole outfit clearly visible and the leg of the jean " +
          "unobstructed its whole length",
    // Pinned: a reshoot for the cut of the denim, not a change of goods.
    slots: {
      shirt: () => exact("amiri", "Grey Amiri t-shirt."),
      jeans: () => exact("amiri", "Light wash Amiri jeans."),
    },
    wear: (x) => `He wears ${d(x.shirt)} with ${d(x.jeans)}.`,
  },
  {
    tag: "rhude-photo", aspect: "9:16", house: "rhude",
    place: "street", real: true, cast: ["woman1"], own: true,
    look:
      "Americana filtered through motorsport: hot midday light on pale " +
      "paving, a luxury-sportswear calm. Clean lines, racing colour used " +
      "sparingly.",
    shot: "A tall vertical frame, full length and centred with the street " +
          "running away behind her, head to shoes clearly in frame, " +
          "headroom above and pale paving below",
    slots: {
      tee:    () => freshCat("rhude", "shirts"),
      shorts: () => freshSub("rhude", "shorts"),
    },
    wear: (x) => `She wears ${d(x.tee)} with ${d(x.shorts)}.`,
  },
  {
    tag: "essentials-photo", aspect: "2:3", house: "essentials",
    place: "doorway", real: true, cast: ["woman2"],
    look:
      "Fear of God Essentials: oversized basics in cement, taupe and bone, " +
      "soft even light on concrete, a quiet monochrome palette. Volume and " +
      "texture rather than colour or print.",
    shot: "Full length, head to shoes, the whole outfit clearly visible, the " +
          "drape and volume of the fleece reading clearly",
    slots: {
      hoodie: () => wholeSet("essentials", "essentials-fleece-black")[0],
      shorts: () => wholeSet("essentials", "essentials-fleece-black")[1],
    },
    wear: (x) =>
      `She wears ${d(x.hoodie)} with ${d(x.shorts)}, worn together as the ` +
      `matching set they are sold as.`,
  },
  {
    tag: "crown-group", aspect: "21:9", house: "district", place: "crown", board: "the wide crown screen",
    shot: "The three of them together, full length, side by side and slightly " +
          "staggered, all clearly in frame with headroom above and paving below, " +
          "walking toward camera",
    cast: ["man", "woman1", "woman2"],
    slots: {
      "his shirt":   () => byCat("chrome-hearts", "shirts"),
      "his jeans":   () => byCat("amiri", "denim"),
      "his cap":     () => bySub("chrome-hearts", "snapbacks"),
      "her tee":     () => byCat("off-white", "shirts"),
      "her jeans":   () => byCat("purple-brand", "denim"),
      "her2 tee":    () => byCat("supreme", "shirts"),
      "her2 shorts": () => byCat("vale", "bottoms"),
    },
    wear: (s) =>
      `The man wears ${d(s["his shirt"])} with ${d(s["his jeans"])}` +
      `${s["his cap"] ? ` and ${d(s["his cap"])}` : ""}. ` +
      `The first woman wears ${d(s["her tee"])} with ${d(s["her jeans"])}. ` +
      `The second woman wears ${d(s["her2 tee"])} with ${d(s["her2 shorts"])}.`,
  },
  {
    tag: "off-white-purple", aspect: "2:3", house: "off-white", place: "street", cast: ["woman1"],
    shot: "Full length, head to shoes, the whole outfit clearly visible, centred " +
          "with headroom above and paving below",
    slots: {
      tee:   () => byCat("off-white", "shirts"),
      jeans: () => byCat("purple-brand", "denim"),
    },
    wear: (s) => `She wears ${d(s.tee)} with ${d(s.jeans)}.`,
  },
  {
    tag: "chrome-amiri", aspect: "2:3", house: "chrome-hearts", place: "doorway", cast: ["man"],
    shot: "Full length, head to shoes, the whole outfit clearly visible",
    slots: {
      shirt:  () => byCat("chrome-hearts", "shirts", 1),
      jeans:  () => byCat("amiri", "denim", 1),
      beanie: () => bySub("chrome-hearts", "beanies"),
    },
    wear: (s) =>
      `He wears ${d(s.shirt)} with ${d(s.jeans)}` +
      `${s.beanie ? ` and ${d(s.beanie)} on his head` : ""}.`,
  },
  {
    tag: "supreme-ksubi-her", aspect: "2:3", house: "supreme", place: "street", cast: ["woman2"],
    shot: "Full length, head to shoes, the whole outfit clearly visible",
    slots: {
      tee:   () => byCat("supreme", "shirts"),
      jeans: () => byCat("ksubi", "denim"),
    },
    wear: (s) => `She wears ${d(s.tee)} with ${d(s.jeans)}.`,
  },
  {
    tag: "casablanca-vale", aspect: "16:9", house: "casablanca", place: "street", cast: ["woman1"],
    shot: "Waist-up, three-quarter view, the shirt's pattern filling much of the frame",
    slots: {
      shirt:  () => byCat("casablanca", "shirts"),
      shorts: () => byCat("vale", "bottoms", 1),
    },
    wear: (s) => `She wears ${d(s.shirt)} with ${d(s.shorts)}.`,
  },
  {
    tag: "hellstar-balenciaga", aspect: "2:3", house: "hellstar", place: "hoarding", cast: ["man"],
    shot: "Full length, head to shoes, the whole outfit clearly visible",
    slots: {
      tee:    () => byCat("hellstar", "shirts"),
      shorts: () => byCat("balenciaga", "bottoms"),
    },
    wear: (s) => `He wears ${d(s.tee)} with ${d(s.shorts)}.`,
  },
  {
    /* A back view, because some of these garments carry their design there.
     *
     * Gallery Dept. is the case that proves it: the front of this shirt is a
     * small pocket print reading "DEPT." and the back is the word COACH
     * across the whole of it. Advertised from the front it is a plain yellow
     * t-shirt. Both photographs go in as references — given only the front,
     * a generator will invent whatever it likes back there.
     *
     * Rhude was the first choice and had to be dropped: it has no gallery
     * images at all, which the poll said out loud rather than quietly
     * filling the slot with something made up. */
    tag: "gallery-dept-back", aspect: "21:9", house: "gallery-dept", place: "street", cast: ["man"], back: true,
    shot: "Seen from directly behind, cropped from the hips up, the back of the " +
          "t-shirt filling the frame so its printed back design reads clearly. " +
          "The figure faces away from camera, no face in frame",
    slots: {
      tee: () => live("gallery-dept").find((q) => q.cat === "shirts" && q.gallery?.length),
    },
    wear: (s) =>
      `He wears ${d(s.tee)}, seen from behind so the large printed design across ` +
      `the back of it is what fills the frame.`,
  },
  {
    /* All three colourways at once, one on each of the three.
     *
     * The set only makes sense seen together: the shop stocks the Ducati
     * top and pants in white/red, blue and black, and a picture of one of
     * them is a picture of a tracksuit. Three of them side by side is the
     * collection. Every half comes out of set_key, so the pants in each
     * fit are the ones that actually match the top above them.
     */
    tag: "supreme-ducati-three", aspect: "21:9", house: "supreme", place: "crown",
    cast: ["man", "woman1", "woman2"],
    shot: "The three of them together, full length, side by side and evenly " +
          "spaced, all three complete outfits clearly visible head to shoes, " +
          "headroom above and paving below, standing squarely to camera",
    slots: {
      "red top":    () => setHalves("supreme", "supreme-ducati-white-red")[0],
      "red pants":  () => setHalves("supreme", "supreme-ducati-white-red")[1],
      "blue top":   () => setHalves("supreme", "supreme-ducati-blue")[0],
      "blue pants": () => setHalves("supreme", "supreme-ducati-blue")[1],
      "black top":  () => setHalves("supreme", "supreme-ducati-black")[0],
      "black pants":() => setHalves("supreme", "supreme-ducati-black")[1],
    },
    wear: (s) =>
      `The man wears the cream and red Supreme Ducati track jacket with its ` +
      `matching cream and red track pants. The first woman wears the light blue ` +
      `Supreme Ducati track jacket with its matching light blue track pants. ` +
      `The second woman wears the black Supreme Ducati track jacket with its ` +
      `matching black track pants. Each of the three wears one complete ` +
      `colourway, top and bottom together, exactly as the reference ` +
      `photographs show them — do not mix the colours between the three.`,
  },
  {
    /* The photographed version of the Ducati pair above.
     *
     * Three people in a 9:16 frame is the hard one. Side by side and evenly
     * spaced is a wide-frame composition — it was shot at 21:9 and read
     * well there — and squeezing that same line of three into a tall frame
     * leaves each of them a third of the width and the clothes unreadable,
     * which defeats the point of a board advertising three colourways.
     *
     * So they are staggered in depth instead: one forward and centred, the
     * other two just behind at each shoulder. That is the standard vertical
     * group portrait, it fills the height, and all three outfits stay
     * legible head to shoes.
     *
     * The black set for the single, because it is the least photographed of
     * the three: the blue is already on three boards and the cream and red
     * on two.
     */
    tag: "supreme-sets-photo", aspect: "9:16", house: "supreme", place: "crown", real: true,
    cast: ["man", "woman1", "woman2"], own: true,
    shot: "A tall vertical frame with the three of them staggered in depth " +
          "rather than in a line: one standing a half step forward and " +
          "centred, the other two just behind at each shoulder and turned " +
          "slightly inward. All three full length from head to shoes with " +
          "all three complete outfits clearly visible, headroom above and " +
          "paving below",
    slots: {
      "red top":     () => setHalves("supreme", "supreme-ducati-white-red")[0],
      "red pants":   () => setHalves("supreme", "supreme-ducati-white-red")[1],
      "blue top":    () => setHalves("supreme", "supreme-ducati-blue")[0],
      "blue pants":  () => setHalves("supreme", "supreme-ducati-blue")[1],
      "black top":   () => setHalves("supreme", "supreme-ducati-black")[0],
      "black pants": () => setHalves("supreme", "supreme-ducati-black")[1],
    },
    wear: () =>
      "The man wears the cream and red Supreme hooded track top with its matching " +
      "cream and red track pants. The first woman wears the light blue Supreme " +
      "hooded track top with its matching light blue track pants. The second woman " +
      "wears the black Supreme hooded track top with its matching black track " +
      "pants. Each of the three wears one complete colourway, hood and pants " +
      "together, exactly as the reference photographs show them — do not mix the " +
      "colours between the three.",
  },
  {
    tag: "supreme-hoodie-photo", aspect: "2:3", house: "supreme", place: "street", real: true,
    cast: ["woman1"],
    shot: "Full length, head to shoes, the whole outfit clearly visible, centred " +
          "with headroom above and paving below",
    slots: {
      "track top":   () => setHalves("supreme", "supreme-ducati-black")[0],
      "track pants": () => setHalves("supreme", "supreme-ducati-black")[1],
    },
    wear: (s) =>
      `She wears ${d(s["track top"])} with ${d(s["track pants"])}, worn together as ` +
      `the matching set they are sold as.`,
  },
  {
    tag: "supreme-track-her", aspect: "2:3", house: "supreme", place: "crown", cast: ["woman2"],
    shot: "Full length, head to shoes, the whole outfit clearly visible",
    slots: {
      "track top":   () => setHalves("supreme", "supreme-ducati-blue")[0],
      "track pants": () => setHalves("supreme", "supreme-ducati-blue")[1],
    },
    wear: (s) =>
      `She wears ${d(s["track top"])} with ${d(s["track pants"])}, worn together as ` +
      `the matching set they are sold as.`,
  },
  /* ── a second round, for stock nobody has photographed ───────────────
   *
   * A hundred and seventy-two garments are in stock and have never been in
   * a picture, which is most of the shop. Each of these is one house, two
   * models, portrait, and built entirely out of that backlog — the pickers
   * refuse anything already shot, so there is no way for one of these to
   * reach for a garment that is already hanging somewhere.
   *
   * All of them are own-house boards. That is deliberate after the Purple
   * Brand page turned out to be carrying two Gallery Dept. chapters: a
   * house advertises itself here, and where a house sells no tops — Purple
   * Brand sells denim and shorts and nothing else — the tops are plain
   * rather than borrowed from a neighbour.
   */
  {
    tag: "purple-brand-denim-photo", aspect: "9:16", house: "purple-brand",
    place: "street", real: true, cast: ["man2", "woman1"], angles: true, plain: true,
    look:
      "Los Angeles denim, studied: hand-finished washes, tonal embroidery, " +
      "clean hot daylight on pale paving. The jean is the whole of the " +
      "point, so everything around it is quiet.",
    shot: "A tall vertical frame, the two of them close together with him a " +
          "half step behind her, both full length from head to shoes, the " +
          "legs of the jeans unobstructed and clearly visible their whole " +
          "length, headroom above and pale paving below",
    slots: {
      "his jeans":  () => freshCat("purple-brand", "denim"),
      "her shorts": () => freshSub("purple-brand", "shorts"),
    },
    wear: (x) =>
      `He wears ${PLAIN_TEE_WHITE} with ${d(x["his jeans"])}. ` +
      `She wears ${PLAIN_TEE_BLACK} with ${d(x["her shorts"])}.`,
  },
  {
    tag: "amiri-denim-photo", aspect: "9:16", house: "amiri",
    place: "street", real: true, cast: ["man", "woman2"], angles: true, own: true,
    look:
      "Los Angeles luxury streetwear: bandana motifs and bone-coloured " +
      "leather against faded indigo, warm low sun, an expensive ease.",
    shot: "A tall vertical frame, the two of them standing close with her a " +
          "half step forward, both full length from head to shoes, the " +
          "denim visible its whole length, headroom above and paving below",
    slots: {
      "his tee":   () => freshCat("amiri", "shirts"),
      "his jeans": () => freshCat("amiri", "denim"),
      "her tee":   () => freshCat("amiri", "shirts"),
      "her jeans": () => freshCat("amiri", "denim"),
    },
    wear: (x) =>
      `He wears ${d(x["his tee"])} with ${d(x["his jeans"])}. ` +
      `She wears ${d(x["her tee"])} with ${d(x["her jeans"])}.`,
  },
  {
    tag: "chrome-hearts-caps-photo", aspect: "9:16", house: "chrome-hearts",
    place: "doorway", real: true, cast: ["man2", "woman3"], angles: true, plain: true,
    look:
      "Hollywood gothic: sterling hardware, cross motifs and blackletter " +
      "type on heavyweight cotton, deep shade with a hard shaft of light.",
    shot: "A tall vertical frame under a concrete arch, the two of them " +
          "close together, both full length from head to shoes, the caps " +
          "clearly readable, the arch rising the full height of the picture",
    slots: {
      "his tee":  () => freshCat("chrome-hearts", "shirts"),
      "his cap":  () => freshSub("chrome-hearts", "snapbacks"),
      "her tee":  () => freshCat("chrome-hearts", "shirts"),
      "her hat":  () => freshSub("chrome-hearts", "beanies"),
    },
    wear: (x) =>
      `He wears ${d(x["his tee"])} with ${PLAIN_JEANS_BLACK}` +
      `${x["his cap"] ? ` and ${d(x["his cap"])}` : ""}. ` +
      `She wears ${d(x["her tee"])} with ${PLAIN_JEANS_INDIGO}` +
      `${x["her hat"] ? ` and ${d(x["her hat"])}` : ""}.`,
  },
  {
    tag: "godspeed-caps-photo", aspect: "9:16", house: "godspeed",
    place: "street", real: true, cast: ["man", "woman1"], angles: true, plain: true,
    look:
      "New York streetwear with a gothic streak: religious motifs and " +
      "motorsport graphics on boxy cotton, bright flat daylight.",
    shot: "A tall vertical frame on open paving, the two of them close " +
          "together with one a half step back, both full length from head " +
          "to shoes, the caps clearly readable, headroom above",
    slots: {
      "his tee":    () => freshCat("godspeed", "shirts"),
      "his shorts": () => freshSub("godspeed", "shorts"),
      "his cap":    () => freshSub("godspeed", "snapbacks"),
      "her tee":    () => freshCat("godspeed", "shirts"),
      "her cap":    () => freshSub("godspeed", "snapbacks"),
    },
    wear: (x) =>
      `He wears ${d(x["his tee"])} with ${d(x["his shorts"])}` +
      `${x["his cap"] ? ` and ${d(x["his cap"])}` : ""}. ` +
      `She wears ${d(x["her tee"])} with ${PLAIN_SHORTS_BLACK}` +
      `${x["her cap"] ? ` and ${d(x["her cap"])}` : ""}.`,
  },
  {
    /* The artwork the Box Logo band never had. It was a legacy row showing
     * a flat-lay of a folded tee on white, which is a product photograph
     * standing in for a campaign. */
    tag: "supreme-boxlogo-photo", aspect: "9:16", house: "supreme",
    place: "street", real: true, cast: ["man2", "woman2"], angles: true, plain: true,
    look:
      "Downtown New York, transplanted: the box logo on heavyweight cotton, " +
      "bright flat daylight, red and white against pale concrete. Plain, " +
      "confident, nothing fussy.",
    shot: "A tall vertical frame, the two of them standing close together " +
          "with him a half step behind her shoulder, both full length from " +
          "head to shoes, the chest graphics clearly readable, headroom " +
          "above and pale paving below",
    slots: {
      "his tee": () => freshCat("supreme", "shirts"),
      "her tee": () => freshCat("supreme", "shirts"),
    },
    wear: (x) =>
      `He wears ${d(x["his tee"])} with ${PLAIN_JEANS_BLACK}. ` +
      `She wears ${d(x["her tee"])} with ${PLAIN_JEANS_INDIGO}.`,
  },
  {
    tag: "rhude-two-photo", aspect: "9:16", house: "rhude",
    place: "crown", real: true, cast: ["man", "woman3"], angles: true, own: true,
    look:
      "Americana filtered through motorsport: racing type used sparingly, " +
      "hot midday light on pale paving, a luxury-sportswear calm.",
    shot: "A tall vertical frame on the plaza, the two of them close " +
          "together with her a half step forward, both full length from " +
          "head to shoes, headroom above and paving below",
    slots: {
      "his tee":    () => freshCat("rhude", "shirts"),
      "his shorts": () => freshSub("rhude", "shorts"),
      "her tee":    () => freshCat("rhude", "shirts"),
      "her shorts": () => freshSub("rhude", "shorts"),
    },
    wear: (x) =>
      `He wears ${d(x["his tee"])} with ${d(x["his shorts"])}. ` +
      `She wears ${d(x["her tee"])} with ${d(x["her shorts"])}.`,
  },
  {
    tag: "casablanca-three-photo", aspect: "9:16", house: "casablanca",
    place: "street", real: true, cast: ["man2", "woman1"], angles: true, own: true,
    look:
      "Riviera leisure: painterly prints on silk and towelling, soft warm " +
      "light, a pastel palette and a holiday calm.",
    shot: "A tall vertical frame on the promenade, the two of them close " +
          "together with one a half step back, both full length from head " +
          "to shoes, palms rising behind them",
    slots: {
      "his shirt":  () => freshCat("casablanca", "shirts"),
      "his shorts": () => freshSub("casablanca", "shorts"),
      "her shirt":  () => freshCat("casablanca", "shirts"),
      "her shorts": () => freshSub("casablanca", "shorts"),
    },
    wear: (x) =>
      `He wears ${d(x["his shirt"])} with ${d(x["his shorts"])}. ` +
      `She wears ${d(x["her shirt"])} with ${d(x["her shorts"])}.`,
  },
  {
    tag: "hellstar-outer-photo", aspect: "9:16", house: "hellstar",
    place: "doorway", real: true, cast: ["man", "woman2"], angles: true, plain: true,
    look:
      "Los Angeles graphic wear: flame and star iconography, deep shade " +
      "with a hard shaft of light, saturated colour on pale concrete.",
    shot: "A tall vertical frame under a concrete arch, the two of them " +
          "close together, both full length from head to shoes, the outer " +
          "layer worn open so what is under it reads too",
    slots: {
      "his jacket": () => freshCat("hellstar", "outerwear"),
      "his shorts": () => freshSub("hellstar", "shorts"),
      "her tee":    () => freshCat("hellstar", "shirts"),
      "her shorts": () => freshSub("hellstar", "shorts"),
    },
    wear: (x) =>
      `He wears ${d(x["his jacket"])} over ${PLAIN_TEE_WHITE} with ` +
      `${d(x["his shorts"])}. ` +
      `She wears ${d(x["her tee"])} with ${d(x["her shorts"])}.`,
  },
];

/** How a garment is named to the model: its own description plus its name. */
function d(p) {
  if (!p) return "";
  const note = p.note ? p.note.replace(/\.$/, "") : p.name;
  return `the ${note.toLowerCase()} shown in its reference photograph`;
}

/* ── the poll ────────────────────────────────────────────────────────────
 * Resolved and printed before a single call is made.
 */
// Several tags, not one: the realistic pair is a pair, and shooting them in
// a single run puts both in the same manifest for ingest to pick up.
const only = process.argv.slice(2).filter((a) => !a.startsWith("-"));
const plan = SET.filter((s) => !only.length || only.includes(s.tag));

const polled = [];
for (const item of plan) {
  const chosen = {};
  const missing = [];
  for (const [slot, resolve] of Object.entries(item.slots)) {
    const p = resolve();
    if (p) {
      chosen[slot] = p;
      // Counted as spent the moment it is chosen, so the next slot and the
      // next picture both see it as already used.
      takenThisRun.set(p.id, (takenThisRun.get(p.id) ?? 0) + 1);
      notesThisRun.add(noteOf(p));
    } else {
      missing.push(slot);
    }
  }
  polled.push({ item, chosen, missing });
}

console.log("BILL OF ITEMS — every garment resolved from stock before anything is sent\n");
for (const { item, chosen, missing } of polled) {
  console.log(`${item.tag}  (${item.aspect}, ${item.place}, ${item.real ? "photoreal" : "cel"})`);
  for (const [slot, p] of Object.entries(chosen)) {
    const extra = item.back ? 2 : item.angles ? 1 : 0;
    const refs = 1 + (extra && p.gallery?.length ? Math.min(extra, p.gallery.length) : 0);
    console.log(
      `   ${slot.padEnd(12)} ${(p.sub || p.cat).padEnd(12)} ${p.name.slice(0, 34).padEnd(36)} ` +
      `${refs} ref${refs > 1 ? "s" : ""}  stock ${p.stock}  ` +
      // Shown so a repeat is visible in the bill rather than only in the
      // finished picture.
      `${(p.used ?? 0) === 0 ? "new" : `seen x${p.used}`}`,
    );
  }
  for (const slot of missing) console.log(`   ${slot.padEnd(12)} NOTHING IN STOCK — slot dropped`);
  console.log("");
}

if (process.argv.includes("--poll")) process.exit(0);

/* ── go ──────────────────────────────────────────────────────────────────
 * Five in flight at most: the account allows twenty and firing a whole
 * batch bounces the tail with 429s that read like prompt failures.
 */
const CAP = 5;
const redoAll = process.argv.includes("--all");

const queue = [];
const manifest = [];
for (const { item, chosen } of polled) {
  const parts = Object.values(chosen);
  if (!parts.length) { console.log(`! ${item.tag}: nothing in stock, skipped`); continue; }

  /* One photograph per garment, and its back as well wherever somebody in
   * the frame is turned.
   *
   * `back` means the whole shot is from behind and takes two. `angles`
   * means one of the two models stands at a three-quarter turn, which is
   * most of these — and it is exactly those shots that were printing a
   * chest graphic across a pair of shoulders. */
  const extraRefs = item.back ? 2 : item.angles ? 1 : 0;
  const refs = [];
  let twoSided = false;
  for (const p of parts) {
    refs.push(refUrl(p.image));
    if (extraRefs && p.gallery?.length) {
      for (const g of p.gallery.slice(0, extraRefs)) refs.push(refUrl(g));
      twoSided = true;
    }
  }

  const who = item.cast.map((k) => CAST[k]).join("; and ");
  // Named from the garment's own description rather than a house list,
  // because the catalogue does not put a brand slug on a product.
  const tapered = parts.some(
    (x) => x.cat === "denim" && /amiri|purple brand|ksubi/i.test(x.note || x.name || ""),
  );
  const prompt =
    `${item.real ? PHOTO : STYLE} ${item.real ? SHOOT + " " : ""}` +
    // The house's own aesthetic, where the shot carries one. This is what
    // stops five photographs of five different labels looking like one
    // catalogue: the light, the palette and the mood are the house's.
    `${item.look ? item.look + " " : ""}` +
    `${item.angles ? ANGLES + " " : ""}${item.shot}. ${who}. ${item.wear(chosen)} ` +
    `They are in ${PLACES[item.place]}. ` +
    `${FIDELITY} ${twoSided ? TWO_SIDES + " " : ""}${tapered ? TAPERED_DENIM + " " : ""}` +
    `${item.plain ? UNBRANDED + " " : ""}` +
    `${item.cast.some((k) => k.startsWith("woman")) ? FEM + " " : ""}` +
    `${NO_TAGS} ${item.house && (item.plain || item.own) ? ownSignage(HOUSE_SIGN[item.house] ?? item.house) : SIGNAGE} ` +
    `${item.real ? PHOTO_FINISH : CEL}`;

  /* Whose board it hangs on, named rather than inferred.
   *
   * The first version took it off the lead garment's own row — and the API
   * does not put a brand slug on a product, so every one of these would
   * have been filed under null. It is a judgement anyway: an Off-White tee
   * worn with Purple Brand jeans is Off-White advertising its shirt, and
   * which house pays for the board is not something to guess from an array
   * index. */
  manifest.push({
    tag: item.tag, aspect: item.aspect, slug: item.house,
    productIds: parts.map((p) => p.id),
    chose: Object.entries(chosen).map(([k, p]) => `${k}=${p.name}`),
  });

  /* The prompt itself, read before it is paid for.
   *
   * `--poll` stops short of this: it proves every garment came from stock,
   * which is the thing that was going wrong when it was written, but the
   * sentence actually sent is assembled further down and nobody had ever
   * seen one before the bill arrived. A dropped slot reads as an empty
   * string in the middle of a sentence, and that is cheaper to catch here
   * than in the picture.
   */
  if (process.argv.includes("--prompts")) {
    console.log(`\n── ${item.tag} (${item.aspect}, ${refs.length} refs)\n${prompt}`);
    continue;
  }

  if (!redoAll && fs.existsSync(`${OUT}${item.tag}.png`)) { console.log(`${item.tag.padEnd(22)} have it`); continue; }
  queue.push({ item, refs, prompt });
}
fs.writeFileSync(`${OUT}manifest.json`, JSON.stringify(manifest, null, 1));

const flying = new Map();
const done = [], bad = [];
while (queue.length || flying.size) {
  while (queue.length && flying.size < CAP) {
    const job = queue[0];
    const r = await call("/marketing-studio/image", {
      method: "POST",
      body: JSON.stringify({
        prompt: job.prompt, resolution: "1k",
        aspect_ratio: job.item.aspect, image_urls: job.refs,
      }),
    });
    if (r.status === 429) break;                     // queue full; feed again shortly
    queue.shift();
    let id = null;
    try { id = JSON.parse(r.body).request_id; } catch { /* below */ }
    if (id) { flying.set(id, job.item); console.log(`${job.item.tag.padEnd(22)} sent (${job.refs.length} refs)`); }
    else { bad.push(job.item.tag); console.log(`${job.item.tag.padEnd(22)} ${r.status} ${scrub(r.body).slice(0, 140)}`); }
  }

  await new Promise((r) => setTimeout(r, 5000));

  for (const [id, item] of [...flying]) {
    const st = await call(`/requests/${id}/status`);
    let j; try { j = JSON.parse(st.body); } catch { continue; }
    if (!["completed", "failed", "nsfw", "canceled"].includes(j.status)) continue;
    flying.delete(id);
    const url = j.images?.[0]?.url;
    if (j.status === "completed" && url) {
      fs.writeFileSync(`${OUT}${item.tag}.png`, Buffer.from(await (await fetch(url)).arrayBuffer()));
      done.push(item.tag);
      console.log(`  ${item.tag.padEnd(22)} ok   (${done.length})`);
    } else {
      bad.push(item.tag);
      console.log(`  ${item.tag.padEnd(22)} ${j.status} ${scrub(j.error || "")}`.slice(0, 150));
    }
  }
}

console.log(`\n${done.length} written to ${OUT}`);
if (bad.length) console.log("did not land:", bad.join(", "));
