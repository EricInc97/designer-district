/* Put the generated artwork on the boards.
 *
 * Three steps, and the third is the one that matters: the picture is not a
 * campaign until the board knows which garments are in it, because that is
 * what the shop-the-look panel lists and links to.
 *
 *   1. PNG -> WebP into public/campaigns (the boards fetch /campaigns/...)
 *   2. a brand_media row per picture, kind 'board', with the aspect it was
 *      composed for, so each hoarding can pick the shape that suits it
 *   3. product_ids from the manifest the generator wrote, which records the
 *      reference photographs each prompt was actually built from
 *
 *   node ingest.mjs           write the files and print the SQL
 *   node ingest.mjs --files   only convert, no SQL
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
// Resolved from the project, which is where sharp is installed; this
// script lives in a scratch directory with no node_modules of its own.
import { createRequire } from "node:module";
const sharp = createRequire(new URL("../../package.json", import.meta.url))("sharp");

const HERE = fileURLToPath(new URL("../../.campaigns-out/", import.meta.url));
// Which batch to install; defaults to the second pass.
const SRC = HERE;
const DEST = fileURLToPath(new URL("../../public/campaigns/", import.meta.url));

const manifest = JSON.parse(fs.readFileSync(path.join(SRC, "manifest.json"), "utf8"));

/* Copy per picture, where a picture has earned its own.
 *
 * The house headline was fine while every look was head to toe in one
 * label. It is not fine for a cross-house look: an Off-White tee worn with
 * Purple Brand jeans is not "Off-White", it is the two of them together,
 * and the line on the board should say so. Anything not listed here falls
 * back to the house copy below. */
const PER_PICTURE = {
  "crown-group":        ["Everything, in one place", "Fifteen districts, one address."],
  "off-white-purple":   ["Off-White x Purple Brand", "The tee and the jeans."],
  "chrome-amiri":       ["Chrome Hearts x Amiri", "Gothic type, LA denim."],
  "supreme-ksubi-her":  ["Supreme x Ksubi", "Box logo, Australian denim."],
  "casablanca-vale":    ["Casablanca x Vale", "Riviera silk, valley denim."],
  "hellstar-balenciaga":["Hellstar x Balenciaga", "Drip graphic, Paris cut."],
  "gallery-dept-back":  ["Gallery Dept.", "Read it from behind."],
  "supreme-track-her":  ["Supreme x Ducati", "The track set, in blue."],
  "supreme-ducati-three":["Supreme x Ducati", "Three colourways, head to toe."],
};

/* Editorial copy. It lives here rather than in the generator because it is
 * what the board says, not what the picture is of. Kept short: a hoarding is
 * read at an angle from thirty metres, and anything longer than about four
 * words is a paragraph nobody finishes. */
const HEAD = {
  bape: "A Bathing Ape",
  amiri: "Amiri, head to toe",
  balenciaga: "Balenciaga",
  "gallery-dept": "Gallery Dept.",
  godspeed: "God Speed",
  "off-white": "Off-White",
  casablanca: "Casablanca",
  ksubi: "Ksubi denim",
  "purple-brand": "Purple Brand",
  essentials: "Essentials",
  supreme: "Supreme x Ducati",
  "chrome-hearts": "Chrome Hearts",
  district: "Designer District",
};
const SUB = {
  bape: "Camo, since 1993.",
  amiri: "Los Angeles tailoring.",
  balenciaga: "Paris, exaggerated.",
  "gallery-dept": "Painted and repaired.",
  godspeed: "Snapbacks and graphics.",
  "off-white": "Quotation marks.",
  casablanca: "Riviera, all year.",
  ksubi: "Australian denim.",
  "purple-brand": "Denim, obsessively.",
  essentials: "The quiet layer.",
  supreme: "The box logo.",
  "chrome-hearts": "Sterling, leather, gothic type.",
};

const q = (v) => (v === null || v === undefined ? "null" : `'${String(v).replace(/'/g, "''")}'`);

let made = 0;
const rows = [];

for (const [i, item] of manifest.entries()) {
  const png = path.join(SRC, `${item.tag}.png`);
  if (!fs.existsSync(png)) { console.log(`- ${item.tag}: not generated yet, skipping`); continue; }

  const webp = path.join(DEST, `${item.tag}.webp`);
  /* Quality 82 rather than lossless. These are painted images with large
   * flat areas, they are drawn onto a canvas and then onto an emissive
   * panel fifteen metres up, and the whole set has to come down a phone
   * connection before the street can advertise anything. */
  const info = await sharp(png).webp({ quality: 82 }).toFile(webp);
  made++;
  console.log(
    `+ ${item.tag.padEnd(22)} ${String(info.width).padStart(4)}x${String(info.height).padEnd(4)} ` +
    `${(info.size / 1024).toFixed(0).padStart(4)}kB  ${item.productIds.length} product(s)`,
  );

  if (process.argv.includes("--files")) continue;

  const [head, sub] = PER_PICTURE[item.tag] || [HEAD[item.slug] || item.slug, SUB[item.slug] || null];
  rows.push(
    `  (${q(item.slug)}, ${q("/campaigns/" + item.tag + ".webp")}, ` +
    `${q(head)}, ${q(sub)}, ` +
    `${q(item.aspect)}, ${10 + i % 5 * 10}, ` +
    `ARRAY[${item.productIds.map((p) => `${q(p)}::uuid`).join(",")}]::uuid[])`,
  );
}

console.log(`\n${made} file(s) written to ${DEST}`);

if (rows.length) {
  const sql = `
-- Board artwork, second pass.
--
-- Delete-then-insert rather than ON CONFLICT, because there is no unique
-- constraint on (brand_id, image_url) to conflict against: an ON CONFLICT
-- DO NOTHING here would never fire, and a second run would hang a duplicate
-- of every picture on the street.
begin;
with incoming (slug, image_url, headline, subhead, aspect, sort_order, product_ids) as (
  values
${rows.join(",\n")}
),
resolved as (
  select b.id as brand_id, i.*
    from incoming i
    join brands b on b.slug = i.slug
),
cleared as (
  delete from brand_media bm
   using resolved r
   where bm.brand_id = r.brand_id
     and bm.kind = 'board'
     and bm.image_url = r.image_url
  returning 1
)
insert into brand_media
  (brand_id, kind, image_url, headline, subhead, cta_label, ink, aspect, sort_order, product_ids, is_published)
select brand_id, 'board', image_url, headline, subhead, 'Shop the look', 'light',
       aspect, sort_order, product_ids, true
  from resolved;

commit;
`;
  fs.writeFileSync(path.join(HERE, "ingest.sql"), sql);
  console.log(`SQL for ${rows.length} row(s) -> ${path.join(HERE, "ingest.sql")}`);
}
