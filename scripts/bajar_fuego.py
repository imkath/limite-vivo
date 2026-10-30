"""Descarga desde Earth Engine MapBiomas Fuego Chile Colección 1: área quemada anual 2023, 2024 y 2025
(0 = sin quema, 1 = quemado) y frecuencia de quema 2013-2025, en la grilla de los GeoTIFF anuales
oficiales (origen -74,8486 / -32,0205, 18.848 x 44.705 píxeles).

Reemplaza la descarga anónima del almacenamiento público, cerrada el 30 de octubre de 2026."""
import io
import sys
import urllib.request
from concurrent.futures import ThreadPoolExecutor

import ee
import rasterio
from rasterio.transform import Affine
from rasterio.windows import Window

TILE = 1856
R = 0.00026949458523585647
X0, Y0 = -74.84861761965107, -32.020538133968756
ANCHO, ALTO = 18848, 44705
P = "projects/mapbiomas-public/assets/chile/fire/collection1/mapbiomas_chile_fire_collection1_"
ee.Initialize(project="mapbiomas-premio-2026")
anual = ee.Image(P + "annual_burned_v1")
img = ee.Image.cat([anual.select(f"burned_area_{a}").gt(0).rename(f"q{a}") for a in (2023, 2024, 2025)] +
                   [ee.Image(P + "frequency_burned_v1").select("fire_frequency_2013_2025").rename("frecuencia")]).unmask(0).toUint8()

perfil = dict(driver="GTiff", width=ANCHO, height=ALTO, count=1, dtype="uint8", crs="EPSG:4326",
              transform=Affine(R, 0, X0, 0, -R, Y0), compress="deflate", tiled=True, blockxsize=512, blockysize=512)
salidas = [rasterio.open(f"data/ras/{n}.tif", "w", **perfil) for n in ("fire_2023", "fire_2024", "fire_2025", "freq_2013_2025")]
tiles = [(i, j) for i in range(-(-ALTO // TILE)) for j in range(-(-ANCHO // TILE))]


def bajar(t):
    ti, tj = t
    err = None
    for _ in range(5):
        try:
            url = img.getDownloadURL({"crs": "EPSG:4326", "crs_transform": [R, 0, X0 + tj * TILE * R, 0, -R, Y0 - ti * TILE * R],
                                      "dimensions": f"{TILE}x{TILE}", "format": "GEO_TIFF"})
            with rasterio.open(io.BytesIO(urllib.request.urlopen(url, timeout=300).read())) as s:
                return t, s.read()
        except Exception as e:
            err = e
    raise RuntimeError(f"mosaico {t}: {err}")


n = 0
with ThreadPoolExecutor(6) as ex:
    for (ti, tj), a in ex.map(bajar, tiles):
        w = Window(tj * TILE, ti * TILE, TILE, TILE).intersection(Window(0, 0, ANCHO, ALTO))
        for k, s in enumerate(salidas):
            s.write(a[k, : w.height, : w.width], 1, window=w)
        n += 1
        if n % 50 == 0:
            print(n, "/", len(tiles), file=sys.stderr, flush=True)
for s in salidas:
    s.close()
print("listo", file=sys.stderr)
