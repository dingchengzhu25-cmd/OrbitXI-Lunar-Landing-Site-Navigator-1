import { describe, expect, it } from "vitest";
import { BoundedTtlCache, Coalescer, Semaphore } from "./cache";

const deferred = <T,>() => {
  let resolve!: (v: T) => void;
  const promise = new Promise<T>((r) => (resolve = r));
  return { promise, resolve };
};

describe("BoundedTtlCache", () => {
  it("returns stored values until the TTL passes", () => {
    let now = 1_000;
    const c = new BoundedTtlCache<string>(100, 10, () => now);
    c.set("k", "v");
    now = 1_100;
    expect(c.get("k")).toBe("v");
    now = 1_101;
    expect(c.get("k")).toBeUndefined();
    expect(c.size).toBe(0);
  });

  it("never holds more than maxEntries, evicting the oldest first", () => {
    const c = new BoundedTtlCache<number>(1_000, 3, () => 0);
    for (let i = 0; i < 5; i++) c.set(`k${i}`, i);
    expect(c.size).toBe(3);
    expect(c.get("k0")).toBeUndefined();
    expect(c.get("k1")).toBeUndefined();
    expect(c.get("k4")).toBe(4);
  });

  it("re-setting a key refreshes it instead of growing the cache", () => {
    const c = new BoundedTtlCache<number>(1_000, 2, () => 0);
    c.set("a", 1);
    c.set("b", 2);
    c.set("a", 3);
    c.set("c", 4);
    expect(c.size).toBe(2);
    expect(c.get("a")).toBe(3);
    expect(c.get("b")).toBeUndefined();
  });
});

describe("Coalescer", () => {
  it("shares one in-flight call between identical concurrent requests", async () => {
    const co = new Coalescer<number>();
    const d = deferred<number>();
    let calls = 0;
    const work = () => {
      calls++;
      return d.promise;
    };
    const p1 = co.run("same", work);
    const p2 = co.run("same", work);
    expect(co.pending).toBe(1);
    d.resolve(7);
    expect(await Promise.all([p1, p2])).toEqual([7, 7]);
    expect(calls).toBe(1);
    expect(co.pending).toBe(0);
  });

  it("starts a new call once the previous one has finished, including after a failure", async () => {
    const co = new Coalescer<number>();
    await expect(co.run("k", () => Promise.reject(new Error("boom")))).rejects.toThrow("boom");
    expect(await co.run("k", async () => 2)).toBe(2);
  });

  it("does not merge different keys", async () => {
    const co = new Coalescer<string>();
    expect(await Promise.all([co.run("a", async () => "A"), co.run("b", async () => "B")])).toEqual(["A", "B"]);
  });
});

describe("Semaphore", () => {
  it("never runs more than the limit at once and completes everything", async () => {
    const sem = new Semaphore(2);
    let active = 0;
    let peak = 0;
    const results = await Promise.all(
      [1, 2, 3, 4, 5, 6].map((n) =>
        sem.run(async () => {
          active++;
          peak = Math.max(peak, active);
          await new Promise((r) => setTimeout(r, 3));
          active--;
          return n;
        }),
      ),
    );
    expect(peak).toBe(2);
    expect(results).toEqual([1, 2, 3, 4, 5, 6]);
  });

  it("releases its slot when a task throws", async () => {
    const sem = new Semaphore(1);
    await expect(sem.run(() => Promise.reject(new Error("x")))).rejects.toThrow("x");
    expect(await sem.run(async () => "next")).toBe("next");
  });
});
