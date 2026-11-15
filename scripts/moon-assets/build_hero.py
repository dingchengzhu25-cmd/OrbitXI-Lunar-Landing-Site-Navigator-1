"""Hero terrain: the 81.92 km LOLA 20 m/px window centred on the lunar south pole
(NASA GSFC PGDA LDEM_80S_20MPP_ADJ, Barker et al. 2023), read from the remote GeoTIFF (or a local cache at ../nasa_dem20/window.npy).
Raster row 0 = +y (toward 0° E), col 0 = -x, polar stereographic, R = 1737.4 km."""
import json, os, numpy as np
from PIL import Image
import build_moon_assets as B
def fetch_window():
    """The 4096 x 4096 px window centred on the pole, read from the remote GeoTIFF tiles."""
    src = B.PolarLOLA()
    r0 = c0 = (src.W - 4096) // 2          # pole at the raster centre
    rows = np.arange(r0, r0 + 4096) + 0.5   # sample pixel centres exactly
    rr, cc = np.meshgrid(rows, rows, indexing="ij")
    return src._bilinear(rr - 0.5, cc - 0.5)
cache = os.path.join(os.path.dirname(B.REPO), "nasa_dem20", "window.npy")
w = (np.load(cache) if os.path.exists(cache) else fetch_window()).astype(np.float64)
assert w.shape == (4096, 4096) and np.isfinite(w).all()
out = os.path.join(B.REPO, "public/vision/hero"); os.makedirs(out, exist_ok=True)
meta = {"sizeM": 81920.0, "minM": float(w.min()), "maxM": float(w.max()),
        "source": "NASA GSFC PGDA LOLA 20 m/px south-polar elevation (LDEM_80S_20MPP_ADJ, Barker et al. 2023)",
        "sourceUrl": "https://pgda.gsfc.nasa.gov/products/90"}
json.dump(meta, open(os.path.join(out, "southpole.json"), "w"), indent=1)
# Shackleton centre (IAU: 89.67 S, 129.78 E) in scene km: x east-ish = stereo x, z = -stereo y
import math
rho = 2 * B.R * math.tan(math.radians(45 + (-89.67) / 2)); l = math.radians(129.78)
print(meta, "shackleton scene km:", round(rho*math.sin(l)/1000, 2), round(-rho*math.cos(l)/1000, 2))

# ---------------------------------------------------------------- baked lighting at full 20 m resolution
# Sun direction in scene coordinates (x = raster columns, z = raster rows downward), matching HeroTerrain.tsx.
import math
SUN_EL, SUN_AZ = 4.5, -128.0
def bake(h, px=20.0, el=SUN_EL, az=SUN_AZ, out_px=4096):
    """Lambert shading x cast shadows, both computed from the LOLA heights themselves.
    Shadows: horizon scan toward the Sun on a grid rotated so the Sun lies along -columns,
    including the drop of the Moon's curvature."""
    sx, sz = math.sin(math.radians(az)), math.cos(math.radians(az))
    # rotate so the sun direction (sx, sz) points to -col (left): angle of sun dir in image coords
    ang = math.degrees(math.atan2(sz, sx))           # 0 = +col, 90 = +row
    pad = Image.fromarray(h.astype(np.float32))
    rot = np.array(pad.rotate(ang - 180, resample=Image.BILINEAR, expand=True, fillcolor=-1e5), dtype=np.float64)
    valid = rot > -5e4
    rot[~valid] = -1e5
    tan = math.tan(math.radians(el)); R = 1737400.0
    horizon = np.full(rot.shape, -np.inf)
    k = 1; steps = []
    while k < 2600:                                   # up to ~52 km toward the Sun
        steps.append(k); k = k + max(1, int(k * 0.035))
    for k in steps:
        d = k * px
        cand = rot[:, :-k] - d * tan - d * d / (2 * R)
        np.maximum(horizon[:, k:], cand, out=horizon[:, k:])
    shadow_r = (horizon > rot + 0.5).astype(np.float32)
    shadow_r[~valid] = 0
    sh = Image.fromarray(shadow_r * 255).convert("L").rotate(180 - ang, resample=Image.BILINEAR, expand=True)
    W2, H2 = sh.size; Wn = h.shape[1]
    sh = sh.crop(((W2 - Wn) // 2, (H2 - Wn) // 2, (W2 - Wn) // 2 + Wn, (H2 - Wn) // 2 + Wn))
    shadow = np.array(sh, dtype=np.float64) / 255.0
    # Lambert from the 20 m normals; light vector in (col, up, row) = (sx cos el, sin el, sz cos el)
    gy, gx = np.gradient(h)
    nx, nz = -gx / px, -gy / px
    nrm = np.sqrt(nx * nx + nz * nz + 1)
    lam = (nx * sx * math.cos(math.radians(el)) + math.sin(math.radians(el)) + nz * sz * math.cos(math.radians(el))) / nrm
    lam = np.clip(lam, 0, 1)
    lit = 0.012 + 1.0 * lam * (1 - shadow)
    img = np.clip(lit * 0.62, 0, 1) ** (1 / 2.2)     # albedo ~0.62 grey, to sRGB
    im = Image.fromarray((img * 255 + 0.5).astype(np.uint8), "L")
    return im.resize((out_px, out_px), Image.LANCZOS), float(shadow.mean())

im, frac = bake(w)
im.save(os.path.join(out, "southpole_lit_4k.jpg"), quality=86, optimize=True, progressive=True)
im.resize((2048, 2048), Image.LANCZOS).save(os.path.join(out, "southpole_lit_2k.jpg"), quality=86, optimize=True)
N2 = 1025
mesh = np.array(Image.fromarray(w.astype(np.float32)).resize((N2, N2), Image.BOX), dtype=np.float64)
mesh.round().astype("<i2").tofile(os.path.join(out, "southpole_height_1k.bin"))
meta.update({"n": N2, "sunElDeg": SUN_EL, "sunAzSceneDeg": SUN_AZ, "shadowFraction": round(frac, 3)})
json.dump(meta, open(os.path.join(out, "southpole.json"), "w"), indent=1)
print("baked; shadowed fraction", round(frac, 3))
