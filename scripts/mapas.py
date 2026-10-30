"""Mapa por comuna: zonas pobladas, plantación en la franja de 500 m y área quemada 2023-2025 (Colección 1, 2022)."""
import io
import json
import math
import sys
from multiprocessing import Pool

import geopandas as gpd
import matplotlib
import numpy as np
import rasterio
from PIL import Image
from rasterio.windows import Window

matplotlib.use("Agg")
import matplotlib.pyplot as plt

sys.path.insert(0, "scripts")
from franja import distancia_al_borde, PLANTACION, _metros_por_pixel, _ventana, zona_poblada

NATURAL = {3, 11, 12, 66}
COLORES = {
    "fondo": (0.95, 0.95, 0.94), "natural": (0.78, 0.87, 0.76), "agua": (0.70, 0.80, 0.92),
    "plantacion": (0.62, 0.50, 0.25), "franja": (0.93, 0.55, 0.10), "poblado": (0.80, 0.13, 0.11),
}
OUT = "web/public/mapas"
g = gpd.read_file("data/np4/nivel-politico-4.shp").to_crs(4326)
g["geometry"] = g.geometry.make_valid()
slugs = {c["comuna"]: c["slug"] for c in json.load(open("web/public/datos/resumen.json"))["comunas"]}
NOMBRE = {"Los Angeles": "Los Ángeles", "Los Alamos": "Los Álamos", "Coihaique": "Coyhaique"}
filas = [(NOMBRE.get(r.NAME, r.NAME), r.geometry) for r in g.itertuples()]
# Mismo criterio que la ficha: hay mapa si alguna colección tiene al menos 1 ha en la franja de 500 m
con_franja = set()
for c in json.load(open("web/public/datos/resumen.json"))["comunas"]:
    f = json.load(open(f"web/public/datos/comunas/{c['slug']}.json"))
    if f["col1"]["2022"]["plantacion_500m_ha"] >= 1 or f["col2"]["2024"]["plantacion_500m_ha"] >= 1:
        con_franja.add(c["slug"])


def dibujar(args):
    nombre, geom = args
    slug = slugs[nombre]
    if slug not in con_franja:
        return None
    cov = rasterio.open("data/ras/cov_2022.tif")
    fue = [rasterio.open(f"data/ras/fire_{a}.tif") for a in (2023, 2024, 2025)]
    win = _ventana(cov, geom)
    tr = cov.window_transform(win)
    c = cov.read(1, window=win)
    alto, ancho = _metros_por_pixel(tr, 0, c.shape[0])
    area = (alto * ancho / 1e4)[:, None]
    pob = zona_poblada(c, area)
    dist = distancia_al_borde(pob, alto, float(np.median(ancho)))
    col = round((tr.c - fue[0].transform.c) / fue[0].transform.a)
    row = round((tr.f - fue[0].transform.f) / fue[0].transform.e)
    q = np.zeros(c.shape, bool)
    for s in fue:
        q |= s.read(1, window=Window(col, row, c.shape[1], c.shape[0]), boundless=True, fill_value=0) == 1
    img = np.empty(c.shape + (3,), np.float32)
    img[:] = COLORES["fondo"]
    img[np.isin(c, list(NATURAL))] = COLORES["natural"]
    img[c == 33] = COLORES["agua"]
    img[c == PLANTACION] = COLORES["plantacion"]
    img[(c == PLANTACION) & (dist <= 500)] = COLORES["franja"]
    img[pob] = COLORES["poblado"]
    quem = q & ~pob
    img[quem] = img[quem] * 0.42
    ext = (tr.c, tr.c + tr.a * c.shape[1], tr.f + tr.e * c.shape[0], tr.f)
    lat = (ext[2] + ext[3]) / 2
    h_rel = (ext[3] - ext[2]) / ((ext[1] - ext[0]) * math.cos(math.radians(lat)))
    fig = plt.figure(figsize=(8, max(3, min(12, 8 * h_rel))), dpi=110)
    ax = fig.add_axes([0, 0, 1, 1])
    ax.imshow(img, extent=ext, interpolation="nearest")
    gpd.GeoSeries([geom]).boundary.plot(ax=ax, color="#1b1f1d", lw=0.9)
    ax.set_xlim(ext[0], ext[1]); ax.set_ylim(ext[2], ext[3])
    ax.set_aspect(1 / math.cos(math.radians(lat)))
    ax.axis("off")
    buf = io.BytesIO()
    fig.savefig(buf, format="png", dpi=110, facecolor="white")
    Image.open(buf).convert("RGB").save(f"{OUT}/{slug}.webp", "WEBP", quality=82, method=6)  # luego se convierte a WebP
    plt.close(fig)
    return slug


if __name__ == "__main__":
    import os
    os.makedirs(OUT, exist_ok=True)
    with Pool(6) as p:
        hechos = [s for s in p.imap_unordered(dibujar, filas) if s]
    print(len(hechos), "mapas")
