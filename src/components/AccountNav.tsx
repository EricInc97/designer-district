"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const tabs = [
  { href: "/account", label: "Settings" },
  { href: "/account/orders", label: "Orders" },
  { href: "/account/tickets", label: "Support" },
];

export default function AccountNav() {
  const pathname = usePathname();

  return (
    <nav aria-label="Account sections" className="mt-6 border-b border-rule">
      <ul className="-mb-px flex gap-1 overflow-x-auto scroll-thin">
        {tabs.map((tab) => {
          const active =
            tab.href === "/account"
              ? pathname === "/account"
              : pathname.startsWith(tab.href);

          return (
            <li key={tab.href}>
              <Link
                href={tab.href}
                aria-current={active ? "page" : undefined}
                className={`inline-block whitespace-nowrap border-b-2 px-4 py-3 text-xs uppercase tracking-[0.18em] transition-colors ${
                  active
                    ? "border-ink text-ink"
                    : "border-transparent text-ink-faint hover:text-ink"
                }`}
              >
                {tab.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
