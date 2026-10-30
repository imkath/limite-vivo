import json, sys, time, rasterio, geopandas as gpd
sys.path.insert(0, "scripts")
from franja import calcular
g = gpd.read_file("data/dpa/comunas.gpkg")
cob = {a: rasterio.open(f"data/ras/cov_{a}.tif") for a in (2000, 2022)}
fue = [rasterio.open(f"data/ras/fire_{a}.tif") for a in (2023, 2024, 2025)]
for nombre in sys.argv[1:]:
    t = time.time()
    r = calcular(g[g.COMUNA == nombre].geometry.iloc[0], cob, fue)
    print(nombre, f"{time.time()-t:.1f}s", json.dumps(r, indent=1))
