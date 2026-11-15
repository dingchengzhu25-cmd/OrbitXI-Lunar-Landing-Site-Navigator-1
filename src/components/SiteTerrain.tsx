"use client";

import { useEffect, useRef, useState } from "react";
import type { TerrainTileMeta } from "@/lib/moonGeo";
import { fetchInt16, loadThree, webglAvailable, whenNearViewport, type ThreeModule } from "./threeRuntime";

type Phase = "waiting" | "loading" | "ready" | "unsupported" | "failed";
type Mode = "relief" | "elevation";

/* Sequential elevation ramp (low → high), dark-to-light so it also reads in greyscale. */
const RAMP = ["#14213d", "#2f4b7c", "#5b7290", "#9a9a8f", "#cdbb92", "#f1ead8"];
const rampCss = `linear-gradient(to right, ${RAMP.join(", ")})`;

function rampAt(THREE: ThreeModule, t: number) {
  const x = Math.min(0.9999, Math.max(0, t)) * (RAMP.length - 1);
  const i = Math.floor(x);
  return new THREE.Color(RAMP[i]).lerp(new THREE.Color(RAMP[i + 1]), x - i);
}

const km = (m: number) => (m / 1000).toFixed(m < 10_000 ? 1 : 0);

/**
 * Real terrain around one preset site: NASA LRO LOLA elevation on a north-up tile centred on the
 * site's exact coordinates, at true vertical scale. Context only: the visibility results do not
 * use this terrain (smooth sphere, no terrain horizon).
 */
export function SiteTerrain({ site, label, color, tile }: { site: "A" | "B"; label: string; color: string; tile: TerrainTileMeta }) {
  const hostRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const compassRef = useRef<HTMLDivElement>(null);
  const modeRef = useRef<(m: Mode) => void>(() => {});
  const [phase, setPhase] = useState<Phase>("waiting");
  const [mode, setMode] = useState<Mode>("relief");

  useEffect(() => {
    modeRef.current(mode);
  }, [mode]);

  useEffect(() => {
    const host = hostRef.current;
    const canvas = canvasRef.current;
    if (!host || !canvas) return;
    let disposed = false;
    let cleanup = () => {};

    const stop = whenNearViewport(host, async () => {
      if (!webglAvailable()) {
        setPhase("unsupported");
        return;
      }
      setPhase("loading");
      try {
        const [{ THREE, OrbitControls }, h] = await Promise.all([loadThree(), fetchInt16(`/vision/terrain/${tile.id}.bin`)]);
        const normalMap = await new THREE.TextureLoader().loadAsync(`/vision/terrain/${tile.id}_n.jpg`);
        if (disposed) {
          normalMap.dispose();
          return;
        }
        const n = tile.n;
        const sizeKm = tile.sizeM / 1000;
        let lo = Infinity;
        let hi = -Infinity;
        for (const v of h) {
          lo = Math.min(lo, v);
          hi = Math.max(hi, v);
        }
        const centreM = h[((n - 1) / 2) * n + (n - 1) / 2];

        const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
        renderer.setPixelRatio(Math.min(2, window.devicePixelRatio));
        renderer.outputColorSpace = THREE.SRGBColorSpace;
        renderer.toneMapping = THREE.ACESFilmicToneMapping;
        normalMap.anisotropy = renderer.capabilities.getMaxAnisotropy();

        const scene = new THREE.Scene();
        scene.fog = new THREE.Fog(0x000000, sizeKm * 0.75, sizeKm * 1.45); // far edge fades into the dark
        const camera = new THREE.PerspectiveCamera(44, 1, sizeKm / 500, sizeKm * 10);
        scene.add(new THREE.HemisphereLight(0xbfd2ff, 0x050505, 0.22));
        // Illustrative low sun from the north-west, fixed; it does not show computed shadows.
        const sun = new THREE.DirectionalLight(0xfff1dc, 3.0);
        sun.position.set(-0.62, 0.42, -0.62).multiplyScalar(sizeKm);
        scene.add(sun);

        // True vertical scale (1 km horizontal = 1 km vertical), heights relative to the site.
        const geo = new THREE.PlaneGeometry(sizeKm, sizeKm, n - 1, n - 1);
        geo.rotateX(-Math.PI / 2); // row 0 (north) ends up at −z: the camera looks north by default
        const pos = geo.getAttribute("position");
        const nor = geo.getAttribute("normal");
        const colors = new Float32Array(pos.count * 3);
        for (let i = 0; i < pos.count; i++) {
          pos.setY(i, (h[i] - centreM) / 1000);
          nor.setXYZ(i, 0, 1, 0); // the normal map carries the full 20 m / 470 m slope detail
          const c = rampAt(THREE, (h[i] - lo) / Math.max(1, hi - lo));
          colors.set([c.r, c.g, c.b], i * 3);
        }
        pos.needsUpdate = true;
        geo.setAttribute("color", new THREE.BufferAttribute(colors, 3));
        const mat = new THREE.MeshStandardMaterial({ color: 0x9c9a94, normalMap, roughness: 1, metalness: 0, vertexColors: false });
        const ground = new THREE.Mesh(geo, mat);
        scene.add(ground);
        modeRef.current = (m) => {
          mat.vertexColors = m === "elevation";
          mat.color.set(m === "elevation" ? 0xffffff : 0x9c9a94);
          mat.needsUpdate = true;
        };
        modeRef.current(mode);

        // Site pin at the exact centre of the tile.
        const pinH = sizeKm * 0.09;
        const col = new THREE.Color(color);
        const stem = new THREE.Mesh(
          new THREE.CylinderGeometry(sizeKm * 0.0016, sizeKm * 0.0016, pinH, 8),
          new THREE.MeshBasicMaterial({ color: col, toneMapped: false }),
        );
        stem.position.set(0, pinH / 2, 0);
        const head = new THREE.Mesh(new THREE.SphereGeometry(sizeKm * 0.008, 20, 12), new THREE.MeshBasicMaterial({ color: col, toneMapped: false }));
        head.position.set(0, pinH, 0);
        const ring = new THREE.Mesh(
          new THREE.RingGeometry(sizeKm * 0.012, sizeKm * 0.017, 48),
          new THREE.MeshBasicMaterial({ color: col, toneMapped: false, transparent: true, opacity: 0.95, depthTest: false }),
        );
        ring.rotation.x = -Math.PI / 2;
        ring.position.y = 0.02;
        scene.add(stem, head, ring);

        const controls = new OrbitControls(camera, canvas);
        controls.enableDamping = true;
        controls.enablePan = false;
        controls.maxPolarAngle = (78 * Math.PI) / 180;
        controls.minDistance = sizeKm * 0.18;
        controls.maxDistance = sizeKm * 1.1;
        controls.target.set(0, 0, 0);
        camera.position.set(0, sizeKm * 0.3, sizeKm * 0.5);
        controls.update();

        const resize = () => {
          renderer.setSize(host.clientWidth, host.clientHeight, false);
          camera.aspect = host.clientWidth / host.clientHeight;
          camera.updateProjectionMatrix();
        };
        resize();
        const ro = new ResizeObserver(resize);
        ro.observe(host);
        let visible = true;
        const io = new IntersectionObserver((e) => (visible = e.some((x) => x.isIntersecting)));
        io.observe(host);
        let raf = 0;
        const tick = () => {
          raf = requestAnimationFrame(tick);
          if (!visible) return;
          controls.update();
          renderer.render(scene, camera);
          if (compassRef.current) {
            // North is −z in the scene; rotate the arrow by the camera's azimuth.
            const az = Math.atan2(camera.position.x, camera.position.z);
            compassRef.current.style.transform = `rotate(${(az * 180) / Math.PI}deg)`;
          }
        };
        raf = requestAnimationFrame(tick);
        setPhase("ready");

        cleanup = () => {
          cancelAnimationFrame(raf);
          ro.disconnect();
          io.disconnect();
          controls.dispose();
          scene.traverse((o) => {
            const m = o as InstanceType<ThreeModule["Mesh"]>;
            m.geometry?.dispose();
            const mm = m.material as InstanceType<ThreeModule["Material"]> | undefined;
            mm?.dispose?.();
          });
          normalMap.dispose();
          renderer.dispose();
        };
      } catch {
        if (!disposed) setPhase("failed");
      }
    });
    return () => {
      disposed = true;
      stop();
      cleanup();
    };
    // The tile identifies everything this scene draws; mode changes go through modeRef.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tile.id, color]);

  const relief = tile.maxM - tile.minM;
  const polar = tile.sizeM <= 30_000;

  return (
    <figure className="flex flex-col border border-rule bg-black" aria-labelledby={`fig-terrain-${site}`} data-testid={`terrain-${site}`}>
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-rule px-4 py-2.5">
        <p className="text-sm text-ink">
          <b style={{ color }}>Site {site}</b> {label}
        </p>
        <div role="group" aria-label={`Colouring for Site ${site} terrain`} className="flex border border-rule-strong text-xs">
          {(
            [
              ["relief", "Shaded relief"],
              ["elevation", "Elevation"],
            ] as const
          ).map(([m, text]) => (
            <button
              key={m}
              type="button"
              aria-pressed={mode === m}
              onClick={() => setMode(m)}
              className="px-2.5 py-1 text-ink-2 aria-pressed:bg-ink aria-pressed:text-space"
            >
              {text}
            </button>
          ))}
        </div>
      </div>
      <div ref={hostRef} className="relative h-[300px] sm:h-[340px]">
        <canvas
          ref={canvasRef}
          className="block h-full w-full cursor-grab touch-none active:cursor-grabbing"
          role="img"
          aria-label={`3D terrain, ${km(tile.sizeM)} by ${km(tile.sizeM)} kilometres, centred on Site ${site}, ${label}, from NASA LOLA elevation at true vertical scale. Relief across the tile about ${km(relief)} kilometres.`}
        />
        {phase !== "ready" && (
          <div className="absolute inset-0 flex items-center justify-center p-6 text-center text-sm text-ink-2">
            {phase === "unsupported"
              ? "3D view needs WebGL, which this browser has turned off."
              : phase === "failed"
                ? "The NASA LOLA terrain could not be loaded."
                : "Loading NASA LOLA elevation…"}
          </div>
        )}
        <div className="pointer-events-none absolute right-3 bottom-3 flex flex-col items-center gap-0.5 text-[10px] text-ink-2" aria-hidden="true">
          <div ref={compassRef} className="flex h-8 w-8 items-center justify-center rounded-full border border-rule-strong bg-black/60">
            <svg width="12" height="16" viewBox="0 0 12 16">
              <path d="M6 0 L11 14 L6 11 L1 14 Z" fill="#f3f5f9" />
            </svg>
          </div>
          N
        </div>
        <div className="pointer-events-none absolute bottom-3 left-3 font-mono text-[11px] text-ink-2">
          {km(tile.sizeM)} × {km(tile.sizeM)} km · true vertical scale
        </div>
      </div>
      <figcaption id={`fig-terrain-${site}`} className="border-t border-rule px-4 py-3 text-xs leading-relaxed text-ink-3">
        {mode === "elevation" && (
          <div className="mb-2 flex items-center gap-2 font-mono text-[11px] text-ink-2">
            <span>lower</span>
            <span className="h-2 flex-1 rounded-[1px]" style={{ background: rampCss }} />
            <span>higher</span>
            <span className="text-ink-3">· relief ≈ {km(relief)} km</span>
          </div>
        )}
        {polar ? "South-polar close-up" : "Regional view"} from{" "}
        <a className="text-accent-hover underline underline-offset-2" href={tile.sourceUrl} target="_blank" rel="noreferrer">
          {tile.source}
        </a>
        , centred on the site&apos;s exact coordinates, north up. Lighting is illustrative. Context only: visibility results
        do not use this terrain.
      </figcaption>
    </figure>
  );
}
