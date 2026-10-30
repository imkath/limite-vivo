"""Recalcula la franja con un método distinto (polígonos + buffer en UTM + área elipsoidal)
para comprobar el método principal (transformada de distancia sobre la grilla geográfica)."""
import json
import sys

import geopandas as gpd
import numpy as np
import rasterio
from pyproj import Geod
from rasterio.features import geometry_mask, shapes
from shapely.geometry import shape

sys.path.insert(0, "scripts")
from franja import _metros_por_pixel, _ventana, zona_poblada

geod = Geod(ellps="WGS84")
g = gpd.read_file("data/np4/nivel-politico-4.shp").to_crs(4326)
g["geometry"] = g.geometry.make_valid()
ref = json.load(open("out/franja_col1.json"))
cov = rasterio.open("data/ras/cov_2022.tif")

for nombre in sys.argv[1:]:
    r = g[g.NAME == nombre].iloc[0]
    win = _ventana(cov, r.geometry)
    tr = cov.window_transform(win)
    c = cov.read(1, window=win)
    alto, ancho = _metros_por_pixel(tr, 0, c.shape[0])
    pob = zona_poblada(c, (alto * ancho / 1e4)[:, None])
    # Área elipsoidal de un píxel en cada fila (independiente del cálculo esférico)
    area = np.array([abs(geod.polygon_area_perimeter(
        [tr.c, tr.c + tr.a, tr.c + tr.a, tr.c],
        [tr.f + tr.e * i, tr.f + tr.e * i, tr.f + tr.e * (i + 1), tr.f + tr.e * (i + 1)])[0]) / 1e4
        for i in range(c.shape[0])])[:, None]
    dentro = ~geometry_mask([r.geometry], out_shape=c.shape, transform=tr)
    polys = [shape(s) for s, v in shapes(pob.astype(np.uint8), mask=pob, transform=tr) if v == 1]
    zona = 32718 if r.geometry.centroid.x < -72 else 32719
    pg = gpd.GeoSeries(polys, crs=4326).to_crs(zona)
    out = {}
    for d in (100, 200, 500):
        buf = gpd.GeoSeries([pg.buffer(d).union_all()], crs=zona).to_crs(4326)
        # El centro del píxel debe caer en el buffer (equivale a distancia de centro a borde)
        en = ~geometry_mask(list(buf), out_shape=c.shape, transform=tr, all_touched=False)
        out[d] = float((((c == 9) & dentro & en) * area).sum())
    oficial = ref[str(r.FEATURE_ID)]["2022"]
    print(nombre, " | ".join(
        f"{d} m: {out[d]:.0f} vs {oficial[f'plantacion_{d}m_ha']:.0f} ({(out[d] / oficial[f'plantacion_{d}m_ha'] - 1) * 100:+.1f} %)"
        if oficial[f"plantacion_{d}m_ha"] else f"{d} m: {out[d]:.0f} vs 0" for d in (100, 200, 500)))
