"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import {
  Menu,
  X,
  ChevronRight,
  ChevronLeft,
  LayoutGrid,
  User,
  Package,
  LifeBuoy,
} from "lucide-react";
import SearchBar from "@/components/SearchBar";
import BrandMark from "@/components/BrandMark";
import { styleFor } from "@/lib/brandStyles";
import type { Brand, Category } from "@/lib/types";

/** One brand row, monochrome at rest and in the house colourway on hover. */
function BrandRow({ brand }: { brand: Brand }) {
  const style = styleFor(brand.slug);

  return (
    <Link
      href={`/brands/${brand.slug}`}
      aria-label={`Shop ${brand.name}`}
      className="group relative flex h-16 items-center overflow-hidden rounded-lg px-4"
    >
      <span
        aria-hidden
        className="brand-hover-layer pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100"
        style={style.hover.style}
      />
      <span className="brand-rest-layer relative transition-opacity duration-200 group-hover:opacity-0">
        <BrandMark brand={brand} size="sm" decorative />
      </span>
      <span
        aria-hidden
        className="brand-hover-layer absolute inset-0 flex items-center px-4 opacity-0 transition-opacity duration-200 group-hover:opacity-100"
        style={style.hover.textStyle}
      >
        <BrandMark brand={brand} size="sm" decorative className="!text-current" />
      </span>
    </Link>
  );
}

/** A full-width row: either a link out, or a drill-down into a sub-panel. */
function Row({
  label,
  href,
  onClick,
  emphasis,
}: {
  label: string;
  href?: string;
  onClick?: () => void;
  emphasis?: boolean;
}) {
  const className =
    "flex w-full items-center justify-between border-b border-rule px-5 py-4 text-left text-[15px] text-ink transition-colors hover:bg-paper-raised";

  const inner = (
    <>
      <span className={emphasis ? "font-medium" : undefined}>{label}</span>
      {onClick && <ChevronRight size={16} className="text-ink-faint" aria-hidden />}
    </>
  );

  return onClick ? (
    <button type="button" onClick={onClick} className={className}>
      {inner}
    </button>
  ) : (
    <Link href={href!} className={className}>
      {inner}
    </Link>
  );
}

type Panel = "root" | "designers" | "categories";

/**
 * The site menu, in the drill-down pattern department stores use: a flat list
 * of rows, a chevron on the ones that open a sub-panel, and a back link to
 * return. Every destination is a real route, so nothing here is a dead end.
 */
export default function SiteMenu({
  brands,
  categories,
  isSignedIn,
  isStaff,
}: {
  brands: Brand[];
  categories: Category[];
  isSignedIn: boolean;
  isStaff: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [panel, setPanel] = useState<Panel>("root");

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open]);

  const close = () => {
    setOpen(false);
    // Back to the top level for the next open, once it has gone from view.
    setTimeout(() => setPanel("root"), 250);
  };

  const accountLinks = [
    { href: "/account", label: "Settings", icon: User },
    { href: "/account/orders", label: "Orders", icon: Package },
    { href: "/account/tickets", label: "Support", icon: LifeBuoy },
  ];

  const title =
    panel === "designers" ? "Designers" : panel === "categories" ? "Shop" : "Menu";

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Open menu"
        aria-expanded={open}
        className="grid h-10 w-10 place-items-center rounded-full text-paper/70 transition-colors hover:bg-white/10 hover:text-paper"
      >
        <Menu size={20} strokeWidth={1.75} aria-hidden />
      </button>

      {/* Portalled to <body>: this renders inside the header, which has a
          backdrop-filter, and that would otherwise contain the fixed overlay
          to the height of the header itself. */}
      {open &&
        createPortal(
          <div
            className="fixed inset-0 z-50"
            role="dialog"
            aria-modal="true"
            aria-label="Site menu"
          >
            <button
              type="button"
              onClick={close}
              aria-label="Close menu"
              className="absolute inset-0 bg-black/40 backdrop-blur-sm animate-fade-in"
            />

            <div
              onClick={(e) => {
                if ((e.target as HTMLElement).closest("a")) close();
              }}
              className="scroll-thin absolute left-0 top-0 flex h-full w-full max-w-sm flex-col overflow-y-auto border-r border-rule bg-paper animate-slide-in-left"
            >
              <header className="sticky top-0 z-10 flex items-center justify-between border-b border-rule bg-paper px-5 py-4">
                {panel === "root" ? (
                  <p className="eyebrow !text-ink">{title}</p>
                ) : (
                  <button
                    type="button"
                    onClick={() => setPanel("root")}
                    className="-ml-1 flex items-center gap-1.5 text-[13px] uppercase tracking-[0.16em] text-ink transition-colors hover:text-ink-dim"
                  >
                    <ChevronLeft size={16} aria-hidden />
                    {title}
                  </button>
                )}

                <button
                  type="button"
                  onClick={close}
                  aria-label="Close menu"
                  className="grid h-8 w-8 place-items-center rounded-full text-ink-dim transition-colors hover:bg-paper-sunken hover:text-ink"
                >
                  <X size={18} aria-hidden />
                </button>
              </header>

              <div className="flex-1">
                {panel === "root" && (
                  <nav aria-label="Main">
                    <Row label="New Arrivals" href="/search?arrivals=1" />
                    <Row label="Featured" href="/search?featured=1" />
                    <Row
                      label="Designers"
                      onClick={() => setPanel("designers")}
                      emphasis
                    />
                    <Row
                      label="Shop by Category"
                      onClick={() => setPanel("categories")}
                    />
                    <Row label="Sale" href="/search?sale=1" />

                    <div className="border-b border-rule p-5">
                      <p className="eyebrow mb-3">Search</p>
                      <SearchBar />
                    </div>
                  </nav>
                )}

                {panel === "designers" && (
                  <nav aria-label="Designers" className="p-4">
                    <ul className="space-y-1">
                      {brands.map((brand) => (
                        <li key={brand.id}>
                          <BrandRow brand={brand} />
                        </li>
                      ))}
                    </ul>
                    <Link
                      href="/brands"
                      className="mt-3 block px-4 py-2 text-[11px] uppercase tracking-[0.18em] text-ink-faint transition-colors hover:text-ink"
                    >
                      View all designers
                    </Link>
                  </nav>
                )}

                {panel === "categories" && (
                  <nav aria-label="Categories">
                    {categories.map((c) => (
                      <Row
                        key={c.id}
                        label={c.name}
                        href={`/search?category=${c.slug}`}
                      />
                    ))}
                  </nav>
                )}
              </div>

              {/* Account block pinned to the bottom, as the reference stores do. */}
              <div className="mt-auto border-t border-rule bg-paper-raised p-5">
                {isSignedIn ? (
                  <nav aria-label="Account">
                    <ul className="space-y-1">
                      {isStaff && (
                        <li>
                          <Link
                            href="/admin"
                            className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-ink-dim transition-colors hover:bg-paper-sunken hover:text-ink"
                          >
                            <LayoutGrid size={15} aria-hidden />
                            Admin dashboard
                          </Link>
                        </li>
                      )}
                      {accountLinks.map(({ href, label, icon: Icon }) => (
                        <li key={href}>
                          <Link
                            href={href}
                            className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-ink-dim transition-colors hover:bg-paper-sunken hover:text-ink"
                          >
                            <Icon size={15} aria-hidden />
                            {label}
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </nav>
                ) : (
                  <>
                    <Link
                      href="/login"
                      className="block w-full bg-ink px-6 py-4 text-center text-xs font-semibold uppercase tracking-[0.2em] text-paper transition-opacity hover:opacity-90"
                    >
                      Sign in
                    </Link>
                    <Link
                      href="/login?next=/account"
                      className="mt-3 block text-center text-sm text-ink-dim transition-colors hover:text-ink"
                    >
                      Create an account
                    </Link>
                    <p className="mt-3 text-center text-xs leading-relaxed text-ink-faint">
                      Browse and fill your cart without one. You only need an
                      account to check out.
                    </p>
                  </>
                )}
              </div>
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}
