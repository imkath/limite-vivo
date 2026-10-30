"""Agrega a cada comuna los indicadores del diagnóstico: promedios trienales,
comparación con su región y posición nacional. Lee out/ (salida de procesar.py)."""
import json, sys
from pathlib import Path

OUT = Path(sys.argv[1]); C = OUT / 'comunas'
idx = json.load(open(OUT / 'indice.json')); ANIOS = idx['anios']; GR = list(idx['grupos'])

def prom(serie, a0, a1):
    i0, i1 = ANIOS.index(a0), ANIOS.index(a1)
    v = serie[i0:i1 + 1]; return sum(v) / len(v)

PERIODOS = {'inicio': (1999, 2001), 'catastro2015': (2014, 2016), 'actual': (2022, 2024)}
datos = {c['slug']: json.load(open(C / f"{c['slug']}.json")) for c in idx['comunas']}

def indicadores(grupos, area):
    out = {}
    for g in GR:
        s = grupos.get(g, [0] * len(ANIOS))
        p = {k: prom(s, *v) for k, v in PERIODOS.items()}
        def cambio(a, b):
            d = p[b] - p[a]
            return {'ha': round(d, 1), 'pct': round(d / p[a] * 100, 1) if p[a] >= 20 else None}
        out[g] = {'actual_ha': round(p['actual'], 1), 'actual_pct_area': round(p['actual'] / area * 100, 2) if area else 0,
                  'inicio_ha': round(p['inicio'], 1), 'c2015_ha': round(p['catastro2015'], 1),
                  'cambio_total': cambio('inicio', 'actual'), 'cambio_desde_2015': cambio('catastro2015', 'actual')}
    return out

# Regiones (suma de comunas)
regiones = {}
for d in datos.values():
    r = regiones.setdefault(d['region'], {'area_ha': 0, 'grupos': {g: [0.0] * len(ANIOS) for g in GR}})
    r['area_ha'] += d['area_ha']
    for g, s in d['grupos'].items():
        r['grupos'][g] = [a + b for a, b in zip(r['grupos'][g], s)]
ind_region = {k: indicadores(v['grupos'], v['area_ha']) for k, v in regiones.items()}

# Nacional
nac = {'area_ha': sum(v['area_ha'] for v in regiones.values()), 'grupos': {g: [0.0] * len(ANIOS) for g in GR}}
for v in regiones.values():
    for g, s in v['grupos'].items(): nac['grupos'][g] = [a + b for a, b in zip(nac['grupos'][g], s)]
ind_nac = indicadores(nac['grupos'], nac['area_ha'])

ind = {s: indicadores(d['grupos'], d['area_ha']) for s, d in datos.items()}

def ranking(g, campo, clave, asc):
    vals = [(s, ind[s][g][campo][clave]) for s in ind if ind[s][g][campo][clave] is not None and ind[s][g]['inicio_ha' if campo == 'cambio_total' else 'c2015_ha'] >= 50]
    vals.sort(key=lambda x: x[1], reverse=not asc)
    return {s: i + 1 for i, (s, _) in enumerate(vals)}, len(vals)

RANK = {
    'perdida_bosque_nativo_ha': ranking('bosque_nativo', 'cambio_total', 'ha', True),
    'perdida_bosque_nativo_pct': ranking('bosque_nativo', 'cambio_total', 'pct', True),
    'crecimiento_urbano_pct': ranking('urbano', 'cambio_total', 'pct', False),
    'crecimiento_plantacion_ha': ranking('plantacion', 'cambio_total', 'ha', False),
    'perdida_humedal_pct': ranking('humedal', 'cambio_total', 'pct', True),
}

resumen = []
for s, d in datos.items():
    d['indicadores'] = ind[s]
    d['region_indicadores'] = ind_region[d['region']]
    d['ranking'] = {k: {'puesto': v[0].get(s), 'de': v[1]} for k, v in RANK.items()}
    json.dump(d, open(C / f'{s}.json', 'w'), ensure_ascii=False, separators=(',', ':'))
    b, u, pl, h = (ind[s][g]['cambio_total'] for g in ('bosque_nativo', 'urbano', 'plantacion', 'humedal'))
    resumen.append({'slug': s, 'comuna': d['comuna'], 'region': d['region'],
                    'bosque_ha': b['ha'], 'bosque_pct': b['pct'], 'urbano_ha': u['ha'], 'urbano_pct': u['pct'],
                    'plantacion_ha': pl['ha'], 'humedal_ha': h['ha'], 'humedal_pct': h['pct'],
                    'plantacion_pct_area': ind[s]['plantacion']['actual_pct_area']})
json.dump({'nacional': ind_nac, 'comunas': resumen, 'periodos': PERIODOS}, open(OUT / 'nacional.json', 'w'), ensure_ascii=False, separators=(',', ':'))
print('ok', len(datos))
