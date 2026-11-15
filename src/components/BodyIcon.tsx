/* eslint-disable @next/next/no-img-element -- tiny static icons; next/image adds nothing here */

/**
 * Real full-disk images: the Sun from NASA SDO/HMI (14 Nov 2026) and Earth from NASA's EPIC
 * camera on DSCOVR (11 Nov 2026). Decorative identification only; credited in Data sources.
 * Earth keeps a thin light-blue ring so it stays distinct from the Sun at small sizes.
 */
export function BodyIcon({ body, size = 16, className = "" }: { body: "Sun" | "Earth"; size?: number; className?: string }) {
  return (
    <img
      src={body === "Sun" ? "/vision/sun_sdo.png" : "/vision/earth_epic.png"}
      alt=""
      aria-hidden="true"
      width={size}
      height={size}
      className={`inline-block shrink-0 rounded-full align-[-0.2em] ${body === "Earth" ? "ring-1 ring-earth/70" : ""} ${className}`}
    />
  );
}
