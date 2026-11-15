"use client";

/**
 * three.js is loaded only when a 3D figure scrolls near the viewport, so the comparison
 * workflow (form, charts, tables) never waits for it.
 */
export type ThreeModule = typeof import("three");
export type OrbitControlsCtor = (typeof import("three/examples/jsm/controls/OrbitControls.js"))["OrbitControls"];

let runtime: Promise<{ THREE: ThreeModule; OrbitControls: OrbitControlsCtor }> | null = null;

export function loadThree() {
  runtime ??= Promise.all([import("three"), import("three/examples/jsm/controls/OrbitControls.js")]).then(([THREE, oc]) => ({
    THREE,
    OrbitControls: oc.OrbitControls,
  }));
  return runtime;
}

export function webglAvailable(): boolean {
  try {
    const c = document.createElement("canvas");
    return !!(c.getContext("webgl2") || c.getContext("webgl"));
  } catch {
    return false;
  }
}

export const prefersReducedMotion = () =>
  typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

/** Run `start` once the element is within one screen of the viewport. */
export function whenNearViewport(el: Element, start: () => void): () => void {
  if (typeof IntersectionObserver === "undefined") {
    start();
    return () => {};
  }
  const io = new IntersectionObserver(
    (entries) => {
      if (entries.some((e) => e.isIntersecting)) {
        io.disconnect();
        start();
      }
    },
    { rootMargin: "100% 0px" },
  );
  io.observe(el);
  return () => io.disconnect();
}

export async function fetchInt16(url: string): Promise<Int16Array> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return new Int16Array(await res.arrayBuffer());
}
