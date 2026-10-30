"""Calcula la franja plantación-ciudad y la validación con Fuego para las 343 comunas."""
import json
import os
import re
import sys
import unicodedata
import time

import geopandas as gpd
import rasterio

sys.path.insert(0, "scripts")
from franja import calcular, CLASES, COLECCION

g = gpd.read_file("data/np4/nivel-politico-4.shp").to_crs(4326)
g["geometry"] = g.geometry.make_valid()
cob = {a: rasterio.open(CLASES["archivo"].format(a)) for a in CLASES["anios"]}
fue = [rasterio.open(f"data/ras/fire_{a}.tif") for a in (2023, 2024, 2025)]

def _norm(s):
    s = unicodedata.normalize("NFKD", s).encode("ascii", "ignore").decode().lower()
    return re.sub(r"[^a-z]", "", s)


if COLECCION == "1":
    # La estadística oficial de la Colección 1 solo se usa como control; si no está disponible, el campo queda vacío
    stats = json.load(open("data/stats_col1_comunas.json")) if os.path.exists("data/stats_col1_comunas.json") else None

    def oficial(fid, nombre):
        if stats is None:
            return None
        cl = stats.get(fid, {}).get("clases", {})
        return {a: {"plantacion_ha": cl.get("9", {}).get(a, 0), "urbano_ha": cl.get("24", {}).get(a, 0),
                    "area_ha": sum(x[a] for x in cl.values())} for a in ("2000", "2022")}
else:
    # Estadística oficial de la Colección 2 (ya procesada por comuna), cruzada por nombre
    idx = {_norm(c["comuna"]): c["slug"] for c in json.load(open("out/indice.json"))["comunas"]}

    def oficial(fid, nombre):
        clave = {"coihaique": "coyhaique"}.get(_norm(nombre), _norm(nombre))  # misma comuna, dos grafías
        c = json.load(open(f"out/comunas/{idx[clave]}.json"))
        i = {a: c["anios"].index(a) for a in CLASES["anios"]}
        gr = c["grupos"]
        return {str(a): {"plantacion_ha": gr.get("plantacion", [0] * len(c["anios"]))[i[a]],
                         "urbano_ha": gr.get("urbano", [0] * len(c["anios"]))[i[a]],
                         "area_ha": c["area_ha"]} for a in CLASES["anios"]}


res = {}
t0 = time.time()
for i, r in g.sort_values("FEATURE_ID").iterrows():
    fid = str(r.FEATURE_ID)
    t = time.time()
    try:
        out = calcular(r.geometry, cob, fue)
    except MemoryError:
        print("MEMORIA", fid, r.NAME, flush=True)
        raise
    out.update(fid=fid, comuna=r.NAME, provincia=r.LEVEL_3, region=r.LEVEL_2)
    out["oficial"] = oficial(fid, r.NAME)
    res[fid] = out
    dt = time.time() - t
    if dt > 20:
        print(f"lenta {r.NAME} {dt:.0f}s", flush=True)
json.dump(res, open(f"out/franja_col{COLECCION}.json", "w"), ensure_ascii=False)
print(len(res), "comunas en", round(time.time() - t0), "s")
