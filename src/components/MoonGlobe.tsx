"use client";

import { useEffect, useRef, useState } from "react";
import { GLOBE_RELIEF_EXAGGERATION, latLonToUnit, MOON_RADIUS_M, sampleEquirect, surfaceDistanceKm } from "@/lib/moonGeo";
import { fetchInt16, loadThree, prefersReducedMotion, webglAvailable, whenNearViewport, type ThreeModule } from "./threeRuntime";

export interface GlobePin {
  site: "A" | "B";
  label: string;
  latDeg: number;
  lonEastDeg: number;
  color: string;
}

type Phase = "waiting" | "loading" | "ready" | "unsupported" | "failed";

const HEIGHT_W = 1024;
const HEIGHT_H = 512;
const fmtLat = (v: number) => `${Math.abs(v).toFixed(2)}° ${v < 0 ? "S" : "N"}`;
const fmtLon = (v: number) => {
  const w = ((((v + 180) % 360) + 360) % 360) - 180;
  return `${Math.abs(w).toFixed(2)}° ${w < 0 ? "W" : "E"}`;
};

/**
 * Where the two sites are on the Moon: NASA LRO LROC WAC colour on LOLA elevation (relief
 * exaggerated, stated on the figure). The pins use exactly the coordinates in the site form.
 * Context only: the visibility results do not use this terrain.
 */
export function MoonGlobe({ pins }: { pins: GlobePin[] }) {
  const hostRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const labelRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const apiRef = useRef<{ setPins: (p: GlobePin[]) => void; reset: () => void } | null>(null);
  const pinsRef = useRef(pins);
  const [phase, setPhase] = useState<Phase>("waiting");

  useEffect(() => {
    pinsRef.current = pins;
    apiRef.current?.setPins(pins);
  }, [pins]);

  useEffect(() => {
    const host = hostRef.current;
    const canvas = canvasRef.current;
    if (!host || !canvas) return;
    let disposed = false;
    let cleanup = () => {};

    const stopObserving = whenNearViewport(host, async () => {
      if (!webglAvailable()) {
        setPhase("unsupported");
        return;
      }
      setPhase("loading");
      try {
        const [{ THREE, OrbitControls }, heights] = await Promise.all([loadThree(), fetchInt16("/vision/moon/lola_height_1k.bin")]);
        if (disposed) return;
        const texLoader = new THREE.TextureLoader();
        const [colorMap, normalMap] = await Promise.all([
          texLoader.loadAsync("/vision/moon/lroc_color_4k.jpg"),
          texLoader.loadAsync("/vision/moon/lola_normal_4k.jpg"),
        ]);
        if (disposed) return;

        const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
        renderer.setPixelRatio(Math.min(2, window.devicePixelRatio));
        renderer.outputColorSpace = THREE.SRGBColorSpace;
        renderer.toneMapping = THREE.ACESFilmicToneMapping;
        renderer.toneMappingExposure = 1.15;
        const maxAniso = renderer.capabilities.getMaxAnisotropy();
        colorMap.colorSpace = THREE.SRGBColorSpace;
        colorMap.anisotropy = maxAniso;
        normalMap.anisotropy = maxAniso;

        const scene = new THREE.Scene();
        const camera = new THREE.PerspectiveCamera(30, 1, 0.01, 50);
        scene.add(camera);
        scene.add(new THREE.AmbientLight(0xffffff, 0.08));
        // Illustrative lighting, carried with the camera so the side you look at is lit.
        const key = new THREE.DirectionalLight(0xfff4e6, 3.1);
        key.position.set(-2.2, 1.3, 1.6);
        camera.add(key);
        scene.add(key.target);

        // Globe: LOLA heights displace the sphere (exaggerated); normals stay radial because the
        // baked normal map already carries the relief shading.
        const geo = new THREE.SphereGeometry(1, 512, 256);
        const pos = geo.getAttribute("position");
        const uv = geo.getAttribute("uv");
        const ex = GLOBE_RELIEF_EXAGGERATION / MOON_RADIUS_M;
        const poleMean = (row: number) => {
          let s = 0;
          for (let c = 0; c < HEIGHT_W; c++) s += heights[row * HEIGHT_W + c];
          return s / HEIGHT_W;
        };
        const northPole = poleMean(0);
        const southPole = poleMean(HEIGHT_H - 1);
        for (let i = 0; i < pos.count; i++) {
          const lat = uv.getY(i) * 180 - 90;
          const lon = uv.getX(i) * 360 - 180;
          const h =
            lat > 89.999 ? northPole : lat < -89.999 ? southPole : sampleEquirect(heights, HEIGHT_W, HEIGHT_H, lat, lon);
          const k = 1 + h * ex;
          pos.setXYZ(i, pos.getX(i) * k, pos.getY(i) * k, pos.getZ(i) * k);
        }
        pos.needsUpdate = true;
        const moon = new THREE.Mesh(
          geo,
          new THREE.MeshStandardMaterial({ map: colorMap, normalMap, normalScale: new THREE.Vector2(1, 1), roughness: 1, metalness: 0 }),
        );
        scene.add(moon);
        const surfaceRadius = (lat: number, lon: number) => 1 + sampleEquirect(heights, HEIGHT_W, HEIGHT_H, lat, lon) * ex;

        // Graticule every 30°, very faint: reads as an instrument, not decoration.
        const grat: number[] = [];
        const R = 1.03;
        for (let lat = -60; lat <= 60; lat += 30)
          for (let lon = -180; lon < 180; lon += 2) {
            grat.push(...latLonToUnit(lat, lon).map((v) => v * R), ...latLonToUnit(lat, lon + 2).map((v) => v * R));
          }
        for (let lon = -180; lon < 180; lon += 30)
          for (let lat = -90; lat < 90; lat += 2) {
            grat.push(...latLonToUnit(lat, lon).map((v) => v * R), ...latLonToUnit(lat + 2, lon).map((v) => v * R));
          }
        const gratGeo = new THREE.BufferGeometry();
        gratGeo.setAttribute("position", new THREE.Float32BufferAttribute(grat, 3));
        const gratLines = new THREE.LineSegments(gratGeo, new THREE.LineBasicMaterial({ color: 0x9fb4d8, transparent: true, opacity: 0.1, depthWrite: false }));
        scene.add(gratLines);

        // Pins
        const pinGroup = new THREE.Group();
        scene.add(pinGroup);
        let pinAnchors: { site: string; top: InstanceType<ThreeModule["Vector3"]>; normal: InstanceType<ThreeModule["Vector3"]> }[] = [];
        const buildPins = (list: GlobePin[]) => {
          pinGroup.children.slice().forEach((c) => {
            pinGroup.remove(c);
            c.traverse((o) => {
              const m = o as InstanceType<ThreeModule["Mesh"]>;
              m.geometry?.dispose();
              (m.material as InstanceType<ThreeModule["Material"]> | undefined)?.dispose?.();
            });
          });
          pinAnchors = list.map((p) => {
            const n = new THREE.Vector3(...latLonToUnit(p.latDeg, p.lonEastDeg));
            const base = n.clone().multiplyScalar(surfaceRadius(p.latDeg, p.lonEastDeg));
            const top = n.clone().multiplyScalar(surfaceRadius(p.latDeg, p.lonEastDeg) + 0.075);
            const color = new THREE.Color(p.color);
            const stem = new THREE.Mesh(
              new THREE.CylinderGeometry(0.0022, 0.0022, 0.075, 8),
              new THREE.MeshBasicMaterial({ color, toneMapped: false }),
            );
            stem.position.copy(base.clone().add(top).multiplyScalar(0.5));
            stem.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), n);
            const head = new THREE.Mesh(new THREE.SphereGeometry(0.011, 20, 12), new THREE.MeshBasicMaterial({ color, toneMapped: false }));
            head.position.copy(top);
            const ring = new THREE.Mesh(
              new THREE.RingGeometry(0.012, 0.017, 40),
              new THREE.MeshBasicMaterial({ color, toneMapped: false, side: THREE.DoubleSide, transparent: true, opacity: 0.95, depthWrite: false }),
            );
            ring.position.copy(n.clone().multiplyScalar(surfaceRadius(p.latDeg, p.lonEastDeg) + 0.002));
            ring.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), n);
            pinGroup.add(stem, head, ring);
            return { site: p.site, top, normal: n };
          });
        };

        const controls = new OrbitControls(camera, canvas);
        controls.enableDamping = true;
        controls.dampingFactor = 0.08;
        controls.enablePan = false;
        controls.minDistance = 1.35;
        controls.maxDistance = 6;
        controls.rotateSpeed = 0.6;
        controls.zoomSpeed = 0.7;

        // Frame both pins: look from a point above their midpoint, tilted so polar sites
        // are seen obliquely with the globe's limb in view.
        const framing = (list: GlobePin[]) => {
          const mid = new THREE.Vector3();
          for (const p of list) mid.add(new THREE.Vector3(...latLonToUnit(p.latDeg, p.lonEastDeg)));
          if (mid.lengthSq() < 1e-6) mid.set(1, 0, 0);
          mid.normalize();
          const lat = (Math.asin(mid.y) * 180) / Math.PI;
          const lon = (Math.atan2(mid.z, -mid.x) * 180) / Math.PI - 180;
          // Polar pairs are seen obliquely (from 70°) so the whole polar cap and the limb are in view.
          const viewLat = Math.max(-70, Math.min(70, lat));
          // Farthest pin from the view centre (angle on the sphere), then the camera distance that
          // keeps it inside ~60% of the half-height of a 30° field of view.
          const view = new THREE.Vector3(...latLonToUnit(viewLat, lon));
          let theta = 0;
          for (const p of list) theta = Math.max(theta, view.angleTo(new THREE.Vector3(...latLonToUnit(p.latDeg, p.lonEastDeg))));
          theta = Math.min(theta, Math.PI / 2);
          const dist = Math.min(4.8, Math.max(3.05, Math.cos(theta) + Math.sin(theta) / 0.16));
          return view.multiplyScalar(dist);
        };
        let flight: { from: InstanceType<ThreeModule["Vector3"]>; to: InstanceType<ThreeModule["Vector3"]>; t0: number } | null = null;
        const flyTo = (target: InstanceType<ThreeModule["Vector3"]>) => {
          if (prefersReducedMotion()) {
            camera.position.copy(target);
            controls.update();
            return;
          }
          flight = { from: camera.position.clone(), to: target, t0: performance.now() };
        };

        buildPins(pinsRef.current);
        camera.position.copy(framing(pinsRef.current));
        controls.update();
        apiRef.current = {
          setPins: (list) => {
            buildPins(list);
            flyTo(framing(list));
          },
          reset: () => flyTo(framing(pinsRef.current)),
        };

        const resize = () => {
          const w = host.clientWidth;
          const h = host.clientHeight;
          renderer.setSize(w, h, false);
          camera.aspect = w / h;
          camera.updateProjectionMatrix();
        };
        resize();
        const ro = new ResizeObserver(resize);
        ro.observe(host);

        const tmp = new THREE.Vector3();
        const camDir = new THREE.Vector3();
        let raf = 0;
        let visible = true;
        const io = new IntersectionObserver((e) => (visible = e.some((x) => x.isIntersecting)));
        io.observe(host);
        const tick = (now: number) => {
          raf = requestAnimationFrame(tick);
          if (!visible) return;
          if (flight) {
            const t = Math.min(1, (now - flight.t0) / 1100);
            const e = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
            const len = flight.from.length() + (flight.to.length() - flight.from.length()) * e;
            const dir = flight.from.clone().normalize().lerp(flight.to.clone().normalize(), e);
            if (dir.lengthSq() < 1e-6) dir.copy(flight.to).normalize();
            camera.position.copy(dir.normalize().multiplyScalar(len));
            if (t >= 1) flight = null;
          }
          controls.update();
          renderer.render(scene, camera);
          // HTML labels follow their pins and hide on the far side of the Moon.
          camDir.copy(camera.position).normalize();
          const placed = pinAnchors.map((a) => {
            tmp.copy(a.top).project(camera);
            return { a, x: ((tmp.x + 1) / 2) * host.clientWidth, y: ((1 - tmp.y) / 2) * host.clientHeight };
          });
          // With two pins, the left-hand one is labelled on its left so the labels never overlap.
          const leftmost = placed.length === 2 ? (placed[0].x <= placed[1].x ? placed[0].a.site : placed[1].a.site) : null;
          for (const { a, x, y } of placed) {
            const el = labelRefs.current[a.site];
            if (!el) continue;
            const dx = a.site === leftmost ? -el.offsetWidth - 10 : 10;
            el.style.opacity = a.normal.dot(camDir) > 0.12 ? "1" : "0";
            el.style.transform = `translate(${x + dx}px, ${y}px)`;
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
            const mat = m.material as InstanceType<ThreeModule["Material"]> | InstanceType<ThreeModule["Material"]>[] | undefined;
            (Array.isArray(mat) ? mat : mat ? [mat] : []).forEach((x) => x.dispose());
          });
          colorMap.dispose();
          normalMap.dispose();
          renderer.dispose();
          apiRef.current = null;
        };
      } catch {
        if (!disposed) setPhase("failed");
      }
    });

    return () => {
      disposed = true;
      stopObserving();
      cleanup();
    };
  }, []);

  const distance = pins.length === 2 ? surfaceDistanceKm(pins[0], pins[1]) : null;

  return (
    <figure className="flex flex-col self-start border border-rule bg-black lg:sticky lg:top-4" aria-labelledby="fig-globe-cap">
      <div ref={hostRef} className="relative isolate h-[340px] overflow-hidden sm:h-[460px] lg:h-[520px]" data-testid="moon-globe">
        <div
          aria-hidden="true"
          className="absolute inset-0 -z-10 bg-[url('/vision/milky-way-core.jpg')] bg-cover bg-center opacity-35"
        />
        <canvas
          ref={canvasRef}
          className="block h-full w-full cursor-grab touch-none active:cursor-grabbing"
          role="img"
          aria-label={`Rotatable 3D Moon from NASA LRO imagery and LOLA elevation, with ${pins.map((p) => `Site ${p.site}, ${p.label}, at ${fmtLat(p.latDeg)}, ${fmtLon(p.lonEastDeg)}`).join("; and ")}.`}
        />
        {pins.map((p) => (
          <div
            key={p.site}
            ref={(el) => {
              labelRefs.current[p.site] = el;
            }}
            aria-hidden="true"
            className="pointer-events-none absolute top-0 left-0 opacity-0 transition-opacity duration-200"
          >
            <span
              className="-translate-y-1/2 inline-flex items-center gap-1.5 whitespace-nowrap border bg-black/75 px-1.5 py-0.5 text-[11px] text-ink backdrop-blur-sm"
              style={{ borderColor: p.color }}
            >
              <b style={{ color: p.color }}>{p.site}</b> {p.label}
            </span>
          </div>
        ))}
        {phase !== "ready" && (
          <div className="absolute inset-0 flex items-center justify-center p-6 text-center text-sm text-ink-2">
            {phase === "unsupported"
              ? "3D view needs WebGL, which this browser has turned off. The site coordinates are listed below."
              : phase === "failed"
                ? "The NASA Moon imagery could not be loaded. The site coordinates are listed below."
                : "Loading NASA LRO imagery and LOLA elevation…"}
          </div>
        )}
        <div className="pointer-events-none absolute top-3 left-3 font-mono text-[11px] text-ink-3">
          Drag to rotate · scroll or pinch to zoom
        </div>
        {phase === "ready" && (
          <button
            type="button"
            onClick={() => apiRef.current?.reset()}
            className="absolute top-2.5 right-2.5 border border-rule-strong bg-black/70 px-2.5 py-1 text-xs text-ink-2 backdrop-blur-sm transition-colors hover:text-ink"
          >
            Frame both sites
          </button>
        )}
      </div>
      <figcaption id="fig-globe-cap" className="border-t border-rule px-4 py-3 text-xs leading-relaxed text-ink-3">
        <dl className="mb-2 grid gap-x-6 gap-y-1 font-mono text-[12px] text-ink-2 sm:grid-cols-[auto_auto_1fr]">
          {pins.map((p) => (
            <div key={p.site} className="contents">
              <dt className="truncate">
                <b style={{ color: p.color }}>{p.site}</b> <span className="font-sans text-ink">{p.label}</span>
              </dt>
              <dd className="sm:col-span-2">
                {fmtLat(p.latDeg)}, {fmtLon(p.lonEastDeg)}
              </dd>
            </div>
          ))}
          {distance !== null && (
            <div className="contents">
              <dt className="font-sans text-ink-3">Separation</dt>
              <dd className="sm:col-span-2">
                ≈ {distance < 10 ? distance.toFixed(1) : Math.round(distance).toLocaleString("en-US")} km{" "}
                <span className="font-sans text-ink-3">(great circle on the 1737.4 km sphere)</span>
              </dd>
            </div>
          )}
        </dl>
        Site locations shown on NASA LRO LROC WAC colour over LOLA elevation (NASA SVS CGI Moon Kit). Relief exaggerated
        ×{GLOBE_RELIEF_EXAGGERATION}; lighting is illustrative. Context only: visibility results use a smooth sphere with
        no terrain.
      </figcaption>
    </figure>
  );
}
