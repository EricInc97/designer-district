/**
 * Deterministic SVG placeholder generator.
 *
 * Real product photography and brand logos are licensed assets, so the seeded
 * catalog points here instead of hotlinking anyone's imagery. Swap the
 * `image_url` / `logo_url` columns for your own CDN paths and this route
 * simply stops being called.
 *
 *   /ph/shark-full-zip-hoodie          -> product tile
 *   /ph/Bape?kind=logo                 -> brand wordmark
 */

function hash(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h);
}

const readable = (raw: string) =>
  decodeURIComponent(raw)
    .replace(/-/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase();

const esc = (s: string) =>
  s.replace(/[<>&"']/g, (c) =>
    ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;", "'": "&apos;" })[c]!,
  );

function logoSvg(text: string) {
  const label = esc(text);
  // Long wordmarks get tighter tracking so they never overflow the box.
  const size = label.length > 12 ? 46 : label.length > 8 ? 58 : 72;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 300" width="600" height="300" role="img" aria-label="${label}">
  <rect width="600" height="300" fill="#f7f6f3"/>
  <text x="300" y="158" text-anchor="middle" fill="#0b0b0b"
        font-family="Helvetica Neue, Helvetica, Arial, sans-serif"
        font-size="${size}" font-weight="700" letter-spacing="${size > 50 ? 4 : 2}">${label}</text>
  <line x1="220" y1="196" x2="380" y2="196" stroke="#c6c3bb" stroke-width="2"/>
</svg>`;
}

function productSvg(text: string, seed: number) {
  const label = esc(text);
  const initials = label
    .split(" ")
    .filter((w) => /^[A-Z0-9]/.test(w))
    .slice(0, 2)
    .map((w) => w[0])
    .join("");

  const angle = (seed % 4) * 45;
  const shade = ["#efede8", "#e9e6e0", "#f2f0eb", "#e5e2db"][seed % 4];
  const lines = Array.from({ length: 9 }, (_, i) => {
    const y = 40 + i * 90;
    return `<line x1="-200" y1="${y}" x2="1000" y2="${y}" stroke="#d9d6cf" stroke-width="1"/>`;
  }).join("");

  // Deliberately mid-grey, not near-white: at thumbnail size a placeholder has
  // to read as "an image goes here", not as an empty box.
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 1000" width="800" height="1000" role="img" aria-label="${label}">
  <rect width="800" height="1000" fill="${shade}"/>
  <g transform="rotate(${angle} 400 500)" opacity="0.9">${lines}</g>
  <circle cx="400" cy="430" r="180" fill="none" stroke="#b6b2a9" stroke-width="2"/>
  <text x="400" y="478" text-anchor="middle" fill="#a5a199"
        font-family="Helvetica Neue, Helvetica, Arial, sans-serif"
        font-size="150" font-weight="700" letter-spacing="6">${esc(initials)}</text>
  <text x="400" y="770" text-anchor="middle" fill="#8b877e"
        font-family="Helvetica Neue, Helvetica, Arial, sans-serif"
        font-size="26" font-weight="500" letter-spacing="7">${label}</text>
</svg>`;
}

export async function GET(
  request: Request,
  context: { params: Promise<{ label: string }> },
) {
  const { label } = await context.params;
  const kind = new URL(request.url).searchParams.get("kind");
  const text = readable(label).slice(0, 48) || "DESIGNER DISTRICT";

  const svg = kind === "logo" ? logoSvg(text) : productSvg(text, hash(text));

  return new Response(svg, {
    headers: {
      "Content-Type": "image/svg+xml",
      // Not immutable: these are generated from the theme, so a palette change
      // has to be able to reach browsers that already cached the old colourway.
      "Cache-Control": "public, max-age=3600, stale-while-revalidate=86400",
    },
  });
}
