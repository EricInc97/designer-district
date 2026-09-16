import Link from "next/link";

/**
 * Minimal footer: the mark, one inline row of links, and the fine print.
 * Everything sits on a line and wraps, rather than stacking into columns,
 * so it stays short on a phone.
 */
const links = [
  { label: "All Brands", href: "/brands" },
  { label: "New Arrivals", href: "/search?arrivals=1" },
  { label: "Settings", href: "/account" },
  { label: "Orders", href: "/account/orders" },
  { label: "Support", href: "/account/tickets" },
];

export default function Footer() {
  // Positioned and opaque: the homepage runs a fixed photograph behind the
  // whole page, and a static footer would be painted underneath a fixed layer.
  // The paper ground also means the page still ends on something solid.
  return (
    <footer className="relative z-10 border-t border-rule bg-paper mt-24">
      <div className="mx-auto max-w-7xl px-5 sm:px-8 py-8">
        <div className="flex flex-wrap items-center gap-x-6 gap-y-4">
          {/* The full lockup as drawn: dome above, wordmark stacked under it.
              Sized so those two lines of type stay legible rather than
              collapsing into a smudge. */}
          <Link href="/" aria-label="Designer District, home" className="shrink-0">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/brand/designer-district.png"
              alt="Designer District"
              width={800}
              height={618}
              loading="lazy"
              className="h-20 w-auto sm:h-24"
            />
          </Link>

          <nav aria-label="Footer">
            <ul className="flex flex-wrap items-center gap-x-5 gap-y-2">
              {links.map((link) => (
                <li key={link.label}>
                  <Link
                    href={link.href}
                    className="text-sm text-ink-dim transition-colors hover:text-ink"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        </div>

        <div className="mt-6 flex flex-wrap items-center justify-between gap-x-6 gap-y-1 border-t border-rule pt-4">
          <p className="text-xs text-ink-faint">
            © {new Date().getFullYear()} Designer District. All rights reserved.
          </p>
          <p className="text-xs text-ink-faint">
            Brand names are trademarks of their respective owners.
          </p>
        </div>

        {/* Required by the licence on the homepage photograph, not optional
            decoration: CC BY asks for the author, a link to the licence, and a
            note that the work was changed. */}
        <p className="mt-3 text-[11px] leading-relaxed text-ink-faint">
          Fly&rsquo;s Eye Dome photograph by{" "}
          <a
            href="https://commons.wikimedia.org/wiki/File:Buckminster_Fuller_Dome_Miami_Design_District.jpg"
            target="_blank"
            rel="noreferrer"
            className="underline underline-offset-2 transition-colors hover:text-ink"
          >
            Phillip Pessar
          </a>
          , licensed under{" "}
          <a
            href="https://creativecommons.org/licenses/by/2.0/"
            target="_blank"
            rel="noreferrer"
            className="underline underline-offset-2 transition-colors hover:text-ink"
          >
            CC BY 2.0
          </a>
          . Cropped and colour-adjusted.
        </p>
      </div>
    </footer>
  );
}
