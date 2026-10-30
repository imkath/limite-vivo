"""Personas que viven junto a plantación forestal, por comuna, con la cartografía del Censo 2024 (INE).

Para cada comuna:
- se toma la plantación forestal de 2022 (MapBiomas Chile, Colección 1) y la distancia de cada píxel
  al borde de la plantación más cercana, con la misma función del cálculo principal;
- cada manzana del Censo 2024 (urbanas y de aldeas) se lleva a la grilla de ~30 m de MapBiomas (cada
  píxel queda con la manzana que contiene su centro) y se mide su distancia mínima a la plantación (el
  píxel de la manzana más cercano a ella); las manzanas más chicas que un píxel se miden en un punto
  interior;
- una manzana está a menos de D metros si alguna parte de ella lo está, y entonces cuentan todas sus
  personas, viviendas y grupos de edad.

Alcance: las manzanas cubren al 89 % de la población censada (16,19 de 18,23 millones). Quedan fuera
las personas de entidades rurales dispersas, porque el INE las publica en polígonos de Thiessen que
describe como referencia estadística y no como ubicación de las viviendas.

La cartografía del INE viene en SIRGAS 2000 (EPSG:4674), que difiere de WGS 84 en menos de un metro;
se usa tal cual sobre la grilla de MapBiomas.
"""
import json
import os
import sys
import time
from multiprocessing import Pool

import numpy as np

sys.path.insert(0, os.path.dirname(__file__))
from franja import PLANTACION, _metros_por_pixel, _ventana, distancia_al_borde  # noqa: E402

DISTANCIAS = (100, 500)
CAMPOS = {
    "personas": ["n_per"],
    "viviendas": ["n_vp_ocupada"],
    "ninos_0_13": ["n_edad_0_5", "n_edad_6_13"],
    "mayores_60": ["n_edad_60_mas"],
    "dificultad_mover": ["n_dificultad_mover"],
}
COLUMNAS = sorted({c for v in CAMPOS.values() for c in v})
MANZANAS = "data/censo/Cartografia_censo2024_Pais_Manzanas.parquet"


def exposicion(dist_manzana, tabla, distancias=DISTANCIAS):
    """dist_manzana: distancia mínima (m) de cada manzana a la plantación; tabla: dict campo -> array."""
    out = {"total": {k: float(sum(np.nansum(tabla[c]) for c in cols)) for k, cols in CAMPOS.items()}}
    for d in distancias:
        dentro = dist_manzana <= d
        out[f"{d}m"] = {k: float(sum(np.nansum(tabla[c][dentro]) for c in cols)) for k, cols in CAMPOS.items()}
    return out


def comuna(args):
    import geopandas as gpd
    import rasterio
    from rasterio.features import rasterize
    from scipy.ndimage import minimum

    fid, cut, geom = args
    mz = gpd.read_parquet(MANZANAS, columns=["CUT", "SHAPE"] + COLUMNAS, filters=[("CUT", "==", cut)])
    if mz.empty:
        return fid, None
    src = rasterio.open("data/ras/cov_2022.tif")
    win = _ventana(src, geom)
    tr = src.window_transform(win)
    c = src.read(1, window=win)
    alto, ancho = _metros_por_pixel(tr, 0, c.shape[0])
    plant = c == PLANTACION
    tabla = {k: mz[k].to_numpy(dtype=float) for k in COLUMNAS}
    if not plant.any():
        return fid, exposicion(np.full(len(mz), np.inf), tabla)
    dist = distancia_al_borde(plant, alto, float(np.median(ancho)))
    # Cada píxel queda con la manzana que contiene su centro (las manzanas no se superponen, así que
    # ninguna tapa a otra). Las manzanas más chicas que un píxel no reciben ninguno: esas se miden en un
    # punto interior de la manzana.
    etiquetas = rasterize(((g, i + 1) for i, g in enumerate(mz.geometry)), out_shape=c.shape, transform=tr,
                          all_touched=False, dtype="int32")
    presentes = np.zeros(len(mz), bool)
    presentes[np.unique(etiquetas[etiquetas > 0]) - 1] = True
    dmin = np.full(len(mz), np.inf)
    idx = np.nonzero(presentes)[0] + 1
    if len(idx):
        dmin[presentes] = minimum(dist, labels=etiquetas, index=idx)
    inv = ~tr
    for i in np.nonzero(~presentes)[0]:
        pt = mz.geometry.iloc[i].representative_point()
        col, fila = (int(v) for v in inv * (pt.x, pt.y))
        if 0 <= fila < c.shape[0] and 0 <= col < c.shape[1]:
            dmin[i] = dist[fila, col]
            presentes[i] = True
    r = exposicion(dmin, tabla)
    # Sensibilidad: misma cuenta, pero midiendo la distancia en un punto interior de cada manzana (criterio más estricto)
    dcentro = np.full(len(mz), np.inf)
    for i, g in enumerate(mz.geometry):
        pt = g.representative_point()
        col, fila = (int(v) for v in inv * (pt.x, pt.y))
        if 0 <= fila < c.shape[0] and 0 <= col < c.shape[1]:
            dcentro[i] = dist[fila, col]
    centro = exposicion(dcentro, tabla)
    r["centro"] = {d: centro[d] for d in ("100m", "500m")}
    r["manzanas"] = int(len(mz))
    r["manzanas_fuera_de_ventana"] = int((~presentes).sum())
    return fid, r


if __name__ == "__main__":
    import geopandas as gpd
    g = gpd.read_file("data/np4/nivel-politico-4.shp").to_crs(4326)
    g["geometry"] = g.geometry.make_valid()
    t0 = time.time()
    res = {}
    with Pool(int(os.environ.get("PROCESOS", "4"))) as p:
        tareas = [(str(r.FEATURE_ID), int(r.CUT), r.geometry) for r in g.itertuples()]
        for i, (fid, r) in enumerate(p.imap_unordered(comuna, tareas)):
            res[fid] = r
            if i % 50 == 0:
                print(i, round(time.time() - t0), "s", flush=True)
    json.dump(res, open("out/poblacion_censo2024.json", "w"))
    tot = {d: sum((v or {}).get(d, {}).get("personas", 0) for v in res.values()) for d in ("100m", "500m", "total")}
    print(len(res), "comunas;", {k: round(v) for k, v in tot.items()}, "en", round(time.time() - t0), "s")
