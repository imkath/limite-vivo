"""Geometría liviana para la web: contornos simplificados de comunas (SVG) y comunas vecinas."""
import json
import math
import re
import unicodedata

import geopandas as gpd

D = "web/public/datos"
NOMBRE = {"Los Angeles": "Los Ángeles", "Los Alamos": "Los Álamos", "Coihaique": "Coyhaique"}


def norm(s):
    s = unicodedata.normalize("NFKD", s).encode("ascii", "ignore").decode().lower()
    return {"coihaique": "coyhaique"}.get(re.sub(r"[^a-z]", "", s), re.sub(r"[^a-z]", "", s))


r = json.load(open(f"{D}/resumen.json"))
slug = {norm(c["comuna"]): c["slug"] for c in r["comunas"]}
g = gpd.read_file("data/np4/nivel-politico-4.shp").to_crs(4326)
g["geometry"] = g.geometry.make_valid()
g["slug"] = [slug[norm(n)] for n in g.NAME]

# Vecinas: comunas que comparten borde (con tolerancia de ~100 m por diferencias de digitalización)
m = g.to_crs(32719)
buf = m.geometry.buffer(100)
vecinas = {}
for i, row in m.iterrows():
    cand = m.index[buf.intersects(row.geometry)]
    vecinas[row.slug] = sorted({m.at[j, "slug"] for j in cand if j != i})

# Mapa de la zona con plantaciones (de Valparaíso a Los Lagos, ~32,0° a 43,6° S)
LAT0 = -37.8
k = math.cos(math.radians(LAT0))
zona = g[(g.geometry.centroid.y < -32.0) & (g.geometry.centroid.y > -43.7) & (g.geometry.centroid.x > -74.5)].copy()
zona["geometry"] = zona.geometry.simplify(0.008, preserve_topology=True)
minx, miny, maxx, maxy = zona.total_bounds
ESC = 100  # unidades SVG por grado


def xy(x, y):
    return round((x - minx) * k * ESC), round((maxy - y) * ESC)


def path(geom):
    """Contorno en coordenadas enteras y relativas (m/l en minúscula): a este tamaño no se pierde detalle visible."""
    partes = []
    polys = getattr(geom, "geoms", [geom])
    for p in polys:
        if p.geom_type != "Polygon" or p.area < 0.0004:
            continue
        for anillo in [p.exterior, *p.interiors]:
            pts = [xy(*c) for c in anillo.coords]
            limpio = [pts[0]] + [b for a, b in zip(pts, pts[1:]) if a != b]
            if len(limpio) < 4:
                continue
            x0, y0 = limpio[0]
            rel = [f"{b[0] - a[0]} {b[1] - a[1]}" for a, b in zip(limpio, limpio[1:])]
            partes.append(f"M{x0} {y0}l" + " ".join(rel) + "z")
    return "".join(partes)


mapa = {
    "ancho": round((maxx - minx) * k * ESC),
    "alto": round((maxy - miny) * ESC),
    "comunas": [{"slug": s, "d": path(geo)} for s, geo in zip(zona.slug, zona.geometry) if path(geo)],
}
json.dump(mapa, open(f"{D}/mapa.json", "w"), separators=(",", ":"))
json.dump(vecinas, open(f"{D}/vecinas.json", "w"), ensure_ascii=False)
import os
print(len(mapa["comunas"]), "comunas en el mapa;", round(os.path.getsize(f"{D}/mapa.json") / 1024), "kB;",
      "vecinas de Macul:", vecinas["macul"], "| Viña:", vecinas["vina-del-mar"])
