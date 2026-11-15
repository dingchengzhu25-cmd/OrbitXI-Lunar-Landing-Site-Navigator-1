/* eslint-disable @next/next/no-img-element -- one static decorative backdrop */
import { SiteComparison } from "@/components/SiteComparison";

function Wordmark() {
  return (
    <span className="flex items-center gap-2.5">
      <svg width="26" height="26" viewBox="0 0 28 28" aria-hidden="true">
        <circle cx="14" cy="14" r="9" fill="#f3f5f9" />
        <path d="M5 14a9 9 0 0 0 18 0z" fill="#000" opacity=".85" />
        <ellipse cx="14" cy="14" rx="13" ry="4.2" fill="none" stroke="#3d74ff" strokeWidth="1.6" transform="rotate(-18 14 14)" />
      </svg>
      <span className="font-display text-[22px] leading-none font-medium tracking-[-0.01em] text-ink">OrbitXI</span>
    </span>
  );
}

export default function Home() {
  // Set by Vercel at build time; absent in local builds.
  const sha = process.env.VERCEL_GIT_COMMIT_SHA;
  return (
    <>
      <header className="border-b border-rule bg-space">
        <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <Wordmark />
          <p className="flex items-center gap-2 border border-rule px-3 py-1 text-xs text-ink-2">
            <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-accent" />
            Ephemeris from NASA/JPL Horizons, smooth-sphere horizon (no terrain)
          </p>
        </div>
      </header>

      <section className="relative isolate overflow-hidden border-b border-rule" aria-labelledby="h-title">
        <img
          src="/vision/milky-way-core.jpg"
          alt=""
          aria-hidden="true"
          className="absolute inset-0 -z-10 h-full w-full object-cover object-[70%_50%] brightness-[1.7] saturate-[1.15]"
        />
        <div aria-hidden="true" className="absolute inset-0 -z-10 bg-gradient-to-r from-black via-black/70 to-transparent" />
        <div className="mx-auto w-full max-w-6xl px-4 pt-14 pb-12 sm:px-6 sm:pt-20 sm:pb-16">
          <p className="text-sm text-ink-2">Team OrbitXI, NASA Space Apps Challenge 2026</p>
          <h1 id="h-title" className="mt-3 max-w-3xl font-display text-[44px] leading-[0.98] font-light tracking-[-0.025em] text-ink sm:text-[68px]">
            Lunar Landing Site Navigator
          </h1>
          <p className="mt-5 max-w-[34rem] text-base leading-relaxed text-ink-2 sm:text-[17px]">
            Compare two places on the Moon over the same dates. See how high the Sun and Earth are above the local
            horizon, and when each is above it, using position data from NASA/JPL Horizons.
          </p>
          <a
            href="#compare"
            className="mt-7 inline-block rounded-sm border border-ink/70 bg-black/40 px-5 py-2.5 text-[15px] text-ink transition-colors hover:bg-ink hover:text-space"
          >
            Start a comparison
          </a>
        </div>
        <p className="absolute right-4 bottom-2 text-[11px] text-ink-3 sm:right-6">Milky Way: NASA SVS Deep Star Maps 2020</p>
      </section>

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-10 sm:px-6">
        <SiteComparison />
        <footer className="mt-12 border-t border-rule pt-5 text-xs text-ink-3">
          Ephemeris data: NASA/JPL Horizons System (ssd.jpl.nasa.gov/horizons). This project is not affiliated with or
          endorsed by NASA.
          <span data-testid="build-id" className="mt-1 block font-mono">
            Build: {sha ? sha.slice(0, 7) : "local (no commit recorded)"}
          </span>
        </footer>
      </main>
    </>
  );
}
