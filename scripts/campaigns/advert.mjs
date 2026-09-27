/* The ten-second advert for the crown screen.
 *
 * Image to video, not text to video, so the three people in it are the three
 * people the district's campaign already uses. Text to video would invent a
 * new cast every run, which is the opposite of what an advert wants.
 *
 * The seed frame has to be at a URL the model can fetch, and there is no
 * public copy of the group shot: the artwork lives in the repo under
 * public/campaigns and the site is not deployed, and the storage buckets
 * only accept writes from a signed-in staff account. So the frame is
 * generated first through the image API, whose own output URLs are public
 * for seven days, and that URL is handed straight to the video model. One
 * extra image generation, no hosting.
 *
 *   node scripts/campaigns/advert.mjs           make it
 *   node scripts/campaigns/advert.mjs --dry      print the plan, spend nothing
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

/** Polls one request to a terminal state. */
async function settle(id, label, tries = 180) {
  for (let t = 0; t < tries; t++) {
    await new Promise((r) => setTimeout(r, 5000));
    const s = await call(`/requests/${id}/status`);
    let j; try { j = JSON.parse(s.body); } catch { continue; }
    if (!["completed", "failed", "nsfw", "canceled"].includes(j.status)) {
      if (t % 6 === 5) console.log(`   ${label}: ${j.status}…`);
      continue;
    }
    return j;
  }
  return { status: "timeout" };
}

const refUrl = (u) =>
  /\.avif($|\?)/i.test(u)
    ? u.replace("/storage/v1/object/public/", "/storage/v1/render/image/public/") + "?width=1024&quality=90"
    : u;

const cat = await (await fetch(process.env.DD_API || "http://localhost:3200/api/storefront")).json();
if (!cat.ok) throw new Error("storefront not answering");
const live = (slug) => (cat.brands[slug] || []).filter((p) => p.image && (p.stock ?? 0) > 0);
const byCat = (slug, c, n = 0) => live(slug).filter((p) => p.cat === c)[n];
const bySub = (slug, sub, n = 0) => live(slug).filter((p) => p.sub === sub)[n];

/* ── the cast and what they are wearing, from stock ─────────────────── */
const SLOTS = {
  "his shirt":   byCat("chrome-hearts", "shirts"),
  "his jeans":   byCat("amiri", "denim"),
  "his cap":     bySub("chrome-hearts", "snapbacks"),
  "her tee":     byCat("off-white", "shirts"),
  "her jeans":   byCat("purple-brand", "denim"),
  "her2 tee":    byCat("supreme", "shirts"),
  "her2 shorts": byCat("vale", "bottoms"),
};

console.log("BILL OF ITEMS");
for (const [slot, p] of Object.entries(SLOTS)) {
  console.log(`  ${slot.padEnd(12)} ${p ? `${(p.sub || p.cat).padEnd(11)} ${p.name}` : "NOTHING IN STOCK"}`);
}
const parts = Object.values(SLOTS).filter(Boolean);
if (parts.length < 5) throw new Error("not enough of the look is in stock to advertise it");

const CAST_M = "a young man with tousled black hair, relaxed confident posture";
const CAST_W1 =
  "a strikingly feminine young woman with long dark box braids swept over one " +
  "shoulder, gold hoop earrings, soft makeup, slender build, elegant graceful posture";
const CAST_W2 =
  "a strikingly feminine young woman with a glossy dark bob tucked behind one ear, " +
  "small gold studs, soft natural makeup, delicate features, poised graceful stance";

const FRAME_PROMPT =
  "Anime film still, hand-painted cel animation, 2000s Japanese animated feature " +
  "aesthetic. Painterly background art, soft rim light, gentle film grain, rich " +
  "saturated colour, clean linework. Not a photograph, not 3D. " +
  "The three of them together, full length, side by side and slightly staggered, " +
  "all clearly in frame with headroom above and paving below, walking toward " +
  `camera. ${CAST_M}; and ${CAST_W1}; and ${CAST_W2}. ` +
  `The man wears the ${SLOTS["his shirt"]?.name} with the ${SLOTS["his jeans"]?.name}` +
  `${SLOTS["his cap"] ? ` and the ${SLOTS["his cap"].name}` : ""}. ` +
  `The first woman wears the ${SLOTS["her tee"]?.name} with the ${SLOTS["her jeans"]?.name}. ` +
  `The second woman wears the ${SLOTS["her2 tee"]?.name} with the ${SLOTS["her2 shorts"]?.name}. ` +
  "They are in the paved plaza that closes a sunlit designer district: three " +
  "enormous LED screens side by side above a pale diamond-lattice wall, coconut " +
  "palms either side, pale travertine paving, and a Miami seafront skyline of " +
  "white and mint towers behind. " +
  "Reproduce every garment exactly as shown in its reference photograph — same " +
  "colour, same cut, same printed graphics. The clothes are worn, so no hang " +
  "tags anywhere. Signage may only read BAPE, CHROME HEARTS, SUPREME, AMIRI, " +
  "BALENCIAGA, GALLERY DEPT, GODSPEED, PURPLE BRAND, OFF-WHITE, CASABLANCA, " +
  "KSUBI, RHUDE, VALE, HELLSTAR, ESSENTIALS or DESIGNER DISTRICT. " +
  "Render the entire image as hand-painted 2D anime cel animation.";

/* The motion. Deliberately small.
 *
 * This plays on a screen inside a 3D scene that the visitor is already
 * moving through, at a few hundred pixels across. Anything energetic reads
 * as noise at that size; a slow walk and some moving palms read as a screen
 * that is alive. */
const VIDEO_PROMPT =
  "The three of them walk slowly toward camera together, relaxed and in step, " +
  "hair and clothing moving gently. Palm fronds sway in the breeze behind them. " +
  "The big LED screens behind flicker softly. Slow, steady push-in. " +
  "Hand-painted 2D anime cel animation throughout, consistent character designs, " +
  "no morphing, no extra people entering the frame.";

if (process.argv.includes("--dry")) {
  console.log("\nframe prompt:\n" + FRAME_PROMPT + "\n\nvideo prompt:\n" + VIDEO_PROMPT);
  process.exit(0);
}

/* ── 1. the seed frame, whose output URL is public ──────────────────── */
console.log("\n1/2  the opening frame (billable)…");
const refs = parts.map((p) => refUrl(p.image));
const shot = await call("/marketing-studio/image", {
  method: "POST",
  body: JSON.stringify({
    prompt: FRAME_PROMPT, resolution: "1k", aspect_ratio: "21:9", image_urls: refs,
  }),
});
let frameId = null;
try { frameId = JSON.parse(shot.body).request_id; } catch { /* below */ }
if (!frameId) throw new Error(`frame submit failed ${shot.status}: ${scrub(shot.body).slice(0, 200)}`);

const frame = await settle(frameId, "frame");
const seedUrl = frame.images?.[0]?.url;
if (frame.status !== "completed" || !seedUrl) {
  throw new Error(`frame ${frame.status}: ${scrub(frame.error || "")}`);
}
fs.writeFileSync(`${OUT}advert-frame.png`, Buffer.from(await (await fetch(seedUrl)).arrayBuffer()));
console.log("     frame ok, and its URL is what seeds the video");

/* ── 2. ten seconds of it ───────────────────────────────────────────── */
console.log("2/2  ten seconds of video (billable)…");
const vid = await call("/bytedance/seedance-2.5/image-to-video", {
  method: "POST",
  body: JSON.stringify({
    image_url: seedUrl,
    prompt: VIDEO_PROMPT,
    duration: 10,
    resolution: "720p",
    output_format: "mp4",
    // Silent. It plays on a hoarding inside a scene that has its own
    // ambience, and a video texture's element is muted anyway.
    generate_audio: false,
  }),
});
let vidId = null;
try { vidId = JSON.parse(vid.body).request_id; } catch { /* below */ }
if (!vidId) throw new Error(`video submit failed ${vid.status}: ${scrub(vid.body).slice(0, 300)}`);

const done = await settle(vidId, "video");
const url = done.videos?.[0]?.url || done.video?.url || done.images?.[0]?.url;
if (done.status !== "completed" || !url) {
  console.log(scrub(JSON.stringify(done, null, 1)).slice(0, 700));
  throw new Error(`video ${done.status}`);
}

const buf = Buffer.from(await (await fetch(url)).arrayBuffer());
fs.writeFileSync(`${OUT}crown-advert.mp4`, buf);
console.log(`\ndone — ${(buf.length / 1024 / 1024).toFixed(2)} MB at ${OUT}crown-advert.mp4`);
