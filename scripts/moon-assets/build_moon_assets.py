"""
Build the web assets for the OrbitXI Moon views from NASA data. Nothing here is simulated:
every height comes from LRO LOLA, every colour from LRO LROC WAC.

Inputs
  - NASA SVS CGI Moon Kit (svs.gsfc.nasa.gov/4720), downloaded beforehand:
      lroc_color_poles_8k.tif   LROC WAC colour mosaic, equirectangular, centred on 0° lon
      ldem_16_uint.tif          LOLA elevation, 16 px/deg, uint16 half-metres, offset +20000,
                                relative to the 1737.4 km reference sphere
  - Read remotely with HTTP range requests (only the needed rows/tiles):
      NASA SVS ldem_64_uint.tif                         LOLA 64 px/deg (~474 m at the equator)
      NASA GSFC PGDA product 90, LDEM_80S_20MPP_ADJ.TIF LOLA 20 m/px south-polar stereographic
                                                        (Barker et al. 2023), R = 1737.4 km

Outputs (public/vision/moon, public/vision/terrain)
Run: python3 scripts/moon-assets/build_moon_assets.py [globe] [tiles]   (needs numpy, Pillow, curl)
  moon/lroc_color_4k.jpg     4096x2048 colour
  moon/lola_normal_4k.jpg    4096x2048 tangent-space normal map from ldem_16 (relief x NORMAL_EX)
  moon/lola_height_1k.bin    1024x512 int16 metres (globe vertex displacement)
  terrain/<id>.bin           N x N int16 metres, north-up local grid centred on the site
  terrain/<id>_n.jpg         normal map of the same tile (true scale)
  terrain/index.json         per-tile metadata
"""
import io, json, math, os, struct, sys, urllib.request, zlib, functools
import numpy as np
from PIL import Image

Image.MAX_IMAGE_PIXELS = None
HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.dirname(os.path.dirname(HERE))
# Downloaded inputs live outside the repo (they are large): set MOON_KIT_DIR, default ../nasa_moonkit
KIT = os.environ.get("MOON_KIT_DIR", os.path.join(os.path.dirname(REPO), "nasa_moonkit"))
OUT_MOON = os.path.join(REPO, "public/vision/moon")
OUT_TER = os.path.join(REPO, "public/vision/terrain")
R = 1737400.0

def http_range(url, a, n, tries=6):
    import subprocess
    for i in range(tries):
        r = subprocess.run(["curl", "-sS", "--fail", "-A", "orbitxi-asset-build", "-r", f"{a}-{a+n-1}", url], capture_output=True)
        if r.returncode == 0 and len(r.stdout) == n:
            return r.stdout
        print("  retry", i + 1, r.returncode, r.stderr.decode()[:120], file=sys.stderr)
    raise RuntimeError(f"range read failed {url} {a}+{n}")

# ---------------------------------------------------------------- normal maps
def normal_map(h, dx, dy, strength=1.0):
    """Tangent-space normals (OpenGL convention: +x east, +y north) from a north-up height grid.
    h[row, col]: row 0 = north edge. dx, dy: metres per pixel (dx may be an array per row)."""
    gy, gx = np.gradient(h.astype(np.float64))
    dzdx = gx / dx * strength
    dzdn = -gy / dy * strength          # rows increase southward
    n = np.stack([-dzdx, -dzdn, np.ones_like(h, dtype=np.float64)], axis=-1)
    n /= np.linalg.norm(n, axis=-1, keepdims=True)
    return Image.fromarray(np.clip((n * 0.5 + 0.5) * 255 + 0.5, 0, 255).astype(np.uint8), "RGB")

# ---------------------------------------------------------------- global globe
def build_globe():
    os.makedirs(OUT_MOON, exist_ok=True)
    col = Image.open(os.path.join(KIT, "lroc_color_poles_8k.tif")).convert("RGB")
    col.resize((4096, 2048), Image.LANCZOS).save(os.path.join(OUT_MOON, "lroc_color_4k.jpg"), quality=86, progressive=True, optimize=True)

    raw = np.array(Image.open(os.path.join(KIT, "ldem_16_uint.tif")), dtype=np.float64)
    hm = (raw - 20000.0) / 2.0                                   # metres above 1737.4 km
    print("ldem_16 metres: min %.0f max %.0f" % (hm.min(), hm.max()))
    # Globe displacement grid: area-mean down to 1024x512, int16 metres.
    small = np.array(Image.fromarray(hm.astype(np.float32), "F").resize((1024, 512), Image.BOX), dtype=np.float64)
    small.round().astype("<i2").tofile(os.path.join(OUT_MOON, "lola_height_1k.bin"))
    # Normal map at 4096x2048 from the 16 px/deg data.
    big = np.array(Image.fromarray(hm.astype(np.float32), "F").resize((4096, 2048), Image.BICUBIC), dtype=np.float64)
    lat = 90 - (np.arange(2048) + 0.5) / 2048 * 180
    dy = math.pi * R / 2048
    dx = (2 * math.pi * R / 4096) * np.maximum(np.cos(np.radians(lat)), 0.02)[:, None]
    normal_map(big, dx, dy, strength=NORMAL_EX).save(os.path.join(OUT_MOON, "lola_normal_4k.jpg"), quality=88, optimize=True)
    return {"globeHeightMin": float(small.min()), "globeHeightMax": float(small.max())}

NORMAL_EX = 6.0   # relief exaggeration baked into the globe normal map; stated on the figure

# ---------------------------------------------------------------- remote readers
class PolarLOLA:
    """PGDA LDEM_80S_20MPP_ADJ: BigTIFF, 512 px deflate tiles, float predictor."""
    URL = "https://pgda.gsfc.nasa.gov/data/LOLA_20mpp/LDEM_80S_20MPP_ADJ.TIF"
    PX = 20.0; X0 = -304000.0; Y0 = 304000.0; W = 30400; T = 512
    def __init__(self):
        h = http_range(self.URL, 0, 16); assert h[:4] == b"II+\x00"
        off = struct.unpack("<Q", h[8:16])[0]; d = http_range(self.URL, off, 8192)
        n = struct.unpack("<Q", d[:8])[0]; t = {}
        for i in range(n):
            e = d[8 + i * 20:28 + i * 20]; tag, typ = struct.unpack("<HH", e[:4]); cnt, v = struct.unpack("<QQ", e[4:20]); t[tag] = (typ, cnt, v)
        def arr(tag):
            typ, cnt, v = t[tag]; f, sz = {4: ("I", 4), 16: ("Q", 8)}[typ]
            return struct.unpack("<" + f * cnt, http_range(self.URL, v, sz * cnt))
        assert t[256][2] == self.W and t[322][2] == self.T
        self.offs, self.cnts = arr(324), arr(325); self.nt = math.ceil(self.W / self.T)
    @functools.lru_cache(None)
    def tile(self, tr, tc):
        k = tr * self.nt + tc
        raw = np.frombuffer(zlib.decompress(http_range(self.URL, self.offs[k], self.cnts[k])), np.uint8).reshape(self.T, 4 * self.T)
        b = np.cumsum(raw, axis=1, dtype=np.uint8)
        return b.reshape(self.T, 4, self.T).transpose(0, 2, 1).copy().view(">f4").reshape(self.T, self.T).astype(np.float64)
    def sample(self, lat, lon):
        rho = 2 * R * np.tan(np.radians(45 + lat / 2)); l = np.radians(lon)
        x, y = rho * np.sin(l), rho * np.cos(l)
        # node_offset=1 (pixel-is-area): pixel centres at X0 + (c+0.5)*PX
        c = (x - self.X0) / self.PX - 0.5; r = (self.Y0 - y) / self.PX - 0.5
        return self._bilinear(r, c)
    def _bilinear(self, r, c):
        r0 = np.floor(r).astype(int); c0 = np.floor(c).astype(int); fr = r - r0; fc = c - c0
        out = np.zeros(r.shape)
        def px(rr, cc):
            vals = np.empty(rr.shape)
            trs, tcs = rr // self.T, cc // self.T
            for tr, tc in set(zip(trs.ravel().tolist(), tcs.ravel().tolist())):
                m = (trs == tr) & (tcs == tc)
                vals[m] = self.tile(tr, tc)[rr[m] - tr * self.T, cc[m] - tc * self.T]
            return vals
        out = (px(r0, c0) * (1 - fr) * (1 - fc) + px(r0, c0 + 1) * (1 - fr) * fc +
               px(r0 + 1, c0) * fr * (1 - fc) + px(r0 + 1, c0 + 1) * fr * fc)
        return out

class GlobalLOLA64:
    """SVS ldem_64_uint.tif: uncompressed, one row per strip, uint16 half-metres offset +20000."""
    URL = "https://svs.gsfc.nasa.gov/vis/a000000/a004700/a004720/ldem_64_uint.tif"
    W = 23040; H = 11520; PPD = 64
    def __init__(self):
        self.offs = struct.unpack("<" + "I" * self.H, http_range(self.URL, 530887938, 4 * self.H))
        assert all(self.offs[i + 1] - self.offs[i] == 2 * self.W for i in range(0, self.H - 1, 997))
    def rows(self, r0, r1):
        d = http_range(self.URL, self.offs[r0], self.offs[r1] - self.offs[r0] + 2 * self.W)
        return (np.frombuffer(d, "<u2").reshape(r1 - r0 + 1, self.W).astype(np.float64) - 20000.0) / 2.0
    def sample(self, lat, lon):
        # pixel centres: row i at lat 90-(i+0.5)/64; col j at lon -180+(j+0.5)/64
        r = (90 - lat) * self.PPD - 0.5; c = ((lon + 180) % 360) * self.PPD - 0.5
        r0 = int(np.floor(r.min())) - 1; r1 = int(np.ceil(r.max())) + 2
        block = self.rows(r0, r1)
        rr = r - r0; i0 = np.floor(rr).astype(int); fr = rr - i0
        j0 = np.floor(c).astype(int); fc = c - j0
        j0m = j0 % self.W; j1m = (j0 + 1) % self.W
        return (block[i0, j0m] * (1 - fr) * (1 - fc) + block[i0, j1m] * (1 - fr) * fc +
                block[i0 + 1, j0m] * fr * (1 - fc) + block[i0 + 1, j1m] * fr * fc)

# ---------------------------------------------------------------- local north-up grids
def local_grid(lat0, lon0, size_m, n):
    """Exact inverse azimuthal-equidistant grid centred on the site; row 0 = north edge."""
    s = (np.arange(n) - (n - 1) / 2) * (size_m / (n - 1))
    e, nn = np.meshgrid(s, -s)                       # east to the right, north up
    d = np.hypot(e, nn) / R; th = np.arctan2(e, nn)
    p0, l0 = math.radians(lat0), math.radians(lon0)
    lat = np.arcsin(np.sin(p0) * np.cos(d) + np.cos(p0) * np.sin(d) * np.cos(th))
    lon = l0 + np.arctan2(np.sin(th) * np.sin(d) * math.cos(p0), np.cos(d) - math.sin(p0) * np.sin(lat))
    return np.degrees(lat), (np.degrees(lon) + 540) % 360 - 180

SITES = [  # id, name, lat, lon (east) — copied from src/lib/sites.ts presets
    ("nobile-rim-1-reference", "Nobile Rim 1", -85.4381, 37.36667),
    ("malapert-massif-reference", "Malapert Massif", -85.9948, -0.23578),
]

def build_tiles():
    os.makedirs(OUT_TER, exist_ok=True)
    sites = list(SITES)
    sites_ts = open(os.path.join(REPO, "src/lib/sites.ts")).read()
    import re
    # Apollo presets are generated by apollo(n, lat, lon) calls; Tycho is a literal object.
    for m in re.finditer(r"apollo\((\d+),\s*(-?[\d.]+),\s*(-?[\d.]+)\)", sites_ts):
        sites.append((f"apollo{m.group(1)}", f"Apollo {m.group(1)}", float(m.group(2)), float(m.group(3))))
    sites.append(("tycho-example", "Tycho crater (Horizons example)", -43.3, 348.8))
    polar = PolarLOLA(); glob = GlobalLOLA64()
    index = []
    for sid, name, lat, lon in sites:
        if lat <= -80.5:
            size, n, nn, src = 24000.0, 257, 1024, polar
            res = "LOLA 20 m/px south-polar model (NASA GSFC PGDA, Barker et al. 2023)"
            src_url = "https://pgda.gsfc.nasa.gov/products/90"
        else:
            size, n, nn, src = 120000.0, 257, 512, glob
            res = "LOLA 64 px/deg global model (~470 m/px; NASA SVS CGI Moon Kit)"
            src_url = "https://svs.gsfc.nasa.gov/4720"
        la, lo = local_grid(lat, lon, size, nn)
        hfine = src.sample(la, lo)
        assert np.isfinite(hfine).all(), sid
        # mesh grid: sample the fine grid at n x n
        idx = np.round(np.linspace(0, nn - 1, n)).astype(int)
        hmesh = hfine[np.ix_(idx, idx)]
        hmesh.round().astype("<i2").tofile(os.path.join(OUT_TER, f"{sid}.bin"))
        px = size / (nn - 1)
        normal_map(hfine, px, px, 1.0).save(os.path.join(OUT_TER, f"{sid}_n.jpg"), quality=88, optimize=True)
        meta = {"id": sid, "name": name, "latDeg": lat, "lonEastDeg": lon, "sizeM": size, "n": n,
                "minM": float(hmesh.min()), "maxM": float(hmesh.max()), "source": res, "sourceUrl": src_url}
        index.append(meta)
        print(f"{sid:28s} size={size/1000:.0f} km relief={hmesh.max()-hmesh.min():.0f} m centre={hfine[nn//2, nn//2]:.0f} m")
    json.dump(index, open(os.path.join(OUT_TER, "index.json"), "w"), indent=1)

if __name__ == "__main__":
    what = sys.argv[1:] or ["globe", "tiles"]
    if "globe" in what: print(build_globe())
    if "tiles" in what: build_tiles()
