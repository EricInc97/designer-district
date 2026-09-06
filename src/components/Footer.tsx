import Link from "next/link";

/**
 * Minimal footer: the mark, one inline row of links, and the fine print.
 * Everything sits on a line and wraps, rather than stacking into columns,
 * so it stays short on a phone.
 */
const links = [
  { label: "All Brands", href: "/brands" },
  { label: "New Arrivals", href: "/search?sort=new" },
  { label: "Settings", href: "/account" },
  { label: "Orders", href: "/account/orders" },
  { label: "Support", href: "/account/tickets" },
];

export default function Footer() {
  return (
    <footer className="border-t border-rule mt-24">
      <div className="mx-auto max-w-7xl px-5 sm:px-8 py-8">
        <div className="flex flex-wrap items-center gap-x-6 gap-y-4">
          <Link href="/" aria-label="Designer District, home" className="shrink-0">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/brand/designer-district-mark.png"
              alt=""
              width={640}
              height={314}
              loading="lazy"
              className="h-8 w-auto"
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
      </div>
    </footer>
  );
}
