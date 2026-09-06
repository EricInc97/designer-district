"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export default function AdminNav({
  links,
}: {
  links: { href: string; label: string }[];
}) {
  const pathname = usePathname();

  return (
    <nav aria-label="Admin sections" className="mt-6 border-b border-rule">
      <ul className="-mb-px flex gap-1 overflow-x-auto scroll-thin">
        {links.map((link) => {
          const active =
            link.href === "/admin"
              ? pathname === "/admin"
              : pathname.startsWith(link.href);

          return (
            <li key={link.href}>
              <Link
                href={link.href}
                aria-current={active ? "page" : undefined}
                className={`inline-block whitespace-nowrap border-b-2 px-4 py-3 text-xs uppercase tracking-[0.18em] transition-colors ${
                  active
                    ? "border-ink text-ink"
                    : "border-transparent text-ink-faint hover:text-ink"
                }`}
              >
                {link.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
