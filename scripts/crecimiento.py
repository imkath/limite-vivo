"""Quién se acercó a quién: de dónde viene la plantación que hoy está junto a las zonas pobladas.

Para cada comuna y distancia D (100 y 500 m), la plantación del año final a menos de D de una zona
poblada se separa, píxel a píxel, en tres partes que suman exacto:

    franja final = ya_estaba + llego_ciudad + plantacion_nueva

- ya_estaba: la plantación existía al inicio (fue plantación en algún año entre 2000 y 2005) y ya
  estaba a menos de D de una zona poblada en 2000.
- llego_ciudad: la plantación existía al inicio pero estaba a más de D de las casas; quedó a menos de D
  porque la zona poblada creció hacia ella.
- plantacion_nueva: no fue plantación en ningún año entre 2000 y 2005 y hoy lo es, junto a las casas.

Se usa la ventana 2000-2005 y no solo el año 2000 porque la plantación se cosecha y se replanta: un
rodal talado justo en 2000 aparece ese año con otra clase, y sin esta ventana se contaría como nuevo.

Además se guardan la franja inicial, lo que sigue en ella y lo que salió (cosecha sin replantar,
incendio, urbanización o cambio de clase), y cuánta zona poblada nueva (que no existía en 2000)
quedó a menos de D de plantación que ya existía al inicio y sigue al final.
"""
import json
import os
import sys
import time
from multiprocessing import Pool

import numpy as np

sys.path.insert(0, os.path.dirname(__file__))
from franja import CLASES, COLECCION, PLANTACION, _metros_por_pixel, _ventana, distancia_al_borde, zona_poblada  # noqa: E402

DISTANCIAS = (100, 500)
INICIO, FINAL = 2000, int(os.environ.get("FINAL", "2022"))


def descomponer(c0, c1, dentro, area_ha, alto, ancho, temprana=None, distancias=DISTANCIAS):
    """c0, c1: coberturas inicial y final (misma ventana); temprana: plantación en algún año 2000-2005.

    Devuelve hectáreas por parte y distancia."""
    plant0, plant1 = c0 == PLANTACION, c1 == PLANTACION
    existia = plant0 if temprana is None else (plant0 | temprana)
    pob0, pob1 = zona_poblada(c0, area_ha), zona_poblada(c1, area_ha)
    vacio = np.full(c0.shape, np.inf, dtype=np.float32)
    d0 = distancia_al_borde(pob0, alto, ancho) if pob0.any() else vacio
    d1 = distancia_al_borde(pob1, alto, ancho) if pob1.any() else vacio
    estable = existia & plant1
    d_estable = distancia_al_borde(estable, alto, ancho) if estable.any() else vacio
    nueva_pob = pob1 & ~pob0
    ha = lambda m: float(((m & dentro) * area_ha).sum())
    out = {"poblado_nuevo_ha": ha(nueva_pob)}
    for d in distancias:
        f0, f1 = plant0 & (d0 <= d), plant1 & (d1 <= d)
        out[f"{d}m"] = {
            "inicial_ha": ha(f0),
            "final_ha": ha(f1),
            "ya_estaba_ha": ha(f1 & existia & (d0 <= d)),
            "llego_ciudad_ha": ha(f1 & existia & (d0 > d)),
            "plantacion_nueva_ha": ha(f1 & ~existia),
            "sigue_ha": ha(f0 & f1),
            "salio_ha": ha(f0 & ~f1),
            "poblado_nuevo_junto_a_plantacion_ha": ha(nueva_pob & (d_estable <= d)),
        }
    return out


def comuna(args):
    import rasterio
    from rasterio.features import geometry_mask
    fid, geom = args
    s0 = rasterio.open(CLASES["archivo"].format(INICIO))
    s1 = rasterio.open(CLASES["archivo"].format(FINAL))
    win = _ventana(s0, geom)
    tr = s0.window_transform(win)
    c0, c1 = s0.read(1, window=win), s1.read(1, window=win)
    # Plantación en algún año 2000-2005 (scripts/bajar_temprana.py); fuera de sus mosaicos no hay plantación
    with rasterio.open(f"data/ras/plant_temprana_c{COLECCION}.tif") as st:
        temprana = st.read(1, window=win, boundless=True, fill_value=0) == 1
    alto, ancho = _metros_por_pixel(tr, 0, c0.shape[0])
    dentro = ~geometry_mask([geom], out_shape=c0.shape, transform=tr)
    return fid, descomponer(c0, c1, dentro, (alto * ancho / 1e4)[:, None], alto, float(np.median(ancho)), temprana)


if __name__ == "__main__":
    import geopandas as gpd
    g = gpd.read_file("data/np4/nivel-politico-4.shp").to_crs(4326)
    g["geometry"] = g.geometry.make_valid()
    t0 = time.time()
    res = {}
    with Pool(int(os.environ.get("PROCESOS", "4"))) as p:
        for i, (fid, r) in enumerate(p.imap_unordered(comuna, [(str(f), geo) for f, geo in zip(g.FEATURE_ID, g.geometry)])):
            res[fid] = r
            if i % 50 == 0:
                print(i, round(time.time() - t0), "s", flush=True)
    json.dump(res, open(f"out/crecimiento_col{COLECCION}_{INICIO}_{FINAL}.json", "w"))
    print(len(res), "comunas en", round(time.time() - t0), "s")
