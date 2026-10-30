"""Sectores expuestos: tramos del borde de cada zona poblada que tienen plantación forestal a menos de 100 m.

Para cada comuna (cobertura 2022, Colección 1):
- el borde de la zona poblada son sus píxeles que tocan algo que no es zona poblada;
- un píxel de borde está expuesto si hay plantación a menos de 100 m de él;
- los píxeles expuestos cercanos (a menos de ~90 m entre sí) forman un tramo, y cada tramo se corta en
  celdas de 0,01° (~1 km) para que un sector sea un trozo de borde que se pueda recorrer;
- cada píxel de plantación a menos de 100 m de la zona poblada se asigna al píxel de borde más cercano,
  y así se suman las hectáreas de plantación de cada sector;
- el nombre es el del lugar de OpenStreetMap más cercano (barrio, población, villa o localidad).
"""
import json
import math
import sys
from multiprocessing import Pool

import geopandas as gpd
import numpy as np
import rasterio
from rasterio.features import geometry_mask
from rasterio.windows import Window
from scipy.ndimage import binary_dilation, binary_erosion, distance_transform_edt, label

sys.path.insert(0, "scripts")
from franja import PLANTACION, _metros_por_pixel, _ventana, distancia_al_borde, zona_poblada

DIST = 100            # m: franja que define un sector expuesto
UNION_PX = 3          # píxeles: tramos expuestos a menos de ~90 m se unen en un mismo sector
CELDA_GRADOS = 0.01   # tamaño máximo aproximado de un sector (~1 km)
LARGO_MIN_M = 90      # m: tramos más cortos se descartan salvo que tengan al menos 0,5 ha de plantación
REGIONES_FUEGO = {"Valparaíso", "Metropolitana de Santiago", "Libertador General Bernardo O'Higgins", "Maule",
                  "Ñuble", "Biobío", "La Araucanía"}
R_TIERRA = 6371008.8


def _lugares():
    d = json.load(open("data/osm_lugares.json"))["elements"]
    return np.array([[e["lat"], e["lon"]] for e in d]), [e["tags"]["name"] for e in d]


LUG_XY, LUG_NOM = _lugares()


def lugar_cercano(lat, lon):
    dy = np.radians(LUG_XY[:, 0] - lat) * R_TIERRA
    dx = np.radians(LUG_XY[:, 1] - lon) * R_TIERRA * math.cos(math.radians(lat))
    d = np.hypot(dx, dy)
    i = int(np.argmin(d))
    return LUG_NOM[i], float(d[i])


def sectores_comuna(args):
    nombre, region, geom = args
    cov = rasterio.open("data/ras/cov_2022.tif")
    win = _ventana(cov, geom)
    tr = cov.window_transform(win)
    c = cov.read(1, window=win)
    alto, ancho = _metros_por_pixel(tr, 0, c.shape[0])
    area = (alto * ancho / 1e4)[:, None]
    ancho_m = float(np.median(ancho))
    dentro = ~geometry_mask([geom], out_shape=c.shape, transform=tr)
    pob = zona_poblada(c, area)
    plant = c == PLANTACION
    if not pob.any() or not plant.any():
        return []

    borde = pob & ~binary_erosion(pob)
    # Distancia de cada píxel al borde de la plantación más cercana
    d_plant = distancia_al_borde(plant, alto, ancho_m)
    expuesto = borde & dentro & (d_plant <= DIST)
    if not expuesto.any():
        return []
    grupos, _ = label(binary_dilation(expuesto, iterations=UNION_PX))
    # Cortar cada tramo por celdas de ~1 km: sector = (tramo, celda)
    ys, xs = np.indices(c.shape)
    lat_px = tr.f + tr.e * (ys + 0.5)
    lon_px = tr.c + tr.a * (xs + 0.5)
    celda = (np.floor(lat_px / CELDA_GRADOS).astype(np.int64) * 100000 + np.floor(lon_px / CELDA_GRADOS).astype(np.int64))
    clave = np.where(expuesto, grupos.astype(np.int64) * 10**12 + celda, -1)
    unicos, inv = np.unique(clave[expuesto], return_inverse=True)
    etiqueta = np.zeros(c.shape, np.int64)
    etiqueta[expuesto] = inv + 1
    n = len(unicos)
    del ys, xs, lat_px, lon_px, celda, clave

    # Cada píxel de plantación a menos de 100 m se asigna al píxel de zona poblada más cercano
    d_pob, (iy, ix) = distance_transform_edt(~pob, sampling=(alto, ancho_m), return_indices=True)
    d_pob = np.maximum(d_pob - (alto + ancho_m) / 4, 0)
    cerca = plant & (d_pob <= DIST)
    asignado = etiqueta[iy[cerca], ix[cerca]]
    ha_plant = np.bincount(asignado, weights=np.broadcast_to(area, c.shape)[cerca], minlength=n + 1)

    quem = None
    if region in REGIONES_FUEGO:
        fue = [rasterio.open(f"data/ras/fire_{a}.tif") for a in (2023, 2024, 2025)]
        col = round((tr.c - fue[0].transform.c) / fue[0].transform.a)
        row = round((tr.f - fue[0].transform.f) / fue[0].transform.e)
        q = np.zeros(c.shape, bool)
        for s in fue:
            q |= s.read(1, window=Window(col, row, c.shape[1], c.shape[0]), boundless=True, fill_value=0) == 1
        qc = q[cerca]
        quem = np.bincount(asignado[qc], weights=np.broadcast_to(area, c.shape)[cerca][qc], minlength=n + 1)

    out = []
    for k in range(1, n + 1):
        m = etiqueta == k
        npx = int(m.sum())
        if npx == 0:
            continue
        largo = npx * math.sqrt(alto * ancho_m)  # aproximación del largo del borde expuesto
        if largo < LARGO_MIN_M and ha_plant[k] < 0.5:
            continue
        ys, xs = np.nonzero(m)
        lat = tr.f + tr.e * (ys.mean() + 0.5)
        lon = tr.c + tr.a * (xs.mean() + 0.5)
        lugar, dist_lugar = lugar_cercano(lat, lon)
        out.append({
            "comuna": nombre, "region": region,
            "lat": round(float(lat), 5), "lon": round(float(lon), 5),
            "borde_m": round(largo), "plantacion_100m_ha": round(float(ha_plant[k]), 1),
            "quemada_ha": None if quem is None else round(float(quem[k]), 1),
            "lugar": lugar, "lugar_m": round(dist_lugar),
        })
    return out


if __name__ == "__main__":
    g = gpd.read_file("data/np4/nivel-politico-4.shp").to_crs(4326)
    g["geometry"] = g.geometry.make_valid()
    tareas = [(r.NAME, r.LEVEL_2, r.geometry) for r in g.itertuples()]
    if len(sys.argv) > 1:
        tareas = [t for t in tareas if t[0] in sys.argv[1:]]
    with Pool(6) as p:
        res = [s for lista in p.imap_unordered(sectores_comuna, tareas) for s in lista]
    res.sort(key=lambda s: -s["plantacion_100m_ha"])
    destino = "out/sectores.json" if len(sys.argv) == 1 else "out/sectores_prueba.json"
    json.dump(res, open(destino, "w"), ensure_ascii=False)
    print(len(res), "sectores")
    for s in res[:15]:
        print(s)
