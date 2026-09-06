"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

export type CartLine = {
  /** productId + size, one product in two sizes is two lines. */
  key: string;
  productId: string;
  name: string;
  brandName: string | null;
  price: number;
  imageUrl: string | null;
  size: string | null;
  quantity: number;
  /** Snapshot of stock at add-time, so we can cap the quantity stepper. */
  stock: number;
};

export type NewCartLine = Omit<CartLine, "key" | "quantity"> & { quantity?: number };

type CartState = {
  lines: CartLine[];
  isOpen: boolean;
  hydrated: boolean;
  add: (line: NewCartLine) => void;
  remove: (key: string) => void;
  setQuantity: (key: string, quantity: number) => void;
  clear: () => void;
  open: () => void;
  close: () => void;
};

const lineKey = (productId: string, size: string | null) => `${productId}::${size ?? "OS"}`;

export const useCart = create<CartState>()(
  persist(
    (set) => ({
      lines: [],
      isOpen: false,
      hydrated: false,

      add: (incoming) =>
        set((state) => {
          const key = lineKey(incoming.productId, incoming.size);
          const qty = Math.max(1, incoming.quantity ?? 1);
          const existing = state.lines.find((l) => l.key === key);

          const lines = existing
            ? state.lines.map((l) =>
                l.key === key
                  ? { ...l, quantity: Math.min(l.stock, l.quantity + qty) }
                  : l,
              )
            : [
                ...state.lines,
                { ...incoming, key, quantity: Math.min(incoming.stock, qty) },
              ];

          // Adding always reveals the drawer, the confirmation *is* the drawer.
          return { lines, isOpen: true };
        }),

      remove: (key) =>
        set((state) => ({ lines: state.lines.filter((l) => l.key !== key) })),

      setQuantity: (key, quantity) =>
        set((state) => ({
          lines:
            quantity <= 0
              ? state.lines.filter((l) => l.key !== key)
              : state.lines.map((l) =>
                  l.key === key
                    ? { ...l, quantity: Math.min(l.stock, quantity) }
                    : l,
                ),
        })),

      clear: () => set({ lines: [] }),
      open: () => set({ isOpen: true }),
      close: () => set({ isOpen: false }),
    }),
    {
      name: "dd-cart",
      partialize: (state) => ({ lines: state.lines }),
      onRehydrateStorage: () => (state) => {
        if (state) state.hydrated = true;
      },
    },
  ),
);

export const cartSubtotal = (lines: CartLine[]) =>
  lines.reduce((sum, l) => sum + l.price * l.quantity, 0);

export const cartCount = (lines: CartLine[]) =>
  lines.reduce((sum, l) => sum + l.quantity, 0);
