"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { X, Minus, Plus, Trash2, Loader2 } from "lucide-react";
import { useCart, cartSubtotal, cartCount } from "@/store/cart";
import { money } from "@/lib/format";

export default function CartDrawer() {
  const router = useRouter();
  const { lines, isOpen, close, remove, setQuantity } = useCart();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [needsAuth, setNeedsAuth] = useState(false);

  const subtotal = cartSubtotal(lines);
  const count = cartCount(lines);

  // Escape closes; body scroll locks while the drawer owns the screen.
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && close();
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [isOpen, close]);

  async function checkout() {
    setBusy(true);
    setError(null);
    setNeedsAuth(false);

    const res = await fetch("/api/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        lines: lines.map((l) => ({
          productId: l.productId,
          size: l.size,
          quantity: l.quantity,
        })),
      }),
    });

    if (res.status === 401) {
      // Browsing and building a cart never needs an account. Ask here, in
      // place, with the cart still on screen, rather than redirecting away.
      setNeedsAuth(true);
      setBusy(false);
      return;
    }

    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(json.error ?? "Checkout failed. Please try again.");
      setBusy(false);
      return;
    }

    useCart.getState().clear();
    close();
    setBusy(false);
    router.push(`/account/orders?placed=${json.orderNumber}`);
    router.refresh();
  }

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-label="Shopping cart">
      <button
        type="button"
        onClick={close}
        aria-label="Close cart"
        className="absolute inset-0 bg-black/40 backdrop-blur-sm animate-fade-in"
      />

      <div className="absolute right-0 top-0 flex h-full w-full max-w-md flex-col border-l border-rule bg-paper-raised animate-slide-in">
        <header className="flex items-center justify-between border-b border-rule px-5 py-4">
          <h2 className="eyebrow !text-ink">
            Cart {count > 0 && <span className="text-ink-faint">({count})</span>}
          </h2>
          <button
            type="button"
            onClick={close}
            className="grid h-8 w-8 place-items-center rounded-full text-ink-dim hover:text-ink hover:bg-paper-sunken transition-colors"
            aria-label="Close cart"
          >
            <X size={18} aria-hidden />
          </button>
        </header>

        {lines.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-4 px-8 text-center">
            <p className="text-ink-faint text-sm">Your cart is empty.</p>
            <button
              type="button"
              onClick={close}
              className="rounded-full border border-rule-strong px-5 py-2 text-xs uppercase tracking-widest hover:bg-ink hover:text-paper transition-colors"
            >
              Keep shopping
            </button>
          </div>
        ) : (
          <>
            <ul className="scroll-thin flex-1 divide-y divide-rule overflow-y-auto">
              {lines.map((line) => (
                <li key={line.key} className="flex gap-4 p-5">
                  <Link href={`/products/${line.productId}`} onClick={close} className="shrink-0">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={line.imageUrl ?? "/ph/product"}
                      alt={line.name}
                      className="h-24 w-20 rounded-md object-cover bg-paper-sunken"
                    />
                  </Link>

                  <div className="min-w-0 flex-1">
                    <p className="text-[11px] uppercase tracking-widest text-ink-faint">
                      {line.brandName}
                    </p>
                    <Link
                      href={`/products/${line.productId}`}
                      onClick={close}
                      className="mt-0.5 block text-sm leading-snug hover:underline"
                    >
                      {line.name}
                    </Link>
                    {line.size && (
                      <p className="mt-1 text-xs text-ink-faint">Size {line.size}</p>
                    )}

                    <div className="mt-3 flex items-center justify-between gap-3">
                      <div className="flex items-center rounded-full border border-rule">
                        <button
                          type="button"
                          onClick={() => setQuantity(line.key, line.quantity - 1)}
                          className="grid h-7 w-7 place-items-center rounded-l-full text-ink-dim hover:text-ink hover:bg-paper-sunken"
                          aria-label={`Decrease quantity of ${line.name}`}
                        >
                          <Minus size={13} aria-hidden />
                        </button>
                        <span className="w-7 text-center text-xs tabular-nums" aria-live="polite">
                          {line.quantity}
                        </span>
                        <button
                          type="button"
                          onClick={() => setQuantity(line.key, line.quantity + 1)}
                          disabled={line.quantity >= line.stock}
                          className="grid h-7 w-7 place-items-center rounded-r-full text-ink-dim hover:text-ink hover:bg-paper-sunken disabled:opacity-30 disabled:hover:bg-transparent"
                          aria-label={`Increase quantity of ${line.name}`}
                        >
                          <Plus size={13} aria-hidden />
                        </button>
                      </div>

                      <span className="text-sm tabular-nums">
                        {money(line.price * line.quantity)}
                      </span>
                    </div>

                    {line.quantity >= line.stock && (
                      <p className="mt-1.5 text-[11px] text-ink-faint">
                        Only {line.stock} left in stock
                      </p>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={() => remove(line.key)}
                    className="h-fit shrink-0 text-ink-faint hover:text-danger transition-colors"
                    aria-label={`Remove ${line.name} from cart`}
                  >
                    <Trash2 size={15} aria-hidden />
                  </button>
                </li>
              ))}
            </ul>

            <footer className="border-t border-rule p-5 space-y-4">
              {error && (
                <p role="alert" className="text-sm text-danger">
                  {error}
                </p>
              )}

              {needsAuth && (
                <div
                  role="status"
                  className="rounded-lg border border-rule bg-paper-sunken px-4 py-3.5"
                >
                  <p className="text-sm">Sign in to complete your order.</p>
                  <p className="mt-1 text-xs leading-relaxed text-ink-faint">
                    Your cart is saved on this device, so nothing is lost.
                  </p>
                  <Link
                    href="/login?next=/account/orders"
                    onClick={close}
                    className="mt-3 inline-block rounded-full bg-ink px-5 py-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-paper transition-colors hover:opacity-90"
                  >
                    Sign in or create an account
                  </Link>
                </div>
              )}

              <div className="flex items-baseline justify-between">
                <span className="eyebrow">Subtotal</span>
                <span className="text-xl tabular-nums">{money(subtotal)}</span>
              </div>
              <p className="text-xs text-ink-faint">
                Shipping and taxes calculated at checkout.
              </p>

              <button
                type="button"
                onClick={checkout}
                disabled={busy}
                className="flex w-full items-center justify-center gap-2 rounded-full bg-ink px-6 py-3.5 text-xs font-semibold uppercase tracking-[0.2em] text-paper hover:opacity-90 disabled:opacity-60 transition-colors"
              >
                {busy && <Loader2 size={14} className="animate-spin" aria-hidden />}
                {busy ? "Placing order…" : "Proceed to checkout"}
              </button>
            </footer>
          </>
        )}
      </div>
    </div>
  );
}
