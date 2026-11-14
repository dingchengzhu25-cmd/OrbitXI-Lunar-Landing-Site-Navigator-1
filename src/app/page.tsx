import { SiteComparison } from "@/components/SiteComparison";

export default function Home() {
  return (
    <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8">
      <header className="mb-6">
        <p className="text-xs font-semibold uppercase tracking-widest text-sky-400">
          Team OrbitXI · NASA Space Apps Challenge 2026
        </p>
        <h1 className="mt-1 text-2xl font-bold text-slate-50 sm:text-3xl">Lunar Landing Site Navigator</h1>
        <p className="mt-2 max-w-3xl text-sm text-slate-300">
          Compare two places on the Moon over the same dates. See where the Sun and Earth sit above or below the
          horizon, and when they rise and set, using ephemeris data from NASA/JPL Horizons.
        </p>
        <p className="mt-2 inline-block rounded bg-slate-800 px-2 py-1 text-xs text-slate-300">
          Development build — geometric angles only; terrain is not modelled. South-pole candidate sites are not yet added.
        </p>
      </header>
      <SiteComparison />
      <footer className="mt-8 border-t border-slate-800 pt-4 text-xs text-slate-500">
        Ephemeris data: NASA/JPL Horizons System (ssd.jpl.nasa.gov/horizons). This project is not affiliated with or
        endorsed by NASA.
      </footer>
    </main>
  );
}
