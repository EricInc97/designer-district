/* Write the missing product descriptions.
 *
 * Every published product had an empty description. Two hundred and
 * thirty-six of them, and nobody is going to type that.
 *
 * The rule here is that a description only ever says things that can be
 * checked:
 *
 *   colour      measured off the photograph, not guessed from the name
 *   garment     from the sub-category, or the category if it is not filed
 *   house       from the brand row
 *   collab      parsed out of the product name, and only when the name
 *               actually contains one
 *   set         from set_key, when the piece has a matching half
 *
 * Nothing about fabric, fit, season or provenance, because none of that is
 * recorded anywhere and a description that invents it is worse than no
 * description at all — it goes on a product page as if it were true.
 *
 *   node scripts/describe-products.mjs            print what it would write
 *   node scripts/describe-products.mjs --write    write the SQL out
 */
import fs from "node:fs";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const sharp = createRequire(new URL("../package.json", import.meta.url))("sharp");
const API = process.env.DD_API || "http://localhost:3200/api/storefront";

/* ── colour ──────────────────────────────────────────────────────────────
 * Product shots are cut out on white, so the trick is telling a white
 * garment from the paper behind it. The border is sampled to learn what the
 * background is; the middle is sampled for everything that is not that. If
 * nothing in the middle differs, the garment really is the same colour as
 * the paper, and white is the right answer.
 */
async function colourOf(url) {
  const buf = Buffer.from(await (await fetch(url)).arrayBuffer());
  const W = 96, H = 96;
  const { data } = await sharp(buf)
    .resize(W, H, { fit: "cover" })
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const at = (x, y) => {
    const i = (y * W + x) * 3;
    return [data[i], data[i + 1], data[i + 2]];
  };

  // What the paper is: the median of the four edges.
  const edge = [];
  for (let i = 0; i < W; i++) { edge.push(at(i, 0), at(i, H - 1), at(0, i), at(W - 1, i)); }
  const med = (xs) => xs.slice().sort((a, b) => a - b)[Math.floor(xs.length / 2)];
  const bg = [0, 1, 2].map((c) => med(edge.map((p) => p[c])));

  // Everything in the middle that is not the paper.
  const keptPx = [];
  let total = 0;
  for (let y = Math.round(H * 0.18); y < H * 0.86; y++) {
    for (let x = Math.round(W * 0.18); x < W * 0.86; x++) {
      total++;
      const px = at(x, y);
      const d = Math.abs(px[0] - bg[0]) + Math.abs(px[1] - bg[1]) + Math.abs(px[2] - bg[2]);
      if (d < 42) continue;                       // that is the paper
      keptPx.push(px);
    }
  }

  /* A pale garment on pale paper leaves almost nothing behind.
   *
   * This is the case that made a t-shirt the shop calls "white" come back
   * blue: the body of the shirt is within a few levels of the paper, so it
   * was all discarded, and the only thing left in the middle was the
   * printed graphic — which then won by default. If most of the middle
   * looks like the paper, the garment IS the colour of the paper. */
  if (keptPx.length < total * 0.22) return { rgb: bg, pale: true };

  /* Median, not the commonest bin. A big chest print can easily be the
   * commonest single colour on a plain tee; the median is the fabric,
   * because the fabric is most of what is left. */
  const mid = [0, 1, 2].map((c) => med(keptPx.map((q) => q[c])));
  return { rgb: mid, pale: false };
}

/**
 * A word for an RGB triple. A short, safe vocabulary on purpose.
 *
 * Neutrality is decided on the raw channel spread, not on HSL saturation.
 * The saturation formula divides by (1 - |2L - 1|), which goes to zero at
 * both ends of the lightness range, so a near-white with fourteen levels
 * between its channels computes a saturation of 0.27 and gets called blue.
 * That is exactly what happened to a white t-shirt. The spread does not
 * have that problem: fourteen levels apart is grey wherever it sits.
 */
function nameColour([r, g, b], cat) {
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
  const spread = mx - mn;
  const l = (mx + mn) / 510;                 // 0..1

  /* Denim has its own vocabulary, and it is not a colour name.
   *
   * Photographed jeans are desaturated enough that the honest colour word
   * is "grey", which is not what anybody calls a pair of jeans. A wash is
   * what the trade says and what a shopper searches for, and lightness is
   * genuinely what a wash is. */
  if (cat === "denim") {
    if (l < 0.20) return "Black";
    if (l < 0.38) return "Dark wash";
    if (l < 0.62) return "Mid wash";
    return "Light wash";
  }

  if (spread < 26) {
    if (l > 0.80) return "White";
    if (l > 0.66) return "Off-white";
    if (l > 0.44) return "Grey";
    if (l > 0.22) return "Charcoal";
    return "Black";
  }
  // Very dark is black whatever hue the meter finds in it.
  if (l < 0.16) return "Black";

  const R = r / 255, G = g / 255, B = b / 255;
  const d = spread / 255;
  let h;
  if (mx === r) h = ((G - B) / d) % 6;
  else if (mx === g) h = (B - R) / d + 2;
  else h = (R - G) / d + 4;
  h = (h * 60 + 360) % 360;

  if (h < 15 || h >= 345) return l < 0.35 ? "Deep red" : "Red";
  if (h < 40)  return l < 0.4 ? "Brown" : (spread < 70 ? "Tan" : "Orange");
  if (h < 68)  return l < 0.4 ? "Olive" : "Yellow";
  if (h < 160) return l < 0.35 ? "Forest green" : "Green";
  if (h < 200) return "Teal";
  if (h < 255) return l < 0.35 ? "Navy" : "Blue";
  if (h < 290) return "Purple";
  return l < 0.4 ? "Plum" : "Pink";
}

/* ── collaborations ──────────────────────────────────────────────────────
 * Only from the name. "Chrome hearts X Mapplethorpe T-Shirt Black" is a
 * collaboration; "Chrome hearts T-shirt" is not, and no amount of wanting
 * one makes it so.
 */
function collabOf(name, house) {
  const m = name.match(/\s+[xX×]\s+([A-Za-z][\w'’.\-]*(?:\s+[A-Z][\w'’.\-]*)?)/);
  if (m) return m[1].replace(/\s+(t-?shirt|tee|hoodie|jacket|pants|shorts|socks|cap|beanie).*$/i, "").trim();
  // A few partners appear without an x in the name.
  for (const p of ["Ducati", "Mapplethorpe", "Matty Boy", "Pirelli"]) {
    if (new RegExp(`\\b${p}\\b`, "i").test(name) && !new RegExp(`\\b${p}\\b`, "i").test(house)) return p;
  }
  return null;
}

/** A noun for the thing itself. */
function garmentOf(p) {
  const SUB = {
    beanies: "beanie", snapbacks: "snapback cap", caps: "cap",
    "bucket-hats": "bucket hat", socks: "socks", underwear: "briefs",
    belts: "belt", bags: "bag", "track-tops": "track top",
    "track-pants": "track pants", shorts: "shorts", sweatpants: "sweatpants",
  };
  const CAT = {
    shirts: "shirt", hoodies: "hoodie", bottoms: "trousers", denim: "jeans",
    outerwear: "jacket", accessories: "accessory",
  };
  if (p.sub && SUB[p.sub]) return SUB[p.sub];
  // A name is allowed to override the category when it is more specific and
  // unambiguous — "Long sleeve" under shirts is worth keeping.
  if (/long ?sleeve/i.test(p.name)) return "long-sleeve shirt";
  if (/polo/i.test(p.name)) return "polo shirt";
  if (/t-?shirt|\btee\b/i.test(p.name)) return "t-shirt";
  if (/hoodie/i.test(p.name)) return "hoodie";
  if (/jean/i.test(p.name)) return "jeans";
  return CAT[p.cat] || "piece";
}

/* The shop's own word beats the meter.
 *
 * Several names carry the colour — "T-Shirt Black", "Long-Sleeve 'Red'" —
 * and where they do, that is what the shop calls it and what a customer
 * searched for. Measuring is for the ones that say nothing. */
/* Whole words only. Without the boundaries these match inside other words:
 * "red" is found in "shredded" and "tan" in "Mountain", and a product name
 * is exactly the sort of free text that has those in it. Off-white is
 * tested first, or every off-white thing comes out simply white. */
const NAMED = [
  ["Off-white", /\boff[- ]?white\b/i],
  ["Black", /\bblack\b/i], ["White", /\bwhite\b/i],
  ["Red", /\bred\b/i], ["Navy", /\bnavy\b/i], ["Blue", /\bblue\b/i],
  ["Green", /\bgreen\b/i], ["Olive", /\bolive\b/i], ["Grey", /\bgre[ya]\b/i],
  ["Pink", /\bpink\b/i], ["Purple", /\bpurple\b/i], ["Brown", /\bbrown\b/i],
  ["Cream", /\bcream\b/i], ["Tan", /\btan\b/i], ["Yellow", /\byellow\b/i],
  ["Charcoal", /\bcharcoal\b/i],
];
/** The colour the name states, if it states one. */
function namedColour(name, house) {
  /* Every word of the house name comes out first.
   *
   * Purple Brand sells a product called "Purple Jeans", and those jeans are
   * black: the word is the house, not the colour. Stripping only the full
   * house string missed it, because the name never says "Brand". Off-White
   * has the same problem in the other direction, where it would make every
   * shirt it sells off-white.
   *
   * Word by word, and by splitting rather than by a built pattern, so a
   * house with a dot in it (Gallery Dept.) cannot be read as a regex.
   */
  let bare = name;
  for (const word of house.split(/[^A-Za-z]+/)) {
    if (word.length < 3) continue;
    bare = bare.split(new RegExp("\\b" + word + "\\b", "ig")).join(" ");
  }
  for (const [word, re] of NAMED) if (re.test(bare)) return word;
  return null;
}

const cat = await (await fetch(API)).json();
if (!cat.ok) throw new Error("storefront not answering");

const all = [];
for (const [slug, items] of Object.entries(cat.brands)) all.push(...items.map((p) => ({ ...p, slug })));

// House names as the shop writes them.
const HOUSE = {
  "chrome-hearts": "Chrome Hearts", supreme: "Supreme", bape: "BAPE", amiri: "Amiri",
  balenciaga: "Balenciaga", "gallery-dept": "Gallery Dept.", godspeed: "God Speed",
  "purple-brand": "Purple Brand", "off-white": "Off-White", casablanca: "Casablanca",
  ksubi: "Ksubi", rhude: "Rhude", vale: "Vale", hellstar: "Hellstar", essentials: "Essentials",
};

const rows = [];
let n = 0;
for (const p of all) {
  const house = HOUSE[p.slug] || p.slug;
  let colour = namedColour(p.name, house);
  if (!colour) {
    try {
      const c = await colourOf(p.image);
      colour = c.pale ? "White" : nameColour(c.rgb, p.cat);
    } catch (e) {
      console.log(`  ! ${p.name}: ${e.message}`);
      continue;
    }
  }
  const garment = garmentOf(p);
  const collab = collabOf(p.name, house);

  /* No stutter.
   *
   * Off-White sells an off-white t-shirt, and "Off-white Off-White t-shirt"
   * is not a sentence. When the colour word is already in the house name,
   * the house name carries it and the adjective is dropped. */
  const stutters = house.toLowerCase().includes(colour.toLowerCase());
  const bits = [stutters ? `${house} ${garment}.` : `${colour} ${house} ${garment}.`];
  if (collab) bits.push(`A ${house} x ${collab} collaboration.`);
  if (p.setKey) bits.push("Sold as a matching set with its other half.");
  const text = bits.join(" ");

  rows.push({ id: p.id, text });
  if (++n <= 24) console.log(`${p.name.slice(0, 44).padEnd(46)} ${text}`);
}

console.log(`\n${rows.length} descriptions`);

if (process.argv.includes("--write")) {
  const q = (v) => `'${String(v).replace(/'/g, "''")}'`;
  const sql =
    "-- Product descriptions. Colour measured off each photograph; garment from\n" +
    "-- the sub-category; collaboration parsed from the name and only where the\n" +
    "-- name actually carries one. Nothing about fabric, fit or season, because\n" +
    "-- none of that is recorded and inventing it would read as fact.\n" +
    "update products p set description = v.descr\n  from (values\n" +
    rows.map((r) => `    (${q(r.id)}::uuid, ${q(r.text)})`).join(",\n") +
    "\n  ) as v(id, descr)\n where p.id = v.id and (p.description is null or btrim(p.description) = '');\n";
  const out = fileURLToPath(new URL("../.campaigns-out/descriptions.sql", import.meta.url));
  fs.mkdirSync(fileURLToPath(new URL("../.campaigns-out/", import.meta.url)), { recursive: true });
  fs.writeFileSync(out, sql);
  console.log(`SQL -> ${out}`);
}
