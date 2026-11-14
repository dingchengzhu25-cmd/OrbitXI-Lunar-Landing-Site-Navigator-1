/**
 * Small building blocks for being a polite Horizons client: a bounded TTL cache,
 * in-flight request coalescing, and a concurrency limit.
 *
 * All state lives in the memory of one server process. On serverless hosting such
 * as Vercel, each function instance has its own copy and loses it on a cold start,
 * so this reduces repeat queries but guarantees nothing. No external store is used.
 */

export class BoundedTtlCache<V> {
  private readonly entries = new Map<string, { storedAtMs: number; value: V }>();

  constructor(
    private readonly ttlMs: number,
    private readonly maxEntries: number,
    private readonly now: () => number = Date.now,
  ) {}

  get(key: string): V | undefined {
    const hit = this.entries.get(key);
    if (!hit) return undefined;
    if (this.now() - hit.storedAtMs > this.ttlMs) {
      this.entries.delete(key);
      return undefined;
    }
    return hit.value;
  }

  set(key: string, value: V): void {
    this.entries.delete(key);
    // Map keeps insertion order, so the first key is the oldest entry.
    while (this.entries.size >= this.maxEntries) {
      const oldest = this.entries.keys().next().value;
      if (oldest === undefined) break;
      this.entries.delete(oldest);
    }
    this.entries.set(key, { storedAtMs: this.now(), value });
  }

  get size(): number {
    return this.entries.size;
  }

  clear(): void {
    this.entries.clear();
  }
}

/** Lets concurrent callers asking for the same key share one in-flight promise. */
export class Coalescer<V> {
  private readonly inFlight = new Map<string, Promise<V>>();

  run(key: string, work: () => Promise<V>): Promise<V> {
    const existing = this.inFlight.get(key);
    if (existing) return existing;
    const p = work().finally(() => this.inFlight.delete(key));
    this.inFlight.set(key, p);
    return p;
  }

  get pending(): number {
    return this.inFlight.size;
  }
}

/** Allows at most `limit` tasks to run at once; the rest wait in arrival order. */
export class Semaphore {
  private active = 0;
  private readonly waiting: (() => void)[] = [];

  constructor(private readonly limit: number) {}

  async run<T>(work: () => Promise<T>): Promise<T> {
    if (this.active >= this.limit) {
      await new Promise<void>((resolve) => this.waiting.push(resolve));
    }
    this.active++;
    try {
      return await work();
    } finally {
      this.active--;
      this.waiting.shift()?.();
    }
  }
}
