"""Verifica celdas al azar de la grilla de direcciones contra un cálculo directo sobre el ráster.

Para cada celda se toma el píxel más cercano a su centro y se busca, por fuerza bruta, el píxel de plantación
más cercano (distancia en metros con el tamaño de píxel de esa latitud, hasta su borde). Se compara con la
distancia guardada en la grilla, que viene de la transformada de distancia.
"""
import glob
import json
import math
import random

import numpy as np
import rasterio
from rasterio.windows import Window

R = 6371008.8
ind = json.load(open("web/public/datos/grilla/indice.json"))
CELL, CPT, TOPE = ind["cell"], ind["cells_por_tile"], ind["tope_dist_m"]
cov = rasterio.open("data/ras/cov_2022.tif")
random.seed(30)
archivos = random.sample(sorted(glob.glob("web/public/datos/grilla/*_*.json")), 40)

difs = []
for a in archivos:
    if len(difs) >= 12:
        break
    t = json.load(open(a))
    lat0, lon0 = (float(x) for x in a.split("/")[-1][:-5].split("_"))
    ti, tj = round(lat0 / 0.1), round(lon0 / 0.1)
    cand = [c for c in t["celdas"] if 0 < c[1] < TOPE]
    if not cand:
        continue
    clave, d, h5, q, s = random.choice(cand)
    li, lj = divmod(clave, CPT)
    lat = ((ti * CPT + li) + 0.5) * CELL
    lon = ((tj * CPT + lj) + 0.5) * CELL
    # píxel más cercano al centro de la celda
    fila, col = rasterio.transform.rowcol(cov.transform, lon, lat)
    alto = math.radians(-cov.transform.e) * R
    ancho = math.radians(cov.transform.a) * R * math.cos(math.radians(lat))
    rad = int(TOPE / min(alto, ancho)) + 5
    w = Window(col - rad, fila - rad, 2 * rad + 1, 2 * rad + 1)
    c = cov.read(1, window=w, boundless=True, fill_value=0)
    ys, xs = np.nonzero(c == 9)
    dist = np.hypot((ys - rad) * alto, (xs - rad) * ancho).min() - (alto + ancho) / 4
    dist = max(dist, 0)
    difs.append(d - dist)
    print(f"{lat:.4f},{lon:.4f}  grilla {d} m  directo {dist:.0f} m  diferencia {d - dist:+.0f} m")

print(f"celdas revisadas {len(difs)}; diferencia máxima {max(abs(x) for x in difs):.0f} m")
