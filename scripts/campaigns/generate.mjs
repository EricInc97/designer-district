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

const live = (slug) => (cat.brands[slug] || []).filter((p) => p.image && (p.stock ?? 0) > 0);

/* ── the pickers ─────────────────────────────────────────────────────────
 * Each returns a real row or undefined. Undefined is a dropped slot, never
 * a licence to describe something generic.
 */
const byCat = (slug, c, n = 0) => live(slug).filter((p) => p.cat === c)[n];
const bySub = (slug, sub, n = 0) => live(slug).filter((p) => p.sub === sub)[n];
const setHalves = (slug, key) => {
  const both = live(slug).filter((p) => p.setKey === key);
  return [both.find((p) => p.cat === "hoodies"), both.find((p) => p.cat === "bottoms")].filter(Boolean);
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

const HOUSES = "BAPE, CHROME HEARTS, SUPREME, AMIRI, BALENCIAGA, GALLERY DEPT, GODSPEED, " +
  "PURPLE BRAND, OFF-WHITE, CASABLANCA, KSUBI, RHUDE, VALE, HELLSTAR, ESSENTIALS";
const SIGNAGE =
  `Any shopfront or screen signage may only read from this list: ${HOUSES}, or ` +
  "DESIGNER DISTRICT. Everything else blank. No other real fashion brand names.";
const FIDELITY =
  "Reproduce every garment exactly as shown in its reference photograph — same " +
  "colour, same cut, same printed graphics and lettering. Do not restyle or " +
  "substitute any of the clothing.";
const NO_TAGS =
  "The clothes are being worn, so they carry no retail hang tags, no price tags " +
  "and no swing tickets anywhere.";
const CEL =
  "Render the entire image as hand-painted 2D anime cel animation. It must not " +
  "look like a photograph or a 3D render — painted backgrounds, visible linework, " +
  "flat cel shading.";

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
const only = process.argv.slice(2).find((a) => !a.startsWith("-"));
const plan = SET.filter((s) => !only || s.tag === only);

const polled = [];
for (const item of plan) {
  const chosen = {};
  const missing = [];
  for (const [slot, resolve] of Object.entries(item.slots)) {
    const p = resolve();
    if (p) chosen[slot] = p; else missing.push(slot);
  }
  polled.push({ item, chosen, missing });
}

console.log("BILL OF ITEMS — every garment resolved from stock before anything is sent\n");
for (const { item, chosen, missing } of polled) {
  console.log(`${item.tag}  (${item.aspect}, ${item.place})`);
  for (const [slot, p] of Object.entries(chosen)) {
    const refs = 1 + (item.back && p.gallery?.length ? Math.min(2, p.gallery.length) : 0);
    console.log(
      `   ${slot.padEnd(12)} ${(p.sub || p.cat).padEnd(12)} ${p.name.slice(0, 38).padEnd(40)} ` +
      `${refs} ref${refs > 1 ? "s" : ""}  stock ${p.stock}`,
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

  const refs = [];
  for (const p of parts) {
    refs.push(refUrl(p.image));
    // The back view needs the other photographs, or the model invents a back.
    if (item.back && p.gallery?.length) for (const g of p.gallery.slice(0, 2)) refs.push(refUrl(g));
  }

  const who = item.cast.map((k) => CAST[k]).join("; and ");
  const prompt =
    `${STYLE} ${item.shot}. ${who}. ${item.wear(chosen)} They are in ${PLACES[item.place]}. ` +
    `${FIDELITY} ${item.cast.some((k) => k.startsWith("woman")) ? FEM + " " : ""}` +
    `${NO_TAGS} ${SIGNAGE} ${CEL}`;

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
