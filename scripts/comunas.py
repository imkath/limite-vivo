"""Convierte la capa de comunas del servicio DPA del MOP (JSON de ArcGIS) a GeoPackage."""
import json
import geopandas as gpd
from shapely import LinearRing, Polygon
from shapely.ops import unary_union
from shapely.validation import make_valid

d = json.load(open("data/dpa/t.json"))
rows, geoms = [], []
for f in d["features"]:
    exteriores, huecos = [], []
    for r in f["geometry"]["rings"]:
        # En ArcGIS los anillos exteriores van en sentido horario y los huecos al revés
        (huecos if LinearRing(r).is_ccw else exteriores).append(make_valid(Polygon(r)))
    g = unary_union(exteriores)
    if huecos:
        g = g.difference(unary_union(huecos))
    geoms.append(make_valid(g))
    rows.append(f["attributes"])
gdf = gpd.GeoDataFrame(rows, geometry=geoms, crs=4326)
gdf["area_ha_pol"] = gdf.to_crs(32719).area.values / 1e4
print(len(gdf), gdf.CUT_COM.nunique(), bool(gdf.geometry.is_valid.all()))
print(gdf[gdf.COMUNA.isin(["Viña del Mar", "Macul", "Santiago"])][["CUT_COM", "COMUNA", "area_ha_pol"]])
gdf.to_file("data/dpa/comunas.gpkg", driver="GPKG")
