"use client";

import { ShoppingBag } from "lucide-react";
import { useCart, cartCount } from "@/store/cart";

export default function CartButton() {
  const lines = useCart((s) => s.lines);
  const open = useCart((s) => s.open);
  const count = cartCount(lines);

  return (
    <button
      type="button"
      onClick={open}
      className="relative grid h-10 w-10 place-items-center rounded-full text-paper/70 transition-colors hover:bg-white/10 hover:text-paper"
      aria-label={count > 0 ? `Cart, ${count} items` : "Cart, empty"}
    >
      <ShoppingBag size={19} strokeWidth={1.6} aria-hidden />
      {count > 0 && (
        <span
          className="absolute -right-0.5 -top-0.5 grid h-[18px] min-w-[18px] place-items-center rounded-full bg-paper px-1 text-[10px] font-bold tabular-nums text-ink"
          aria-hidden
        >
          {count > 99 ? "99+" : count}
        </span>
      )}
    </button>
  );
}
