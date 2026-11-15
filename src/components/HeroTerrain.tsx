"use client";

import { useEffect, useRef, useState } from "react";
import { MOON_RADIUS_M } from "@/lib/moonGeo";
import { fetchInt16, loadThree, prefersReducedMotion, webglAvailable, type ThreeModule } from "./threeRuntime";

/* 81.92 km LOLA 20 m/px window centred on the south pole (public/vision/hero/southpole.json). */
const SIZE_KM = 81.92;
const N = 1025;
/* Scene km: x = polar-stereographic x, z = −y (raster up = −z). Shackleton centre from IAU 89.67° S, 129.78° E. */
const LABELS = [
  { id: "pole", x: 0, z: 0, title: "South pole", sub: "90° S" },
  { id: "shackleton", x: 7.69, z: 6.4, title: "Shackleton crater", sub: "≈ 21 km across" },
];

/**
 * Hero: the real terrain around the lunar south pole (NASA LOLA elevation, true vertical scale,
 * with the Moon's curvature). Shading and cast shadows are computed from those heights for an
 * illustrative low Sun (4.5° elevation). Decorative context only.
 */
export function HeroTerrain() {
  const hostRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const labelRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const host = hostRef.current;
    const canvas = canvasRef.current;
    if (!host || !canvas || !webglAvailable()) return;
    let disposed = false;
    let cleanup = () => {};
    // Let the page paint and become interactive first.
    const idle = window.setTimeout(async () => {
      try {
        const narrow = host.clientWidth < 700;
        const [{ THREE }, raw] = await Promise.all([loadThree(), fetchInt16("/vision/hero/southpole_height_1k.bin")]);
        const loader = new THREE.TextureLoader();
        // Lighting and cast shadows are baked offline from the same 20 m heights
        // (scripts/moon-assets/build_hero.py), so they stay sharp at any camera distance.
        const [lit, sky] = await Promise.all([
          loader.loadAsync(narrow ? "/vision/hero/southpole_lit_2k.jpg" : "/vision/hero/southpole_lit_4k.jpg"),
          loader.loadAsync("/vision/hero/sky_4k.jpg"),
        ]);
        if (disposed) return;

        const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
        renderer.setPixelRatio(Math.min(narrow ? 1.5 : 2, window.devicePixelRatio));
        renderer.outputColorSpace = THREE.SRGBColorSpace;
        lit.colorSpace = THREE.SRGBColorSpace;
        lit.anisotropy = renderer.capabilities.getMaxAnisotropy();
        lit.generateMipmaps = true;
        lit.minFilter = THREE.LinearMipmapLinearFilter;
        sky.colorSpace = THREE.SRGBColorSpace;

        const scene = new THREE.Scene();
        scene.background = new THREE.Color(0x000000);
        scene.fog = new THREE.Fog(0x000000, 38, 62);
        const camera = new THREE.PerspectiveCamera(narrow ? 52 : 38, 1, 0.05, 3000);

        // Sky: NASA SVS Deep Star Maps, oriented so the zenith is near the south ecliptic pole
        // (RA 6h, Dec −66.56°), roughly as seen from the lunar south pole.
        const skyDir = (ra: number, dec: number) => {
          const ph = 2 * Math.PI * (0.5 - ra / 360);
          const th = ((90 - dec) * Math.PI) / 180;
          return new THREE.Vector3(Math.cos(ph) * Math.sin(th), Math.cos(th), Math.sin(ph) * Math.sin(th));
        };
        const skyMesh = new THREE.Mesh(
          new THREE.SphereGeometry(1500, 96, 48),
          new THREE.MeshBasicMaterial({ map: sky, side: THREE.BackSide, fog: false, depthWrite: false }),
        );
        skyMesh.scale.x = -1;
        const q1 = new THREE.Quaternion().setFromUnitVectors(skyDir(90, -66.56).normalize(), new THREE.Vector3(0, 1, 0));
        const gc = skyDir(266.4, -28.94).applyQuaternion(q1); // galactic centre skims the horizon
        const q2 = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.atan2(0.45, -1) - Math.atan2(gc.x, gc.z));
        skyMesh.quaternion.copy(q2.multiply(q1));
        scene.add(skyMesh);

        // Terrain: true vertical scale, plus the drop of the Moon's curvature toward the edges.
        const stride = narrow ? 2 : 1;
        const n = Math.floor((N - 1) / stride) + 1;
        const geo = new THREE.PlaneGeometry(SIZE_KM, SIZE_KM, n - 1, n - 1);
        geo.rotateX(-Math.PI / 2);
        const pos = geo.getAttribute("position");
        const rKm = MOON_RADIUS_M / 1000;
        const heightKm = (x: number, z: number) => {
          const fx = Math.min(N - 1.001, Math.max(0, (x / SIZE_KM + 0.5) * (N - 1)));
          const fz = Math.min(N - 1.001, Math.max(0, (z / SIZE_KM + 0.5) * (N - 1)));
          const x0 = fx | 0;
          const z0 = fz | 0;
          const ax = fx - x0;
          const az = fz - z0;
          const i = z0 * N + x0;
          const h = (raw[i] * (1 - ax) + raw[i + 1] * ax) * (1 - az) + (raw[i + N] * (1 - ax) + raw[i + N + 1] * ax) * az;
          return h / 1000 - (x * x + z * z) / (2 * rKm);
        };
        const fade = new Float32Array(pos.count * 3);
        for (let i = 0; i < pos.count; i++) {
          const x = pos.getX(i);
          const z = pos.getZ(i);
          pos.setY(i, heightKm(x, z));
          // Darken a thin outer band so the tile's square edge never shows.
          const e = Math.min(SIZE_KM / 2 - Math.abs(x), SIZE_KM / 2 - Math.abs(z)) / (SIZE_KM * 0.08);
          const f = Math.max(0, Math.min(1, e));
          const v = f * f * (3 - 2 * f);
          fade.set([v, v, v], i * 3);
        }
        pos.needsUpdate = true;
        geo.setAttribute("color", new THREE.BufferAttribute(fade, 3));
        const ground = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ map: lit, vertexColors: true }));
        scene.add(ground);

        // Oblique view from ~11 km up on the Sun's side, so Shackleton's lit inner wall faces the camera.
        const target = new THREE.Vector3(7.7, -0.6, 6.4);
        let orbit = 0;
        const place = () => {
          const a = -1.95 + 0.35 * Math.sin(orbit);
          camera.position.set(target.x + Math.sin(a) * 27, 9.5, target.z + Math.cos(a) * 27);
          camera.lookAt(target);
        };
        place();

        const resize = () => {
          const w = host.clientWidth;
          const h = host.clientHeight;
          renderer.setSize(w, h, false);
          camera.aspect = w / h;
          // Shift the picture so the crater sits right of centre, clear of the headline on wide screens.
          if (w >= 900) camera.setViewOffset(w, h, -w * 0.2, 0, w, h);
          else camera.clearViewOffset();
          camera.updateProjectionMatrix();
        };
        resize();
        const ro = new ResizeObserver(resize);
        ro.observe(host);
        let visible = true;
        const io = new IntersectionObserver((e) => (visible = e.some((x) => x.isIntersecting)));
        io.observe(host);

        const anchors = LABELS.map((l) => ({ ...l, v: new THREE.Vector3(l.x, heightKm(l.x, l.z) + 0.6, l.z) }));
        const still = prefersReducedMotion();
        const tmp = new THREE.Vector3();
        let raf = 0;
        let last = performance.now();
        const tick = (now: number) => {
          raf = requestAnimationFrame(tick);
          const dt = Math.min(0.1, (now - last) / 1000);
          last = now;
          if (!visible) return;
          if (!still) {
            orbit += dt * 0.05; // a slow sway of ±20° around the view
            place();
          }
          renderer.render(scene, camera);
          for (const a of anchors) {
            const el = labelRefs.current[a.id];
            if (!el) continue;
            tmp.copy(a.v).project(camera);
            const onScreen = tmp.z < 1 && Math.abs(tmp.x) < 0.95 && Math.abs(tmp.y) < 0.95;
            el.style.opacity = onScreen ? "1" : "0";
            el.style.transform = `translate(${((tmp.x + 1) / 2) * host.clientWidth}px, ${((1 - tmp.y) / 2) * host.clientHeight}px)`;
          }
        };
        raf = requestAnimationFrame(tick);
        setReady(true);

        cleanup = () => {
          cancelAnimationFrame(raf);
          ro.disconnect();
          io.disconnect();
          scene.traverse((o) => {
            const m = o as InstanceType<ThreeModule["Mesh"]>;
            m.geometry?.dispose();
            (m.material as InstanceType<ThreeModule["Material"]> | undefined)?.dispose?.();
          });
          lit.dispose();
          sky.dispose();
          renderer.dispose();
        };
      } catch {
        // The static star image underneath stays; nothing else depends on this view.
      }
    }, 150);
    return () => {
      disposed = true;
      window.clearTimeout(idle);
      cleanup();
    };
  }, []);

  return (
    <div ref={hostRef} aria-hidden="true" className="absolute inset-0 -z-10">
      <canvas
        ref={canvasRef}
        className={`block h-full w-full transition-opacity duration-[1600ms] ease-out ${ready ? "opacity-100" : "opacity-0"}`}
      />
      {LABELS.map((l) => (
        <div
          key={l.id}
          ref={(el) => {
            labelRefs.current[l.id] = el;
          }}
          className="pointer-events-none absolute top-0 left-0 hidden opacity-0 transition-opacity duration-500 md:block"
        >
          <div className="-translate-x-1/2 -translate-y-full pb-1 text-center">
            <p className="border border-rule-strong bg-black/75 px-2 py-0.5 text-[12px] whitespace-nowrap text-ink backdrop-blur-sm">
              {l.title} <span className="font-mono text-[11px] text-ink-2">{l.sub}</span>
            </p>
            <span className="mx-auto block h-6 w-px bg-ink/70" />
          </div>
        </div>
      ))}
    </div>
  );
}
