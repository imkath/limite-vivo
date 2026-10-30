"""Descarga la Colección 2 de MapBiomas Chile desde Earth Engine, en mosaicos alineados
a la grilla de la Colección 1 y de Fuego, solo para las comunas con plantación forestal."""
import io
import json
import math
import sys
import urllib.request
from concurrent.futures import ThreadPoolExecutor

import ee
import geopandas as gpd
import numpy as np
import rasterio
from rasterio.windows import Window

ANIOS = (2000, 2022, 2024)
TILE = 1856  # píxeles por lado (~0,5°)
ee.Initialize(project="mapbiomas-premio-2026")
img = ee.Image("projects/mapbiomas-chile/assets/LULC/COLLECTION-02/CLASSIFICATIONS/classification-final/clasificacion-final-2")
img = img.select([f"classification_{a}" for a in ANIOS]).unmask(0).toUint8()

ref = rasterio.open("data/ras/cov_2022.tif")
r, x0, y0 = ref.transform.a, ref.transform.c, ref.transform.f

# Comunas con plantación en cualquiera de las dos colecciones
f1 = json.load(open("out/franja_col1.json"))
indice = json.load(open("out/indice.json"))["comunas"]
col2 = {c["comuna"]: json.load(open(f"out/comunas/{c['slug']}.json"))["grupos"].get("plantacion", [0]) for c in indice}
g = gpd.read_file("data/np4/nivel-politico-4.shp").to_crs(4326)
sel = g[[f1[str(fid)]["2022"]["plantacion_ha"] >= 1 or f1[str(fid)]["2000"]["plantacion_ha"] >= 1
         or max(col2.get(n, [0]) or [0]) >= 1 for fid, n in zip(g.FEATURE_ID, g.NAME)]]
print("comunas con plantación:", len(sel), file=sys.stderr)

tiles = set()
for minx, miny, maxx, maxy in sel.bounds.values:
    c0 = int((minx - 0.012 - x0) / r) // TILE
    c1 = int((maxx + 0.012 - x0) / r) // TILE
    r0 = int((y0 - maxy - 0.012) / r) // TILE
    r1 = int((y0 - miny + 0.012) / r) // TILE
    tiles |= {(ti, tj) for ti in range(r0, r1 + 1) for tj in range(c0, c1 + 1)}
tiles = sorted(tiles)
print("mosaicos:", len(tiles), file=sys.stderr)

perfil = ref.profile.copy()
perfil.update(count=1, compress="deflate", tiled=True, blockxsize=512, blockysize=512, nodata=None, BIGTIFF="YES", SPARSE_OK=True)
salidas = {a: rasterio.open(f"data/ras/col2_{a}.tif", "w", **perfil) for a in ANIOS}


def bajar(t):
    ti, tj = t
    for intento in range(4):
        try:
            url = img.getDownloadURL({
                "crs": "EPSG:4326",
                "crs_transform": [r, 0, x0 + tj * TILE * r, 0, -r, y0 - ti * TILE * r],
                "dimensions": f"{TILE}x{TILE}",
                "format": "GEO_TIFF",
            })
            data = urllib.request.urlopen(url, timeout=300).read()
            with rasterio.open(io.BytesIO(data)) as s:
                return t, s.read()
        except Exception as e:  # reintento ante cortes de red o cuota
            err = e
    raise RuntimeError(f"mosaico {t}: {err}")


hechos = 0
with ThreadPoolExecutor(8) as ex:
    for (ti, tj), arr in ex.map(bajar, tiles):
        w = Window(tj * TILE, ti * TILE, TILE, TILE).intersection(Window(0, 0, ref.width, ref.height))
        for k, a in enumerate(ANIOS):
            salidas[a].write(arr[k, : w.height, : w.width], 1, window=w)
        hechos += 1
        if hechos % 25 == 0:
            print(hechos, "/", len(tiles), file=sys.stderr, flush=True)
for s in salidas.values():
    s.close()
print("listo", len(tiles))
