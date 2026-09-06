"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { Menu, X, LayoutGrid, User, Package, LifeBuoy } from "lucide-react";
import SearchBar from "@/components/SearchBar";
import BrandMark from "@/components/BrandMark";
import { styleFor } from "@/lib/brandStyles";
import type { Brand } from "@/lib/types";

/**
 * One brand in the picker. Same crossfade as the grid tiles: monochrome at
 * rest, the house's own colourway on hover.
 */
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

/**
 * The site menu, and the primary way into the catalog: brands sit at the top,
 * above search and account. Opened from the burger in the header.
 */
export default function SiteMenu({
  brands,
  isSignedIn,
  isStaff,
}: {
  brands: Brand[];
  isSignedIn: boolean;
  isStaff: boolean;
}) {
  const [open, setOpen] = useState(false);

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

  const accountLinks = [
    { href: "/account", label: "Settings", icon: User },
    { href: "/account/orders", label: "Orders", icon: Package },
    { href: "/account/tickets", label: "Support", icon: LifeBuoy },
  ];

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

      {/* Portalled to <body> on purpose. This component renders inside the
          header, and that header has a backdrop-filter, which establishes a
          containing block for fixed-position descendants. Left in place,
          `fixed inset-0` resolves against the 64px header rather than the
          viewport and the panel collapses to the height of its own title bar. */}
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
            onClick={() => setOpen(false)}
            aria-label="Close menu"
            className="absolute inset-0 bg-black/40 backdrop-blur-sm animate-fade-in"
          />

          <div
            // One delegated handler closes the panel for every link inside it.
            onClick={(e) => {
              if ((e.target as HTMLElement).closest("a")) setOpen(false);
            }}
            className="scroll-thin absolute left-0 top-0 flex h-full w-full max-w-sm flex-col overflow-y-auto border-r border-rule bg-paper-raised animate-slide-in-left"
          >
            <header className="sticky top-0 z-10 flex items-center justify-between border-b border-rule bg-paper-raised px-5 py-4">
              <p className="eyebrow !text-ink">Menu</p>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close menu"
                className="grid h-8 w-8 place-items-center rounded-full text-ink-dim transition-colors hover:bg-paper-sunken hover:text-ink"
              >
                <X size={18} aria-hidden />
              </button>
            </header>

            {/* Brands first: this is how you get into the catalog. */}
            <nav aria-label="Brands" className="border-b border-rule p-4">
              <p className="eyebrow px-1">Shop by brand</p>
              <ul className="mt-3 space-y-1">
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
                View all brands
              </Link>
            </nav>

            <div className="border-b border-rule p-5">
              <p className="eyebrow mb-3">Search</p>
              <SearchBar />
            </div>

            <nav aria-label="Account" className="p-5">
              <p className="eyebrow">Account</p>
              <ul className="mt-4 space-y-1">
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

                {isSignedIn ? (
                  accountLinks.map(({ href, label, icon: Icon }) => (
                    <li key={href}>
                      <Link
                        href={href}
                        className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-ink-dim transition-colors hover:bg-paper-sunken hover:text-ink"
                      >
                        <Icon size={15} aria-hidden />
                        {label}
                      </Link>
                    </li>
                  ))
                ) : (
                  <li>
                    <Link
                      href="/login"
                      className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-ink-dim transition-colors hover:bg-paper-sunken hover:text-ink"
                    >
                      <User size={15} aria-hidden />
                      Sign in
                    </Link>
                    <p className="mt-2 px-3 text-xs leading-relaxed text-ink-faint">
                      Browse and fill your cart without one. You only need an
                      account to check out.
                    </p>
                  </li>
                )}
              </ul>
            </nav>
          </div>
          </div>,
          document.body,
        )}
    </>
  );
}
