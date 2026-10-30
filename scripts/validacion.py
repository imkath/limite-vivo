"""Validación estratificada por comuna: tasa de quema de la plantación en la franja de 500 m
frente a otra cobertura de la misma franja (Mantel-Haenszel, IC por bootstrap de comunas)."""
import json
import sys

import geopandas as gpd
import numpy as np
import rasterio

sys.path.insert(0, "scripts")
from validacion_mh import razon_mh
from franja import distancia_al_borde, _metros_por_pixel, _ventana, zona_poblada, PLANTACION, NATURAL, AGRO, CLASES, COLECCION
from rasterio.features import geometry_mask
from rasterio.windows import Window

g = gpd.read_file("data/np4/nivel-politico-4.shp").to_crs(4326)
g["geometry"] = g.geometry.make_valid()
d = json.load(open(f"out/franja_col{COLECCION}.json"))
cov = rasterio.open(CLASES["archivo"].format(2022))
fue = [rasterio.open(f"data/ras/fire_{a}.tif") for a in (2023, 2024, 2025)]
ref = fue[0]

filas = []
for _, r in g.iterrows():
    f = d[str(r.FEATURE_ID)].get("fuego")
    # Se calculan todas las comunas con algo de plantación y fuego en la franja; los umbrales se aplican después
    if not f or f["franja_plant_ha"] < 5 or (f["franja_plant_quemada_ha"] + f["franja_otra_quemada_ha"]) < 1:
        continue
    win = _ventana(cov, r.geometry)
    tr = cov.window_transform(win)
    c = cov.read(1, window=win)
    dentro = ~geometry_mask([r.geometry], out_shape=c.shape, transform=tr)
    alto, ancho = _metros_por_pixel(tr, 0, c.shape[0])
    area = (alto * ancho / 1e4)[:, None]
    dist = distancia_al_borde(zona_poblada(c, area), alto, float(np.median(ancho)))
    col = round((tr.c - ref.transform.c) / ref.transform.a)
    row = round((tr.f - ref.transform.f) / ref.transform.e)
    q = np.zeros(c.shape, bool)
    for s in fue:
        q |= s.read(1, window=Window(col, row, c.shape[1], c.shape[0]), boundless=True, fill_value=0) == 1
    base = dentro & (dist <= 500)
    ha = lambda m: float((m * area).sum())
    p, n, a = base & (c == PLANTACION), base & np.isin(c, list(NATURAL)), base & np.isin(c, list(AGRO))
    filas.append(dict(comuna=r.NAME, region=r.LEVEL_2, p=ha(p), pq=ha(p & q), n=ha(n), nq=ha(n & q), a=ha(a), aq=ha(a & q)))


mh = razon_mh
PLANT_MIN, QUEMA_MIN = 20, 10  # criterio principal de inclusión


def incluir(f, plant_min, quema_min):
    return f["p"] >= plant_min and (f["pq"] + f["nq"] + f["aq"]) >= quema_min


# Sensibilidad a los umbrales de inclusión y a la comuna de mayor peso
sensibilidad = []
for pm, qm in ((5, 5), (20, 10), (50, 20), (100, 50)):
    fs = [f for f in filas if incluir(f, pm, qm)]
    sensibilidad.append(dict(plantacion_min_ha=pm, quemado_min_ha=qm, comunas=len(fs),
                             natural=round(mh(fs, "p", "pq", "n", "nq"), 2), agricola=round(mh(fs, "p", "pq", "a", "aq"), 2)))
    print("sensibilidad", sensibilidad[-1])
todas = filas
filas = [f for f in todas if incluir(f, PLANT_MIN, QUEMA_MIN)]
sin_una = [mh([g for g in filas if g is not f], "p", "pq", "n", "nq") for f in filas]
print("dejando fuera una comuna, natural: min", round(min(sin_una), 2), "max", round(max(sin_una), 2))

rng = np.random.default_rng(2026)
res = {"comunas": len(filas), "sensibilidad": sensibilidad,
       "sin_una_comuna_natural": [round(min(sin_una), 2), round(max(sin_una), 2)]}
for nombre, y, yq in (("natural", "n", "nq"), ("agricola", "a", "aq")):
    est = mh(filas, "p", "pq", y, yq)
    boots = [mh([filas[i] for i in rng.integers(0, len(filas), len(filas))], "p", "pq", y, yq) for _ in range(2000)]
    lo, hi = np.nanpercentile(boots, [2.5, 97.5])
    mayor = sum(1 for f in filas if f[y] >= 20 and f["pq"] / f["p"] > f[yq] / f[y])
    total = sum(1 for f in filas if f[y] >= 20)
    res[nombre] = dict(rr=round(est, 2), ic95=[round(lo, 2), round(hi, 2)], comunas_mayor=mayor, comunas=total)
    print(nombre, res[nombre])
res["detalle"] = filas
json.dump(res, open(f"out/validacion_col{COLECCION}.json", "w"), ensure_ascii=False, indent=1)
