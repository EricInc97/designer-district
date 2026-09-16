import Link from "next/link";

/**
 * Minimal footer: the mark, one inline row of links, and the fine print.
 * Everything sits on a line and wraps, rather than stacking into columns,
 * so it stays short on a phone.
 *
 * Deliberately shallow. It is the end of the page, not a second navigation,
 * and it was eating a screen and a half on a phone: the mark is now a third
 * of the height it was and the fine print shares a single row with it.
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
    <footer className="relative z-10 border-t border-rule bg-paper mt-16">
      <div className="mx-auto max-w-7xl px-5 sm:px-8 py-5">
        <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
          {/* The full lockup as drawn: dome above, wordmark stacked under
              it, small. */}
          <Link href="/" aria-label="Designer District, home" className="shrink-0">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/brand/designer-district.png"
              alt="Designer District"
              width={800}
              height={618}
              loading="lazy"
              className="h-12 w-auto sm:h-14"
            />
          </Link>

          <nav aria-label="Footer">
            <ul className="flex flex-wrap items-center gap-x-5 gap-y-1.5">
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

        <div className="mt-4 flex flex-wrap items-center justify-between gap-x-6 gap-y-1 border-t border-rule pt-3">
          <p className="text-xs text-ink-faint">
            © {new Date().getFullYear()} Designer District. All rights reserved.
          </p>
          <p className="text-xs text-ink-faint">
            Brand names are trademarks of their respective owners.
          </p>
        </div>

      </div>
    </footer>
  );
}
