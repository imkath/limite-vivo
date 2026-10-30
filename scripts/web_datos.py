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
# Quién se acercó a quién (scripts/crecimiento.py) y personas junto a plantación (scripts/poblacion.py)
crec1 = json.load(open("out/crecimiento_col1_2000_2022.json"))
crec2 = {a: json.load(open(f"out/crecimiento_col2_2000_{a}.json")) for a in (2022, 2024)}
pobl = json.load(open("out/poblacion_censo2024.json"))
PARTES = ("final_ha", "ya_estaba_ha", "llego_ciudad_ha", "plantacion_nueva_ha", "inicial_ha", "salio_ha",
          "poblado_nuevo_junto_a_plantacion_ha")
GRUPOS_POB = ("personas", "viviendas", "ninos_0_13", "mayores_60", "dificultad_mover")
CAMPOS_SECTOR = ("n", "lat", "lon", "borde_m", "plantacion_100m_ha", "quemada_ha", "franja_quemada_2013_2025_ha",
                 "franja_reincidente_2013_2025_ha", "lugar", "lugar_m")


def crecimiento(c):
    return {d: {k: r1(c[d][k]) for k in PARTES} for d in ("100m", "500m")}


def poblacion(p):
    if not p:
        return None
    out = {d: {k: round(p[d][k]) for k in GRUPOS_POB} for d in ("100m", "500m", "total")}
    # Sensibilidad: contando solo las manzanas cuyo punto interior está dentro de la distancia
    out["centro"] = {d: round(p["centro"][d]["personas"]) for d in ("100m", "500m")} if "centro" in p else \
        {d: out[d]["personas"] for d in ("100m", "500m")}
    return out


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
        "sectores": [{campo: sct[campo] for campo in CAMPOS_SECTOR} for sct in sect_por_comuna.get(norm(v["comuna"]), [])],
        "crecimiento": crecimiento(crec1[fid]),
        "poblacion": poblacion(pobl.get(fid)),
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
                 "personas_100m": (f["poblacion"] or {}).get("100m", {}).get("personas", 0),
                 "personas_500m": (f["poblacion"] or {}).get("500m", {}).get("personas", 0),
                 "llego_ciudad_100m": f["crecimiento"]["100m"]["llego_ciudad_ha"],
                 "sectores_top3": [{campo: sct[campo] for campo in CAMPOS_SECTOR} for sct in f["sectores"][:3]]} for f in orden],
}
# Sectores con más plantación junto a zonas pobladas en todo el país
todos = sorted(((f, sct) for f in filas for sct in f["sectores"]), key=lambda x: -x[1]["plantacion_100m_ha"])
resumen["sectores_total"] = len(todos)
resumen["sectores_suma_100m_ha"] = round(sum(sct["plantacion_100m_ha"] for _, sct in todos))
resumen["sectores_top"] = [{"slug": f["slug"], "comuna": f["comuna"], "region": f["region"], **sct} for f, sct in todos[:25]]
con_fuego = [sct for _, sct in todos if sct["franja_quemada_2013_2025_ha"] is not None]
resumen["sectores_historial"] = {
    "con_dato": len(con_fuego),
    "quemados": sum(1 for x in con_fuego if x["franja_quemada_2013_2025_ha"] >= 0.5),
    "reincidentes": sum(1 for x in con_fuego if x["franja_reincidente_2013_2025_ha"] >= 0.5),
}


def suma_crec(datos):
    return {d: {k: round(sum(v[d][k] for v in datos.values())) for k in PARTES} for d in ("100m", "500m")}


resumen["crecimiento"] = {"col1_2022": suma_crec(crec1), "col2_2022": suma_crec(crec2[2022]), "col2_2024": suma_crec(crec2[2024])}
resumen["poblacion"] = {d: {k: round(sum((p or {}).get(d, {}).get(k, 0) for p in pobl.values())) for k in GRUPOS_POB}
                        for d in ("100m", "500m", "total")}
resumen["poblacion"]["centro"] = {d: sum(f["poblacion"]["centro"][d] for f in filas if f["poblacion"]) for d in ("100m", "500m")}
resumen["top_personas"] = [{"slug": f["slug"], "comuna": f["comuna"], "region": f["region"], **f["poblacion"]["100m"],
                            "personas_500m": f["poblacion"]["500m"]["personas"], "personas_total": f["poblacion"]["total"]["personas"]}
                           for f in sorted((f for f in filas if f["poblacion"]), key=lambda f: -f["poblacion"]["100m"]["personas"])[:15]]
resumen["top_llego_ciudad"] = [{"slug": f["slug"], "comuna": f["comuna"], "region": f["region"], **f["crecimiento"]["100m"]}
                               for f in sorted(filas, key=lambda f: -f["crecimiento"]["100m"]["llego_ciudad_ha"])[:15]]
json.dump(resumen, open(OUT / "resumen.json", "w"), ensure_ascii=False)

with open(OUT / "limite-vivo-comunas.csv", "w", newline="", encoding="utf-8-sig") as fh:
    w = csv.writer(fh)
    w.writerow(["comuna", "provincia", "region", "area_ha", "puesto_nacional",
                "c1_2000_plantacion_ha", "c1_2000_plantacion_100m_ha", "c1_2000_plantacion_200m_ha", "c1_2000_plantacion_500m_ha",
                "c1_2022_plantacion_ha", "c1_2022_plantacion_100m_ha", "c1_2022_plantacion_200m_ha", "c1_2022_plantacion_500m_ha",
                "c2_2024_plantacion_ha", "c2_2024_plantacion_100m_ha", "c2_2024_plantacion_200m_ha", "c2_2024_plantacion_500m_ha",
                "fuego_franja_plantacion_ha", "fuego_franja_plantacion_quemada_ha", "fuego_franja_natural_ha", "fuego_franja_natural_quemada_ha",
                "c1_100m_ya_estaba_ha", "c1_100m_llego_la_ciudad_ha", "c1_100m_plantacion_nueva_ha",
                "c1_500m_ya_estaba_ha", "c1_500m_llego_la_ciudad_ha", "c1_500m_plantacion_nueva_ha",
                "censo2024_personas_100m", "censo2024_personas_500m", "censo2024_viviendas_100m", "censo2024_ninos_0_13_100m",
                "censo2024_mayores_60_100m", "censo2024_dificultad_mover_100m", "censo2024_personas_en_manzanas",
                "censo2024_personas_100m_centro", "censo2024_personas_500m_centro"])
    for f in orden:
        fu = f["fuego_col1"] or {}
        w.writerow([f["comuna"], f["provincia"], f["region"], f["area_ha"], f["puesto"] or "",
                    *[f["col1"]["2000"][k] for k in ("plantacion_ha", "plantacion_100m_ha", "plantacion_200m_ha", "plantacion_500m_ha")],
                    *[f["col1"]["2022"][k] for k in ("plantacion_ha", "plantacion_100m_ha", "plantacion_200m_ha", "plantacion_500m_ha")],
                    *[f["col2"]["2024"][k] for k in ("plantacion_ha", "plantacion_100m_ha", "plantacion_200m_ha", "plantacion_500m_ha")],
                    fu.get("plantacion_ha", ""), fu.get("plantacion_quemada_ha", ""), fu.get("natural_ha", ""), fu.get("natural_quemada_ha", ""),
                    *[f["crecimiento"][d][k] for d in ("100m", "500m") for k in ("ya_estaba_ha", "llego_ciudad_ha", "plantacion_nueva_ha")],
                    *([f["poblacion"]["100m"]["personas"], f["poblacion"]["500m"]["personas"], f["poblacion"]["100m"]["viviendas"],
                       f["poblacion"]["100m"]["ninos_0_13"], f["poblacion"]["100m"]["mayores_60"], f["poblacion"]["100m"]["dificultad_mover"],
                       f["poblacion"]["total"]["personas"], f["poblacion"]["centro"]["100m"], f["poblacion"]["centro"]["500m"]]
                      if f["poblacion"] else [""] * 9)])
print(len(filas), "comunas;", len(con), "con plantación cerca de zonas pobladas")
print(json.dumps(resumen["nacional"], indent=0)[:600])
print(resumen["validacion"])
