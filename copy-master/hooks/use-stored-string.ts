"use client";

import { useCallback, useSyncExternalStore } from "react";

/**
 * A string that lives in `localStorage`, read through `useSyncExternalStore`.
 *
 * Why not `useState` plus an effect that restores the saved value? Because the
 * server has nothing in storage to render, so the restore has to happen on the
 * client, and calling `setState` from an effect body to do it causes a
 * cascading render (and is rejected by the React Compiler lint rules).
 *
 * Treating storage as the external system it actually is solves both: React
 * hydrates against `getServerSnapshot`, then reconciles with the real stored
 * value on its own.
 */

type Listener = () => void;

/** Writes are coalesced, so a long article is not re-serialised per keystroke. */
const PERSIST_DELAY_MS = 350;

class StringStore {
  private readonly listeners = new Set<Listener>();
  private value: string | null = null;
  private loaded = false;
  private timer: ReturnType<typeof setTimeout> | null = null;

  constructor(
    private readonly key: string,
    private readonly fallback: string,
    /** Mints a value the first time the key is missing, e.g. a visitor id. */
    private readonly create?: () => string,
  ) {}

  /**
   * Reads through to storage once, then serves from memory. Returning a cached
   * value matters: `useSyncExternalStore` compares snapshots and would spin if
   * this produced something new every call.
   */
  getSnapshot = (): string => {
    if (!this.loaded) {
      this.loaded = true;
      try {
        this.value = window.localStorage.getItem(this.key);
      } catch {
        // Private mode, or storage disabled.
        this.value = null;
      }

      // Minting here rather than in an effect keeps it out of the render
      // cascade. It runs at most once, and the result is cached from then on,
      // so repeated `getSnapshot` calls still agree with each other.
      if (this.value === null && this.create) {
        this.value = this.create();
        this.schedulePersist();
      }
    }
    return this.value ?? this.fallback;
  };

  getServerSnapshot = (): string => this.fallback;

  subscribe = (listener: Listener): (() => void) => {
    this.listeners.add(listener);

    // Keep tabs editing the same draft in step.
    const onStorage = (event: StorageEvent) => {
      if (event.key !== this.key) return;
      this.value = event.newValue;
      this.emit();
    };
    window.addEventListener("storage", onStorage);

    return () => {
      this.listeners.delete(listener);
      window.removeEventListener("storage", onStorage);
    };
  };

  set = (next: string): void => {
    if (this.getSnapshot() === next) return;
    this.value = next;
    // In-memory first so typing never waits on a storage write.
    this.emit();
    this.schedulePersist();
  };

  private emit(): void {
    for (const listener of this.listeners) listener();
  }

  private schedulePersist(): void {
    if (this.timer !== null) clearTimeout(this.timer);
    this.timer = setTimeout(() => {
      this.timer = null;
      try {
        window.localStorage.setItem(this.key, this.value ?? "");
      } catch {
        // Over quota. Nothing useful to do here; the session still works.
      }
    }, PERSIST_DELAY_MS);
  }
}

/** One store per key, so every reader of a key shares the same value. */
const stores = new Map<string, StringStore>();

function storeFor(
  key: string,
  fallback: string,
  create?: () => string,
): StringStore {
  const existing = stores.get(key);
  if (existing) return existing;
  const created = new StringStore(key, fallback, create);
  stores.set(key, created);
  return created;
}

/**
 * `create` is used only when the key is absent from storage. It never runs on
 * the server, so the server snapshot stays `fallback` and hydration matches;
 * the generated value arrives on the first client read instead.
 */
export function useStoredString(
  key: string,
  fallback = "",
  create?: () => string,
): [string, (next: string) => void] {
  const store = storeFor(key, fallback, create);

  const value = useSyncExternalStore(
    store.subscribe,
    store.getSnapshot,
    store.getServerSnapshot,
  );

  const set = useCallback((next: string) => store.set(next), [store]);

  return [value, set];
}
