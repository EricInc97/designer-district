/* Board artwork, third pass: a short one that uses the new columns.
 *
 * The point of this set is that nothing in it is hand-picked by name. The
 * hats come from the `beanies` and `snapbacks` sub-categories, and the
 * tracksuits come from `set_key`, so a model wears a real hat this shop
 * sells and the pants actually match the top. Before those columns existed
 * both of those were name-matching, which is a guess — and the guess that
 * said Chrome Hearts sold no headwear was wrong by twenty-three.
 *
 *   node looks3.mjs
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

const cat = await (await fetch("http://localhost:3200/api/storefront")).json();
const live = (slug) => (cat.brands[slug] || []).filter((p) => p.image && (p.stock ?? 0) > 0);

/** The first item a house has in a given sub-category. */
const bySub = (slug, sub, n = 0) => live(slug).filter((p) => p.sub === sub)[n];
/** Both halves of a co-ordinated set, top first. */
const set = (key) => {
  const both = live("supreme").filter((p) => p.setKey === key);
  return [both.find((p) => p.cat === "hoodies"), both.find((p) => p.cat === "bottoms")].filter(Boolean);
};
const byCat = (slug, c, n = 0) => live(slug).filter((p) => p.cat === c)[n];

/**
 * A reference URL the image API will actually accept.
 *
 * AVIF originals fail. Not "sometimes fail" — tested head to head, the same
 * prompt with one AVIF reference comes back "Generation failed" every time
 * and the same prompt with a JPEG completes. Two of the six Supreme track
 * photographs happen to be AVIF, which is why exactly one colourway of the
 * tracksuit could never be generated while its siblings were fine.
 *
 * Supabase will transcode on the way out, and its render endpoint answers a
 * plain Accept with image/jpeg, so an AVIF original is routed through it
 * and everything else is passed straight through.
 */
const refUrl = (u) =>
  /\.avif($|\?)/i.test(u)
    ? u.replace("/storage/v1/object/public/", "/storage/v1/render/image/public/") +
      "?width=1024&quality=90"
    : u;

const STYLE =
  "Anime film still, hand-painted cel animation, 2000s Japanese animated feature " +
  "aesthetic. Painterly background art, soft rim light, gentle film grain, rich " +
  "saturated colour, clean linework. Not a photograph, not 3D.";

const STREET =
  "a straight open-air pedestrian shopping street paved in pale travertine, lined " +
  "both sides with low concrete shopfronts two and three storeys tall, their " +
  "facades broken by tall narrow vertical fins in saturated crimson, ochre and " +
  "teal, big bright LED advertising hoardings mounted above the shopfronts, " +
  "wind-blown coconut palms in square planters down the middle, yellow canvas " +
  "parasols, deep blue sky with cumulus, and a pale Miami skyline of mint and " +
  "cream towers far beyond the rooftops";

const PLACES = {
  street: STREET,
  hoarding:
    "a low angle looking up past a large bright LED advertising hoarding mounted " +
    "over a concrete shopfront, coconut palm fronds and deep blue sky behind it",
  crown:
    "the paved plaza that closes the district, three enormous LED screens standing " +
    "side by side above a pale diamond-lattice screen wall, palms either side, a " +
    "pale Miami skyline of mint and cream towers behind them",
  doorway:
    "the deep arched openings of a concrete shopfront colonnade, cool shade inside, " +
    "pale travertine paving and a palm shadow across it",
};

const HOUSES = "BAPE, CHROME HEARTS, SUPREME, AMIRI, BALENCIAGA, GALLERY DEPT, GODSPEED, " +
  "PURPLE BRAND, OFF-WHITE, CASABLANCA, KSUBI, RHUDE, VALE, HELLSTAR, ESSENTIALS";
const SIGNAGE =
  `Any shopfront or hoarding signage may only read from this list: ${HOUSES}, or ` +
  "DESIGNER DISTRICT. Everything else blank. No other real fashion brand names.";
const FIDELITY =
  "Reproduce the garments exactly as shown in the reference photographs — same " +
  "colours, same cut, same printed graphics and lettering. Do not restyle or " +
  "substitute the clothing.";
const NO_TAGS =
  "The clothes are being worn, so they have no retail hang tags, no price tags " +
  "and no swing tickets attached anywhere.";

const SHOT = {
  full: "Full length, head to shoes, the complete outfit clearly visible, the " +
        "figure centred with headroom above and floor below, confident relaxed pose",
  waist: "Waist-up, three-quarter view, the garment and the headwear both clearly " +
         "in frame, hands in pockets, looking off camera",
  detail: "Close crop on the head and shoulders, the cap or beanie and the " +
          "shoulders of the top filling the frame, the street soft behind",
};

const CAST = {
  A: "a young man with tousled black hair",
  B: "a young woman with long dark box braids and hoop earrings",
  C: "a young woman with a short dark bob",
};

/* Everything below names a sub-category or a set key, never a product name. */
const SET = [
  {
    tag: "chrome-hearts-beanie", slug: "chrome-hearts", aspect: "2:3", shot: "waist",
    who: CAST.A, place: "street",
    parts: [bySub("chrome-hearts", "beanies"), byCat("chrome-hearts", "shirts")],
    wear: (p) => `the Chrome Hearts beanie from the reference photograph worn on the head, ` +
                 `with ${p[1] ? "the Chrome Hearts t-shirt from the reference photograph" : "a plain black t-shirt"}`,
  },
  {
    tag: "chrome-hearts-snapback", slug: "chrome-hearts", aspect: "21:9", shot: "detail",
    who: CAST.C, place: "hoarding",
    parts: [bySub("chrome-hearts", "snapbacks")],
    wear: () => "the Chrome Hearts snapback cap from the reference photograph, worn forwards",
  },
  {
    tag: "supreme-track-blue", slug: "supreme", aspect: "2:3", shot: "full",
    who: CAST.B, place: "street",
    parts: set("supreme-ducati-blue"),
    wear: () => "the matching light blue Supreme Ducati track jacket and track pants " +
                "from the reference photographs, worn together as a set",
  },
  {
    tag: "supreme-track-red", slug: "supreme", aspect: "16:9", shot: "waist",
    who: CAST.A, place: "crown",
    parts: set("supreme-ducati-white-red"),
    wear: () => "the matching cream and red Supreme Ducati track jacket and track " +
                "pants from the reference photographs, worn together as a set",
  },
  {
    tag: "essentials-tower", slug: "essentials", aspect: "2:3", shot: "full",
    who: CAST.C, place: "doorway",
    parts: [byCat("essentials", "hoodies"), byCat("essentials", "bottoms")],
    wear: () => "the Essentials hoodie with the Essentials bottoms from the reference photographs",
  },
];

const manifest = [];
const jobs = [];

for (const item of SET) {
  const parts = item.parts.filter(Boolean);
  if (!parts.length) { console.log(`! ${item.tag}: nothing in stock for it`); continue; }
  const refs = parts.map((p) => p.image).filter((u) => /^https?:/.test(u)).map(refUrl);

  const prompt =
    `${STYLE} ${SHOT[item.shot]}. ${item.who} wearing ${item.wear(item.parts)}, ` +
    `in ${PLACES[item.place]}. ${FIDELITY} ${NO_TAGS} ${SIGNAGE} ` +
    `Render the entire image as hand-painted 2D anime cel animation. It must not ` +
    `look like a photograph or a 3D render — painted backgrounds, visible ` +
    `linework, flat cel shading.`;

  manifest.push({
    tag: item.tag, slug: item.slug, aspect: item.aspect,
    productIds: parts.map((p) => p.id),
    chose: parts.map((p) => `${p.sub || p.cat}:${p.name}`),
  });

  if (fs.existsSync(`${OUT}/${item.tag}.png`)) { console.log(`${item.tag.padEnd(24)} have it`); continue; }

  const r = await call("/marketing-studio/image", {
    method: "POST",
    body: JSON.stringify({ prompt, resolution: "1k", aspect_ratio: item.aspect, image_urls: refs }),
  });
  let id = null;
  try { id = JSON.parse(r.body).request_id; } catch { /* below */ }
  console.log(
    `${item.tag.padEnd(24)} ${item.aspect.padEnd(6)} refs:${refs.length} ` +
    `${id ? "sent" : r.status + " " + scrub(r.body).slice(0, 140)}`,
  );
  if (id) jobs.push({ id, ...item });
}

fs.writeFileSync(`${OUT}/manifest.json`, JSON.stringify(manifest, null, 1));
console.log("\nwhat it chose, from the new columns:");
for (const m of manifest) console.log(`  ${m.tag.padEnd(24)} ${m.chose.join("  +  ")}`);

console.log(`\nwaiting on ${jobs.length}…`);
const pending = new Map(jobs.map((j) => [j.id, j]));
for (let t = 0; t < 150 && pending.size; t++) {
  await new Promise((r) => setTimeout(r, 5000));
  for (const [id, job] of [...pending]) {
    const s = await call(`/requests/${id}/status`);
    let j; try { j = JSON.parse(s.body); } catch { continue; }
    if (!["completed", "failed", "nsfw", "canceled"].includes(j.status)) continue;
    pending.delete(id);
    const url = j.images?.[0]?.url;
    if (j.status === "completed" && url) {
      fs.writeFileSync(`${OUT}/${job.tag}.png`, Buffer.from(await (await fetch(url)).arrayBuffer()));
      console.log(`  ${job.tag.padEnd(24)} ok`);
    } else {
      console.log(`  ${job.tag.padEnd(24)} ${j.status} ${scrub(j.error || "")}`.slice(0, 150));
    }
  }
}
if (pending.size) console.log("  still running:", [...pending.values()].map((j) => j.tag).join(", "));
