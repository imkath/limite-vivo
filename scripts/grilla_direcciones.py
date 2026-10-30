"""Grilla de direcciones para Límite Vivo: distancia a plantación forestal por celda de ~100 m.

Para cada comuna de Chile, ubica sus zonas pobladas (MapBiomas Chile Colección 1, 2022) y genera
una grilla de celdas de 0,001 grados (~100 m) que cubre esas zonas más un margen de 200 m. Por
celda calcula: distancia en metros al píxel de plantación forestal (clase 9) más cercano (tope
3.000 m), hectáreas de plantación en un radio de 500 m, y si hubo área quemada 2023-2025 a menos
de 500 m (MapBiomas Fuego, solo en su zona de cobertura: Valparaíso a La Araucanía).

Elección de grilla: celdas de 0,001° en vez de bloques de 4x4 píxeles (0,00108°, casi lo mismo)
porque el tamaño en grados es fijo y permite ubicar la celda de una coordenada con una simple
división entera, sin reproyectar. A la latitud de Chile (-18° a -56°) una celda de 0,001° mide
entre 111 m (norte-sur, constante) y entre 105 y 62 m (este-oeste, según la latitud): "~100 m" es
una aproximación razonable para todo el país, un poco más angosta en el sur.

Salida: web/public/datos/grilla/<lat0>_<lon0>.json por tile de 0,1°x0,1° (nombrado por su esquina
inferior izquierda) y web/public/datos/grilla/indice.json con los tiles existentes y los slugs.
"""
import glob
import json
import math
import os
import sys
import time
from pathlib import Path

import geopandas as gpd
import numpy as np
import rasterio
from rasterio.features import geometry_mask
from rasterio.windows import Window, from_bounds
from scipy.signal import fftconvolve

sys.path.insert(0, os.path.dirname(__file__))
from franja import _metros_por_pixel, distancia_al_borde, zona_poblada  # noqa: E402

RAIZ_MB = str(Path(__file__).resolve().parent.parent / "data")
RAIZ_W = Path(__file__).resolve().parent.parent / "web"
OUT = RAIZ_W / "public" / "datos" / "grilla"
OUT.mkdir(parents=True, exist_ok=True)

CELL = 0.001  # grados (~100 m)
TILE = 0.1  # grados
CELLS_POR_TILE = round(TILE / CELL)  # 100
MARGEN_POBLADO_M = 200  # margen alrededor de la zona poblada
RADIO_HA_M = 500  # radio para hectáreas de plantación y quema cercana
TOPE_DIST_M = 3000  # tope de distancia a plantación
MARGEN_VENTANA_M = TOPE_DIST_M + RADIO_HA_M + 300  # colchón para que el tope de 3.000 m no se corte
R_TIERRA = 6371008.8

REGIONES_FUEGO = {"Valparaíso", "Metropolitana de Santiago", "Libertador General Bernardo O'Higgins", "Maule",
                  "Ñuble", "Biobío", "La Araucanía"}


def log(*a):
    print(f"[{time.strftime('%H:%M:%S')}]", *a, flush=True)


def ventana_bounds(src, minx, miny, maxx, maxy):
    w = from_bounds(minx, miny, maxx, maxy, transform=src.transform)
    w = w.round_offsets().round_lengths()
    return w.intersection(Window(0, 0, src.width, src.height))


def disco_kernel(alto, ancho, radio_m):
    """Kernel booleano elíptico en píxeles cuyo radio físico es radio_m en cada eje."""
    ri = max(1, math.ceil(radio_m / alto))
    rj = max(1, math.ceil(radio_m / ancho))
    di = np.arange(-ri, ri + 1)[:, None] * alto
    dj = np.arange(-rj, rj + 1)[None, :] * ancho
    return (di ** 2 + dj ** 2) <= radio_m ** 2


def cargar_comunas():
    gdf = gpd.read_file(f"{RAIZ_MB}/np4/nivel-politico-4.shp").to_crs(4326)
    comunas = {}
    for f in glob.glob(str(RAIZ_W / "public" / "datos" / "comunas" / "*.json")):
        r = json.load(open(f))
        comunas[norm(r["comuna"])] = r
    import re
    import unicodedata

    def _norm(s):
        s = unicodedata.normalize("NFKD", s).encode("ascii", "ignore").decode().lower()
        s = re.sub(r"[^a-z]", "", s)
        return {"coihaique": "coyhaique"}.get(s, s)

    gdf["slug_meta"] = gdf["NAME"].map(lambda n: comunas.get(_norm(n)))
    faltan = gdf[gdf["slug_meta"].isna()]
    if len(faltan):
        raise SystemExit(f"Comunas sin match: {faltan.NAME.tolist()}")
    return gdf


def norm(s):
    import re
    import unicodedata
    s = unicodedata.normalize("NFKD", s).encode("ascii", "ignore").decode().lower()
    s = re.sub(r"[^a-z]", "", s)
    return {"coihaique": "coyhaique"}.get(s, s)


def procesar_comuna(row, cov_src, fire_srcs):
    geom = row.geometry
    meta = row["slug_meta"]
    slug = meta["slug"]

    # Paso 1: ventana chica sobre la propia comuna, para ubicar sus zonas pobladas.
    minx, miny, maxx, maxy = geom.bounds
    margen0 = 0.01
    win0 = ventana_bounds(cov_src, minx - margen0, miny - margen0, maxx + margen0, maxy + margen0)
    if win0.width <= 0 or win0.height <= 0:
        return None
    c0 = cov_src.read(1, window=win0)
    tr0 = cov_src.window_transform(win0)
    alto0, ancho0 = _metros_por_pixel(tr0, 0, win0.height)
    area_ha0 = (alto0 * ancho0 / 1e4)[:, None]
    poblado0 = zona_poblada(c0, area_ha0)
    if not poblado0.any():
        return None

    # Paso 2: ventana final alrededor de las zonas pobladas, con el margen necesario para el
    # tope de distancia y el radio de hectáreas, para no desperdiciar cómputo en comunas enormes
    # con ciudades pequeñas (el norte y la Patagonia).
    filas, cols = np.where(poblado0)
    lat_max = tr0.f + filas.min() * tr0.e
    lat_min = tr0.f + (filas.max() + 1) * tr0.e
    lon_min = tr0.c + cols.min() * tr0.a
    lon_max = tr0.c + (cols.max() + 1) * tr0.a
    lat_centro = (lat_min + lat_max) / 2
    margen_lat = MARGEN_VENTANA_M / 111_320
    margen_lon = MARGEN_VENTANA_M / (111_320 * max(math.cos(math.radians(lat_centro)), 0.05))
    win = ventana_bounds(cov_src, lon_min - margen_lon, lat_min - margen_lat, lon_max + margen_lon, lat_max + margen_lat)
    if win.width <= 0 or win.height <= 0:
        return None

    c = cov_src.read(1, window=win)
    tr = cov_src.window_transform(win)
    alto, ancho = _metros_por_pixel(tr, 0, win.height)
    ancho_medio = float(np.median(ancho))
    area_ha = (alto * ancho / 1e4)[:, None]

    plant = c == 9
    poblado = zona_poblada(c, area_ha)
    if not poblado.any():
        return None
    dist_pobl = distancia_al_borde(poblado, alto, ancho_medio)
    # Solo se asignan a esta comuna los píxeles que están efectivamente dentro de su polígono:
    # las zonas urbanas conurbadas (p. ej. Valparaíso-Viña del Mar) comparten una sola mancha
    # poblada que cruza el límite administrativo, así que sin este filtro una comuna se adueñaría
    # de toda la mancha vecina.
    dentro = ~geometry_mask([geom], out_shape=c.shape, transform=tr)
    elegible = (dist_pobl <= MARGEN_POBLADO_M) & dentro
    if not elegible.any():
        return None

    if plant.any():
        # Distancia hasta el borde de la plantación, igual que en el cálculo principal
        dist_plant = distancia_al_borde(plant, alto, ancho_medio)
    else:
        dist_plant = np.full(c.shape, TOPE_DIST_M + 1, dtype=np.float32)
    dist_plant_cap = np.minimum(dist_plant, TOPE_DIST_M)

    kernel = disco_kernel(alto, ancho_medio, RADIO_HA_M).astype(np.float32)
    ha500 = fftconvolve(plant.astype(np.float32) * area_ha.astype(np.float32), kernel, mode="same")
    ha500 = np.clip(ha500, 0, None)

    quema = None
    if meta["fuego_cubierta"] and fire_srcs:
        quemado = np.zeros(c.shape, dtype=bool)
        cubierto = np.zeros(c.shape, dtype=bool)
        ref = fire_srcs[0]
        col0 = round((tr.c - ref.transform.c) / ref.transform.a)
        row0 = round((tr.f - ref.transform.f) / ref.transform.e)
        h, w = c.shape
        if not (col0 + w <= 0 or row0 + h <= 0 or col0 >= ref.width or row0 >= ref.height):
            fwin = Window(col0, row0, w, h)
            for src in fire_srcs:
                quemado |= src.read(1, window=fwin, boundless=True, fill_value=0) == 1
            cubierto[max(0, -row0):max(0, min(h, ref.height - row0)), max(0, -col0):max(0, min(w, ref.width - col0))] = True
            quemado &= cubierto
            quema_cerca = fftconvolve(quemado.astype(np.float32), kernel, mode="same") > 0.5
            quema = quema_cerca

    # Celdas candidatas: una por cada píxel elegible, reducidas a su celda de 0,001°.
    filas_e, cols_e = np.where(elegible)
    lat_px = tr.f + (filas_e + 0.5) * tr.e
    lon_px = tr.c + (cols_e + 0.5) * tr.a
    i = np.floor(lat_px / CELL).astype(np.int64)
    j = np.floor(lon_px / CELL).astype(np.int64)
    claves = np.unique(np.stack([i, j], axis=1), axis=0)

    lat_c = (claves[:, 0] + 0.5) * CELL
    lon_c = (claves[:, 1] + 0.5) * CELL
    # Índice del píxel más cercano al centro de cada celda (muestreo por vecino más próximo).
    pf = np.clip(np.round((lat_c - tr.f) / tr.e - 0.5).astype(np.int64), 0, c.shape[0] - 1)
    pc = np.clip(np.round((lon_c - tr.c) / tr.a - 0.5).astype(np.int64), 0, c.shape[1] - 1)

    salida = []
    for k in range(len(claves)):
        f, co = pf[k], pc[k]
        d = int(round(min(float(dist_plant_cap[f, co]), TOPE_DIST_M)))
        h5 = round(float(ha500[f, co]) * 10)
        q = -1
        if quema is not None:
            q = 1 if quema[f, co] else 0
        salida.append((int(claves[k, 0]), int(claves[k, 1]), d, int(h5), q, slug))
    return salida


def main():
    gdf = cargar_comunas()
    with rasterio.open(f"{RAIZ_MB}/ras/cov_2022.tif") as cov_src:
        fire_srcs = [rasterio.open(f"{RAIZ_MB}/ras/fire_{a}.tif") for a in (2023, 2024, 2025)]
        try:
            tiles = {}  # (ti,tj) -> {(li,lj): (d,h5,q,slug)}
            t0 = time.time()
            n_celdas = 0
            for n, (_, row) in enumerate(gdf.iterrows()):
                res = procesar_comuna(row, cov_src, fire_srcs)
                if not res:
                    continue
                n_celdas += len(res)
                for i, j, d, h5, q, slug in res:
                    ti, tj = i // CELLS_POR_TILE, j // CELLS_POR_TILE
                    li, lj = i - ti * CELLS_POR_TILE, j - tj * CELLS_POR_TILE
                    tile = tiles.setdefault((ti, tj), {})
                    clave = li * CELLS_POR_TILE + lj
                    if clave not in tile:
                        tile[clave] = (d, h5, q, slug)
                if n % 20 == 0:
                    log(f"{n}/{len(gdf)} comunas, {n_celdas} celdas, {time.time() - t0:.0f}s")
        finally:
            for s in fire_srcs:
                s.close()

    log(f"Total: {n_celdas} celdas en {len(tiles)} tiles")
    indice = {"cell": CELL, "tile": TILE, "cells_por_tile": CELLS_POR_TILE, "tope_dist_m": TOPE_DIST_M,
              "radio_ha_m": RADIO_HA_M, "tiles": []}
    tam_total = 0
    for (ti, tj), celdas in tiles.items():
        lat0, lon0 = round(ti * TILE, 1), round(tj * TILE, 1)
        slugs = sorted({v[3] for v in celdas.values()})
        idx_slug = {s: k for k, s in enumerate(slugs)}
        filas = sorted(
            (clave, d, h5, q, idx_slug[slug]) for clave, (d, h5, q, slug) in celdas.items()
        )
        nombre = f"{lat0}_{lon0}.json"
        data = {"slugs": slugs, "celdas": [list(f) for f in filas]}
        texto = json.dumps(data, separators=(",", ":"))
        (OUT / nombre).write_text(texto)
        tam_total += len(texto)
        indice["tiles"].append(nombre[:-5])
    indice["tiles"].sort()
    (OUT / "indice.json").write_text(json.dumps(indice, separators=(",", ":")))
    log(f"Tamaño total grilla: {tam_total / 1e6:.2f} MB en {len(tiles)} tiles")
    mas_pesado = max(((OUT / f"{t}.json").stat().st_size, t) for t in indice["tiles"]) if indice["tiles"] else (0, "")
    log(f"Tile más pesado: {mas_pesado[1]}.json = {mas_pesado[0] / 1e6:.3f} MB")


if __name__ == "__main__":
    main()
