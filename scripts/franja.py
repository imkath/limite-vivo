"""Franja plantación-ciudad por comuna a partir de MapBiomas Chile.

Para cada comuna y año calcula cuántas hectáreas de plantación forestal (clase 9)
hay a menos de 100, 200 y 500 m de zonas pobladas (manchas de infraestructura,
clase 24, sin carreteras ni caminos), y valida
la franja de 2022 contra el área quemada 2023-2025 de MapBiomas Fuego.
"""
import math
import os

import numpy as np
import rasterio
from rasterio.features import geometry_mask
from rasterio.windows import Window, from_bounds
from scipy.ndimage import binary_opening, distance_transform_edt, label

PLANTACION = 9
URBANO = 24
# Las dos colecciones usan códigos distintos para la vegetación natural y la agrícola
COLECCION = os.environ.get("COL", "1")
CLASES = {
    "1": {"natural": {3, 11, 12, 66}, "agro": {21}, "anios": (2000, 2022), "archivo": "data/ras/cov_{}.tif"},
    "2": {"natural": {3, 59, 60, 67, 11, 12, 63, 66}, "agro": {15, 18}, "anios": (2000, 2022, 2024), "archivo": "data/ras/col2_{}.tif"},
}[COLECCION]
NATURAL, AGRO = CLASES["natural"], CLASES["agro"]
# Vegetación que puede quemarse y con la que se compara la plantación
VEGETACION = NATURAL | AGRO | {9}
DISTANCIAS = (100, 200, 500)
MARGEN_GRADOS = 0.01  # ~1 km: la ciudad vecina también cuenta para la franja
R_TIERRA = 6371008.8
# La clase 24 incluye carreteras. Una zona poblada es una mancha de al menos
# 3 píxeles (~90 m) de ancho y POBLADO_MIN_HA de superficie.
POBLADO_MIN_HA = 2.0


def _ventana(src, geom, margen=MARGEN_GRADOS):
    minx, miny, maxx, maxy = geom.bounds
    w = from_bounds(minx - margen, miny - margen, maxx + margen, maxy + margen, transform=src.transform)
    w = w.round_offsets().round_lengths()
    return w.intersection(Window(0, 0, src.width, src.height))


def _metros_por_pixel(transform, fila0, nfilas):
    """Tamaño del píxel en metros (alto constante, ancho por fila según la latitud)."""
    res_x, res_y = transform.a, -transform.e
    lat = transform.f - (fila0 + np.arange(nfilas) + 0.5) * res_y
    alto = math.radians(res_y) * R_TIERRA
    ancho = math.radians(res_x) * R_TIERRA * np.cos(np.radians(lat))
    return alto, ancho


def zona_poblada(c, area_ha):
    """Máscara de zonas pobladas: infraestructura sin líneas finas (caminos) ni manchas mínimas."""
    urb = binary_opening(c == URBANO, structure=np.ones((3, 3), bool))
    if not urb.any():
        return urb
    etiquetas, n = label(urb)
    sup = np.bincount(etiquetas.ravel(), weights=np.broadcast_to(area_ha, c.shape).ravel(), minlength=n + 1)
    grandes = sup >= POBLADO_MIN_HA
    grandes[0] = False
    return grandes[etiquetas]


def distancia_al_borde(poblado, alto, ancho):
    """Distancia en metros desde el centro de cada píxel hasta el borde de la zona poblada más cercana.

    La transformada de distancia mide de centro a centro; se resta medio píxel para medir
    hasta el borde, que es donde realmente termina la zona poblada.
    """
    d = distance_transform_edt(~poblado, sampling=(alto, ancho)).astype(np.float32)
    return np.maximum(d - (alto + ancho) / 4, 0)


def calcular(geom, cobertura, fuego=None):
    """cobertura: {año: dataset}; fuego: lista de datasets anuales (misma grilla)."""
    ref = next(iter(cobertura.values()))
    win = _ventana(ref, geom)
    tr = ref.window_transform(win)
    dentro = ~geometry_mask([geom], out_shape=(win.height, win.width), transform=tr)
    alto, ancho = _metros_por_pixel(tr, 0, win.height)
    area_ha = (alto * ancho / 1e4)[:, None]  # por fila
    # Para la distancia se usa el ancho de la fila central (error < 0,5 % en una comuna)
    ancho_medio = float(np.median(ancho))

    res = {"area_ha": float((dentro * area_ha).sum())}
    franjas_2022 = None
    cob_2022 = None
    for anio, src in cobertura.items():
        c = src.read(1, window=win)
        plant = c == PLANTACION
        urb = zona_poblada(c, area_ha)
        fila = {
            "plantacion_ha": float(((plant & dentro) * area_ha).sum()),
            "urbano_ha": float((((c == URBANO) & dentro) * area_ha).sum()),
            "poblado_ha": float(((urb & dentro) * area_ha).sum()),
        }
        if urb.any() and (plant & dentro).any():
            dist = distancia_al_borde(urb, alto, ancho_medio)
        else:
            dist = None
        for d in DISTANCIAS:
            if dist is None:
                fila[f"plantacion_{d}m_ha"] = 0.0
            else:
                fila[f"plantacion_{d}m_ha"] = float(((plant & dentro & (dist <= d)) * area_ha).sum())
        res[anio] = fila
        if anio == 2022:
            cob_2022, franjas_2022 = c, dist

    if fuego and cob_2022 is not None:
        res["fuego"] = _validar(geom, cob_2022, franjas_2022, dentro, area_ha, tr, fuego)
    return res


def _validar(geom, cob, dist, dentro, area_ha, tr, fuego):
    """Compara cuánto se quemó la plantación de la franja frente a otra vegetación de la misma franja."""
    ref = fuego[0]
    # Ubicar la ventana de cobertura en la grilla de Fuego (están alineadas)
    col = round((tr.c - ref.transform.c) / ref.transform.a)
    row = round((tr.f - ref.transform.f) / ref.transform.e)
    h, w = cob.shape
    win = Window(col, row, w, h)
    if col + w <= 0 or row + h <= 0 or col >= ref.width or row >= ref.height:
        return None
    quemado = np.zeros((h, w), dtype=bool)
    for src in fuego:
        quemado |= src.read(1, window=win, boundless=True, fill_value=0) == 1
    # Solo cuenta lo que está dentro de la cobertura de Fuego
    cubierto = np.zeros((h, w), dtype=bool)
    cubierto[max(0, -row):max(0, min(h, ref.height - row)), max(0, -col):max(0, min(w, ref.width - col))] = True

    out = {"quemado_ha": float(((quemado & dentro) * area_ha).sum())}
    if dist is None:
        franja = np.zeros_like(dentro)
    else:
        franja = dist <= 500
    veg = np.isin(cob, list(VEGETACION))
    base = dentro & cubierto & franja & veg
    plant = base & (cob == PLANTACION)
    otra = base & (cob != PLANTACION)
    ha = lambda m: float((m * area_ha).sum())
    out.update(
        franja_veg_ha=ha(base),
        franja_plant_ha=ha(plant),
        franja_plant_quemada_ha=ha(plant & quemado),
        franja_otra_ha=ha(otra),
        franja_otra_quemada_ha=ha(otra & quemado),
    )
    return out
