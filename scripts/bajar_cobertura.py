"""Descarga desde Earth Engine la cobertura de MapBiomas Chile Colección 1 (2000 y 2022) y el raster de
comunas (nivel político 4) en la grilla nativa del asset, por mosaicos.

Reemplaza la descarga de los GeoTIFF del almacenamiento público de MapBiomas, que dejó de aceptar
descargas anónimas el 30 de octubre de 2026. El asset de Earth Engine es la misma Colección 1.
"""
import io
import sys
import urllib.request
from concurrent.futures import ThreadPoolExecutor

import ee
import numpy as np
import rasterio
from rasterio.transform import Affine
from rasterio.windows import Window

TILE = 1856
ee.Initialize(project="mapbiomas-premio-2026")
cob = ee.Image("projects/mapbiomas-public/assets/chile/collection1/mapbiomas_chile_collection1_integration_v1")
ter = ee.ImageCollection("projects/mapbiomas-territories/assets/TERRITORIES/LULC/CHILE/COLLECTION2/territory-collection") \
    .filter(ee.Filter.eq("system:index", "95_POLITICAL_LEVEL_4_1")).first()
img = cob.select(["classification_2000", "classification_2022"]).unmask(0).toUint16() \
    .addBands(ter.rename("comuna").unmask(0).toUint16())

info = cob.getInfo()["bands"][0]
r, _, x0, _, _, y0 = info["crs_transform"]
ancho, alto = info["dimensions"]
# Solo los mosaicos que tocan el territorio continental cubierto por las comunas (lon -75,7 a -66,4)
c0, c1 = int((-75.75 - x0) / r) // TILE, int((-66.35 - x0) / r) // TILE
f0, f1 = int((y0 + 17.9) / r) // TILE, int((y0 + 56.6) / r) // TILE
tiles = [(i, j) for i in range(max(f0, 0), f1 + 1) for j in range(max(c0, 0), c1 + 1)]
print("mosaicos:", len(tiles), file=sys.stderr, flush=True)

perfil = dict(driver="GTiff", width=ancho, height=alto, count=1, crs="EPSG:4326", transform=Affine(r, 0, x0, 0, -r, y0),
              compress="deflate", tiled=True, blockxsize=512, blockysize=512, BIGTIFF="YES", SPARSE_OK=True)
salidas = [rasterio.open("data/ras/cov_2000.tif", "w", dtype="uint8", **perfil),
           rasterio.open("data/ras/cov_2022.tif", "w", dtype="uint8", **perfil),
           rasterio.open("data/ras/comunas_n4.tif", "w", dtype="uint16", **perfil)]


def bajar(t):
    ti, tj = t
    err = None
    for _ in range(5):
        try:
            url = img.getDownloadURL({"crs": "EPSG:4326", "crs_transform": [r, 0, x0 + tj * TILE * r, 0, -r, y0 - ti * TILE * r],
                                      "dimensions": f"{TILE}x{TILE}", "format": "GEO_TIFF"})
            with rasterio.open(io.BytesIO(urllib.request.urlopen(url, timeout=300).read())) as s:
                return t, s.read()
        except Exception as e:
            err = e
    raise RuntimeError(f"mosaico {t}: {err}")


n = 0
with ThreadPoolExecutor(8) as ex:
    for (ti, tj), a in ex.map(bajar, tiles):
        w = Window(tj * TILE, ti * TILE, TILE, TILE).intersection(Window(0, 0, ancho, alto))
        if a.any():
            for k, s in enumerate(salidas):
                s.write(a[k, : w.height, : w.width].astype(s.dtypes[0]), 1, window=w)
        n += 1
        if n % 50 == 0:
            print(n, "/", len(tiles), file=sys.stderr, flush=True)
for s in salidas:
    s.close()
print("listo", file=sys.stderr)
