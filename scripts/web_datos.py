"""Arma los datos de la web Límite Vivo: resumen nacional, ficha por comuna y CSV."""
import csv
import json
import re
import unicodedata
from pathlib import Path

OUT = Path("web/public/datos")
(OUT / "comunas").mkdir(parents=True, exist_ok=True)


def norm(s):
    s = unicodedata.normalize("NFKD", s).encode("ascii", "ignore").decode().lower()
    s = re.sub(r"[^a-z]", "", s)
    return {"coihaique": "coyhaique"}.get(s, s)


# Grafía oficial para nombres que la capa de MapBiomas escribe sin tilde o con otra forma
NOMBRE = {"Los Angeles": "Los Ángeles", "Los Alamos": "Los Álamos", "Coihaique": "Coyhaique"}

# MapBiomas Fuego Chile, Colección 1, cubre de Valparaíso a La Araucanía. Fuera de esas regiones
# el ráster trae ceros que significan "sin dato", no "sin fuego".
REGIONES_FUEGO = {"Valparaíso", "Metropolitana de Santiago", "Libertador General Bernardo O'Higgins", "Maule",
                  "Ñuble", "Biobío", "La Araucanía"}

c1 = json.load(open("out/franja_col1.json"))
c2 = json.load(open("out/franja_col2.json"))
v1 = json.load(open("out/validacion_col1.json"))
v2 = json.load(open("out/validacion_col2.json"))
idx = {norm(c["comuna"]): c for c in json.load(open("out/indice.json"))["comunas"]}
val1 = {norm(f["comuna"]): f for f in v1["detalle"]}
val2 = {norm(f["comuna"]): f for f in v2["detalle"]}
r1 = lambda x: round(x, 1)


def franja(v, anios):
    return {str(a): {k: r1(v[str(a)][k]) for k in
                     ("plantacion_ha", "plantacion_100m_ha", "plantacion_200m_ha", "plantacion_500m_ha", "poblado_ha")}
            for a in anios}


def fuego(f):
    if not f:
        return None
    return {"plantacion_ha": r1(f["p"]), "plantacion_quemada_ha": r1(f["pq"]),
            "natural_ha": r1(f["n"]), "natural_quemada_ha": r1(f["nq"]),
            "agricola_ha": r1(f["a"]), "agricola_quemada_ha": r1(f["aq"])}


# Sectores expuestos (scripts/sectores.py), agrupados por comuna y numerados por hectáreas de plantación
sect_por_comuna = {}
for sct in json.load(open("out/sectores.json")):
    sect_por_comuna.setdefault(norm(sct["comuna"]), []).append(sct)
for lista in sect_por_comuna.values():
    lista.sort(key=lambda x: -x["plantacion_100m_ha"])
    for i, sct in enumerate(lista):
        sct["n"] = i + 1

filas = []
for fid, v in c1.items():
    k = norm(v["comuna"])
    meta = idx[k]
    serie = json.load(open(f"out/comunas/{meta['slug']}.json"))
    w = c2[fid]
    ficha = {
        "slug": meta["slug"], "comuna": NOMBRE.get(v["comuna"], v["comuna"]), "provincia": v["provincia"], "region": v["region"],
        "area_ha": r1(v["area_ha"]),
        "col1": franja(v, (2000, 2022)),
        "col2": franja(w, (2000, 2022, 2024)),
        "fuego_col1": fuego(val1.get(k)) if v["region"] in REGIONES_FUEGO else None,
        "fuego_col2": fuego(val2.get(k)) if v["region"] in REGIONES_FUEGO else None,
        "fuego_cubierta": v["region"] in REGIONES_FUEGO,
        "quemado_2023_2025_ha": r1((v.get("fuego") or {}).get("quemado_ha", 0)),
        "sectores": [{campo: sct[campo] for campo in ("n", "lat", "lon", "borde_m", "plantacion_100m_ha", "quemada_ha", "lugar", "lugar_m")}
                     for sct in sect_por_comuna.get(norm(v["comuna"]), [])],
        "serie_col2": {"anios": serie["anios"], "plantacion": [r1(x) for x in serie["grupos"].get("plantacion", [0] * len(serie["anios"]))],
                       "urbano": [r1(x) for x in serie["grupos"].get("urbano", [0] * len(serie["anios"]))]},
    }
    filas.append(ficha)

# Puesto nacional por plantación a menos de 500 m (Colección 1, 2022)
orden = sorted(filas, key=lambda f: -f["col1"]["2022"]["plantacion_500m_ha"])
# Menos de 1 ha en la franja se trata como ruido de clasificación y no entra al ranking
con = [f for f in orden if f["col1"]["2022"]["plantacion_500m_ha"] >= 1]
for i, f in enumerate(orden):
    f["puesto"] = i + 1 if f["col1"]["2022"]["plantacion_500m_ha"] >= 1 else None
    f["puesto_de"] = len(con)
# Tamaño de cada mapa, para reservar su espacio en la página y que el texto no salte al cargar,
# y posición de los marcadores numerados (scripts/mapas.py) para enlazarlos con la tabla de sectores
from PIL import Image
marcas = json.load(open("out/mapas_marcas.json")) if Path("out/mapas_marcas.json").exists() else {}
for f in filas:
    for sct in f["sectores"]:
        pos = marcas.get(f["slug"], {}).get(str(sct["n"]))
        if pos:
            sct["marca"] = pos
    ruta = Path("web/public/mapas") / f"{f['slug']}.webp"
    if ruta.exists():
        with Image.open(ruta) as im:
            f["mapa_px"] = list(im.size)
    json.dump(f, open(OUT / "comunas" / f"{f['slug']}.json", "w"), ensure_ascii=False)


def tot(col, a, k):
    return round(sum(f[col][str(a)][k] for f in filas))


def val(v):
    return {k: {"rr": v[k]["rr"], "ic95": [float(x) for x in v[k]["ic95"]], "comunas_mayor": v[k]["comunas_mayor"],
                "comunas": v[k]["comunas"]} for k in ("natural", "agricola")}


resumen = {
    "nacional": {
        "col1": {str(a): {k: tot("col1", a, k) for k in ("plantacion_ha", "plantacion_100m_ha", "plantacion_200m_ha", "plantacion_500m_ha", "poblado_ha")} for a in (2000, 2022)},
        "col2": {str(a): {k: tot("col2", a, k) for k in ("plantacion_ha", "plantacion_100m_ha", "plantacion_200m_ha", "plantacion_500m_ha", "poblado_ha")} for a in (2000, 2022, 2024)},
    },
    "validacion": {"col1": val(v1), "col2": val(v2)},
    "sensibilidad": {"col1": v1.get("sensibilidad"), "col2": v2.get("sensibilidad")},
    "sin_una_comuna": {"col1": v1.get("sin_una_comuna_natural"), "col2": v2.get("sin_una_comuna_natural")},
    "comunas": [{"slug": f["slug"], "comuna": f["comuna"], "region": f["region"], "puesto": f["puesto"],
                 "p500_2000": f["col1"]["2000"]["plantacion_500m_ha"], "p500_2022": f["col1"]["2022"]["plantacion_500m_ha"],
                 "p100_2022": f["col1"]["2022"]["plantacion_100m_ha"], "p500_2024_c2": f["col2"]["2024"]["plantacion_500m_ha"],
                 "fuego": f["fuego_col1"] is not None,
                 "sectores_n": len(f["sectores"]),
                 "sectores_top3": [{campo: sct[campo] for campo in ("n", "lat", "lon", "borde_m", "plantacion_100m_ha", "quemada_ha", "lugar", "lugar_m")}
                                   for sct in f["sectores"][:3]]} for f in orden],
}
# Sectores con más plantación junto a zonas pobladas en todo el país
todos = sorted(((f, sct) for f in filas for sct in f["sectores"]), key=lambda x: -x[1]["plantacion_100m_ha"])
resumen["sectores_total"] = len(todos)
resumen["sectores_suma_100m_ha"] = round(sum(sct["plantacion_100m_ha"] for _, sct in todos))
resumen["sectores_top"] = [{"slug": f["slug"], "comuna": f["comuna"], "region": f["region"], **sct} for f, sct in todos[:25]]
json.dump(resumen, open(OUT / "resumen.json", "w"), ensure_ascii=False)

with open(OUT / "limite-vivo-comunas.csv", "w", newline="", encoding="utf-8-sig") as fh:
    w = csv.writer(fh)
    w.writerow(["comuna", "provincia", "region", "area_ha", "puesto_nacional",
                "c1_2000_plantacion_ha", "c1_2000_plantacion_100m_ha", "c1_2000_plantacion_200m_ha", "c1_2000_plantacion_500m_ha",
                "c1_2022_plantacion_ha", "c1_2022_plantacion_100m_ha", "c1_2022_plantacion_200m_ha", "c1_2022_plantacion_500m_ha",
                "c2_2024_plantacion_ha", "c2_2024_plantacion_100m_ha", "c2_2024_plantacion_200m_ha", "c2_2024_plantacion_500m_ha",
                "fuego_franja_plantacion_ha", "fuego_franja_plantacion_quemada_ha", "fuego_franja_natural_ha", "fuego_franja_natural_quemada_ha"])
    for f in orden:
        fu = f["fuego_col1"] or {}
        w.writerow([f["comuna"], f["provincia"], f["region"], f["area_ha"], f["puesto"] or "",
                    *[f["col1"]["2000"][k] for k in ("plantacion_ha", "plantacion_100m_ha", "plantacion_200m_ha", "plantacion_500m_ha")],
                    *[f["col1"]["2022"][k] for k in ("plantacion_ha", "plantacion_100m_ha", "plantacion_200m_ha", "plantacion_500m_ha")],
                    *[f["col2"]["2024"][k] for k in ("plantacion_ha", "plantacion_100m_ha", "plantacion_200m_ha", "plantacion_500m_ha")],
                    fu.get("plantacion_ha", ""), fu.get("plantacion_quemada_ha", ""), fu.get("natural_ha", ""), fu.get("natural_quemada_ha", "")])
print(len(filas), "comunas;", len(con), "con plantación cerca de zonas pobladas")
print(json.dumps(resumen["nacional"], indent=0)[:600])
print(resumen["validacion"])
