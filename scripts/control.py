"""Imagen de control: ciudad, plantación, franja de 500 m y área quemada 2023-2025."""
import sys
import geopandas as gpd, numpy as np, rasterio, matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
from rasterio.windows import Window
sys.path.insert(0, "scripts")
from franja import distancia_al_borde, _ventana, _metros_por_pixel, zona_poblada

g = gpd.read_file("data/np4/nivel-politico-4.shp").to_crs(4326)
cov = rasterio.open("data/ras/cov_2022.tif"); fue = [rasterio.open(f"data/ras/fire_{a}.tif") for a in (2023, 2024, 2025)]
fig, axs = plt.subplots(1, len(sys.argv) - 1, figsize=(7 * (len(sys.argv) - 1), 7))
for ax, nombre in zip(np.atleast_1d(axs), sys.argv[1:]):
    geom = g[g.NAME == nombre].geometry.iloc[0]
    win = _ventana(cov, geom); tr = cov.window_transform(win); c = cov.read(1, window=win)
    alto, ancho = _metros_por_pixel(tr, 0, c.shape[0])
    area = (alto * ancho / 1e4)[:, None]
    dist = distancia_al_borde(zona_poblada(c, area), alto, float(np.median(ancho)))
    col = round((tr.c - fue[0].transform.c) / fue[0].transform.a); row = round((tr.f - fue[0].transform.f) / fue[0].transform.e)
    q = np.zeros(c.shape, bool)
    for s in fue: q |= s.read(1, window=Window(col, row, *c.shape[::-1]), boundless=True, fill_value=0) == 1
    img = np.ones(c.shape + (3,)) * 0.93
    img[np.isin(c, [3, 66, 12, 11])] = (0.75, 0.85, 0.72)
    img[c == 9] = (0.48, 0.35, 0.0)
    img[(c == 9) & (dist <= 500)] = (0.95, 0.65, 0.1)
    img[c == 24] = (0.83, 0.15, 0.12)
    img[c == 33] = (0.6, 0.7, 0.9)
    img[q & (c != 24)] = img[q & (c != 24)] * 0.45
    ext = (tr.c, tr.c + tr.a * c.shape[1], tr.f + tr.e * c.shape[0], tr.f)
    ax.imshow(img, extent=ext); gpd.GeoSeries([geom]).boundary.plot(ax=ax, color="k", lw=0.8)
    ax.set_title(f"{nombre}: rojo ciudad, naranjo plantación a <500 m, café plantación, oscuro = quemado 2023-25", fontsize=8)
fig.tight_layout(); fig.savefig("out/control.png", dpi=110)
