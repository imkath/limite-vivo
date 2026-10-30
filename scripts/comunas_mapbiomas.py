"""Polígonos de comuna de MapBiomas Chile (nivel político 4) a partir del raster publicado en Earth Engine.

El almacenamiento público de MapBiomas dejó de entregar la capa vectorial (nivel-politico-4.zip) el
30 de octubre de 2026. El mismo nivel está en Earth Engine como raster con un identificador por comuna
(1 a 343). Este script:

1. Vectoriza data/ras/comunas_n4.tif (descargado por bajar_cobertura.py) por franjas de filas y une las
   piezas de cada identificador.
2. Le pone nombre a cada identificador cruzándolo con la capa oficial de comunas del MOP (servicio DPA):
   gana la comuna DPA que cubre la mayor parte del polígono, y se exige que cubra al menos el 80 %.
3. Toma el nombre, la provincia y la región tal como los escribe MapBiomas en su estadística oficial
   de la Colección 2, para que los nombres calcen con el resto del proyecto.

Salida: data/np4/nivel-politico-4.shp con FEATURE_ID, NAME, LEVEL_2 (región) y LEVEL_3 (provincia),
las mismas columnas que la capa original, más CUT (código comunal oficial).
"""
import re
import sys
import unicodedata
from multiprocessing import Pool

import geopandas as gpd
import numpy as np
import pandas as pd
import rasterio
from rasterio.features import shapes
from rasterio.windows import Window
from shapely import union_all
from shapely.geometry import shape

RASTER = "data/ras/comunas_n4.tif"
FRANJA = 2048

# Grafías distintas para la misma comuna entre la capa DPA del MOP y la estadística de MapBiomas
EQUIVALENCIAS = {"aysen": "aisen", "coihaique": "coyhaique", "paiguano": "paihuano", "marchigue": "marchihue",
                 "llayllay": "llaillay", "llaillay": "llaillay"}


def norm(s):
    s = unicodedata.normalize("NFKD", str(s)).encode("ascii", "ignore").decode().lower()
    s = re.sub(r"[^a-z]", "", s)
    return EQUIVALENCIAS.get(s, s)


def franja(fila0):
    with rasterio.open(RASTER) as src:
        alto = min(FRANJA, src.height - fila0)
        w = Window(0, fila0, src.width, alto)
        a = src.read(1, window=w)
        if not a.any():
            return {}
        out = {}
        for geom, v in shapes(a, mask=a > 0, transform=src.window_transform(w)):
            out.setdefault(int(v), []).append(shape(geom))
        return out


if __name__ == "__main__":
    with rasterio.open(RASTER) as src:
        filas = list(range(0, src.height, FRANJA))
    piezas = {}
    with Pool(6) as p:
        for i, d in enumerate(p.imap_unordered(franja, filas)):
            for k, v in d.items():
                piezas.setdefault(k, []).extend(v)
            if i % 10 == 0:
                print(i, "/", len(filas), file=sys.stderr, flush=True)
    ids = sorted(piezas)
    g = gpd.GeoDataFrame({"FEATURE_ID": ids}, geometry=[union_all(piezas[k]) for k in ids], crs=4326)
    print("identificadores:", len(g), file=sys.stderr)

    # Nombre por superposición con la capa DPA (en una proyección de área para medir bien)
    dpa = gpd.read_file("data/dpa/comunas.gpkg").to_crs(4326)
    a = g.to_crs(32719)
    b = dpa.to_crs(32719)
    inter = gpd.overlay(a[["FEATURE_ID", "geometry"]], b[["CUT_COM", "COMUNA", "geometry"]], how="intersection", keep_geom_type=True)
    inter["sup"] = inter.area
    mejor = inter.sort_values("sup", ascending=False).drop_duplicates("FEATURE_ID").set_index("FEATURE_ID")
    total = a.set_index("FEATURE_ID").area
    cobertura = mejor["sup"] / total.loc[mejor.index]
    debiles = cobertura[cobertura < 0.8]
    if len(debiles):
        raise SystemExit(f"Identificadores sin una comuna DPA clara: {debiles.to_dict()}")
    if mejor["CUT_COM"].duplicated().any():
        raise SystemExit(f"Dos identificadores apuntan a la misma comuna: {mejor[mejor.CUT_COM.duplicated(keep=False)].COMUNA.tolist()}")

    est = pd.read_excel("data/stats_political.xlsx", sheet_name="COVERAGE",
                        usecols=["territory_level_2", "territory_level_3", "territory_level_4"]).drop_duplicates()
    est["clave"] = est.territory_level_4.map(norm)
    if est.clave.duplicated().any():
        raise SystemExit("Nombres repetidos en la estadística de MapBiomas")
    est = est.set_index("clave")
    nombres = []
    for fid in g.FEATURE_ID:
        clave = norm(mejor.loc[fid, "COMUNA"])
        if clave not in est.index:
            raise SystemExit(f"Sin nombre MapBiomas para {mejor.loc[fid, 'COMUNA']} (id {fid})")
        e = est.loc[clave]
        nombres.append((e.territory_level_4, e.territory_level_2, e.territory_level_3))
    g["NAME"], g["LEVEL_2"], g["LEVEL_3"] = zip(*nombres)
    # Código comunal oficial (CUT), para unir con datos del INE y otros servicios del Estado
    g["CUT"] = [int(mejor.loc[fid, "CUT_COM"]) for fid in g.FEATURE_ID]
    if g.NAME.duplicated().any() or len(g) != len(est):
        raise SystemExit("La unión de nombres no es uno a uno")
    g["cobertura"] = cobertura.loc[g.FEATURE_ID].values
    print("cobertura DPA mínima: {:.3f}".format(g.cobertura.min()), file=sys.stderr)
    g.drop(columns="cobertura").to_file("data/np4/nivel-politico-4.shp", encoding="utf-8")
    print(g[["FEATURE_ID", "NAME", "LEVEL_3", "LEVEL_2"]].head().to_string())
