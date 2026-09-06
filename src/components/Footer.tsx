import Link from "next/link";

const columns = [
  {
    title: "Shop",
    links: [
      { label: "All Brands", href: "/brands" },
      { label: "New Arrivals", href: "/search?sort=new" },
      { label: "Search", href: "/search" },
    ],
  },
  {
    title: "Account",
    links: [
      { label: "Settings", href: "/account" },
      { label: "Orders", href: "/account/orders" },
      { label: "Support", href: "/account/tickets" },
    ],
  },
  {
    title: "Help",
    links: [
      { label: "Returns & Refunds", href: "/account/tickets?kind=return" },
      { label: "File a Complaint", href: "/account/tickets?kind=complaint" },
      { label: "Store Credit", href: "/account" },
    ],
  },
];

export default function Footer() {
  return (
    <footer className="border-t border-rule mt-24">
      <div className="mx-auto max-w-7xl px-5 sm:px-8 py-14">
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/brand/designer-district.png"
              alt="Designer District"
              width={800}
              height={618}
              loading="lazy"
              className="h-24 w-auto"
            />
          </div>

          {columns.map((col) => (
            <nav key={col.title} aria-label={col.title}>
              <p className="eyebrow">{col.title}</p>
              <ul className="mt-4 space-y-2.5">
                {col.links.map((link) => (
                  <li key={link.label}>
                    <Link
                      href={link.href}
                      className="text-sm text-ink-dim hover:text-ink transition-colors"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>

        <div className="mt-12 pt-6 border-t border-rule flex flex-col sm:flex-row gap-2 sm:items-center sm:justify-between">
          <p className="text-xs text-ink-faint">
            © {new Date().getFullYear()} Designer District. All rights reserved.
          </p>
          <p className="text-xs text-ink-faint font-mono">
            Brand names are trademarks of their respective owners.
          </p>
        </div>
      </div>
    </footer>
  );
}
