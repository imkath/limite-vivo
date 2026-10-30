"""Convierte la planilla oficial de MapBiomas Chile (Colección 2, nivel político)
en JSON livianos por comuna para el explorador.

Fuente: statistics_lulc_chile_col2_political_level_234.xlsx (chile.mapbiomas.org).
"""
import json, re, sys, unicodedata, collections
from pathlib import Path
import openpyxl

SRC = Path(sys.argv[1])
OUT = Path(sys.argv[2]); (OUT / 'comunas').mkdir(parents=True, exist_ok=True)

# Grupos legibles (código de clase nivel 3 -> grupo)
GRUPOS = {
    'bosque_nativo':   {'nombre': 'Bosque nativo', 'color': '#1f8d49', 'clases': [3, 59, 60, 67]},
    'matorral':        {'nombre': 'Matorral', 'color': '#a89358', 'clases': [66]},
    'estepa_pastizal': {'nombre': 'Estepa y pastizal', 'color': '#d6bc74', 'clases': [12, 63]},
    'humedal':         {'nombre': 'Humedal', 'color': '#519799', 'clases': [11]},
    'plantacion':      {'nombre': 'Plantación forestal', 'color': '#7a5900', 'clases': [9]},
    'agricultura':     {'nombre': 'Agricultura', 'color': '#e974ed', 'clases': [18]},
    'pastura':         {'nombre': 'Pastura', 'color': '#edde8e', 'clases': [15]},
    'urbano':          {'nombre': 'Infraestructura urbana', 'color': '#d4271e', 'clases': [24]},
    'sin_vegetacion':  {'nombre': 'Sin vegetación (roca, arena, salar)', 'color': '#ffaa5f', 'clases': [23, 25, 29, 61]},
    'agua':            {'nombre': 'Ríos, lagos y mar', 'color': '#2532e4', 'clases': [33]},
    'hielo_nieve':     {'nombre': 'Hielo y nieve', 'color': '#93dfe6', 'clases': [34]},
    'no_observado':    {'nombre': 'No observado', 'color': '#c7c7c7', 'clases': [27]},
}
CLASE_A_GRUPO = {c: g for g, d in GRUPOS.items() for c in d['clases']}

def slug(s):
    s = unicodedata.normalize('NFKD', s).encode('ascii', 'ignore').decode()
    return re.sub(r'[^a-z0-9]+', '-', s.lower()).strip('-')

wb = openpyxl.load_workbook(SRC, read_only=True)

# Cobertura
ws = wb['COVERAGE']; rows = ws.iter_rows(values_only=True); h = list(next(rows))
yc = [(i, int(str(c)[1:])) for i, c in enumerate(h) if c and str(c).startswith('y')]
ANIOS = [a for _, a in yc]
serie = collections.defaultdict(lambda: collections.defaultdict(lambda: [0.0] * len(yc)))
meta = {}
desconocidas = set()
for r in rows:
    if r[5] is None:
        continue
    g = CLASE_A_GRUPO.get(r[5])
    if g is None:
        desconocidas.add(r[5]); continue
    k = (r[2], r[3], r[4]); meta[k] = True
    for j, (i, _) in enumerate(yc):
        serie[k][g][j] += float(r[i] or 0)
assert not desconocidas, desconocidas

# Transiciones 1999-2024 (cambio neto entre grupos)
ws = wb['TRANSITION']; rows = ws.iter_rows(values_only=True); h = list(next(rows))
ip = h.index('p1999_2024')
trans = collections.defaultdict(lambda: collections.defaultdict(float))
for r in rows:
    if r[5] is None or r[6] is None:
        continue
    gf, gt = CLASE_A_GRUPO.get(r[5]), CLASE_A_GRUPO.get(r[6])
    if gf is None or gt is None or gf == gt:
        continue
    v = float(r[ip] or 0)
    if v > 0:
        trans[(r[2], r[3], r[4])][(gf, gt)] += v

indice, ranking = [], []
i0, i1 = 0, len(ANIOS) - 1
for k in sorted(serie):
    region, provincia, comuna = k
    s = slug(f'{comuna}-{region}') if sum(1 for x in serie if x[2] == comuna) > 1 else slug(comuna)
    grupos = {g: [round(v, 1) for v in vals] for g, vals in serie[k].items()}
    area = round(sum(vals[i0] for vals in serie[k].values()), 1)
    flujos = sorted(((gf, gt, round(v, 1)) for (gf, gt), v in trans[k].items()), key=lambda x: -x[2])[:12]
    json.dump({'comuna': comuna, 'provincia': provincia, 'region': region, 'slug': s, 'area_ha': area,
               'anios': ANIOS, 'grupos': grupos, 'transiciones_1999_2024': flujos},
              open(OUT / 'comunas' / f'{s}.json', 'w'), ensure_ascii=False, separators=(',', ':'))
    indice.append({'slug': s, 'comuna': comuna, 'provincia': provincia, 'region': region, 'area_ha': area})
    def delta(g):
        v = grupos.get(g, [0] * len(ANIOS)); return round(v[i1] - v[i0], 1), round(v[i0], 1)
    fila = {'slug': s, 'comuna': comuna, 'region': region, 'area_ha': area}
    for g in ('bosque_nativo', 'plantacion', 'urbano', 'agricultura', 'humedal', 'hielo_nieve'):
        d, base = delta(g); fila[g] = {'delta_ha': d, 'base_ha': base, 'delta_pct': round(d / base * 100, 1) if base >= 50 else None}
    ranking.append(fila)

json.dump({'anios': ANIOS, 'grupos': {g: {'nombre': d['nombre'], 'color': d['color'], 'clases': d['clases']} for g, d in GRUPOS.items()},
           'comunas': indice}, open(OUT / 'indice.json', 'w'), ensure_ascii=False, separators=(',', ':'))
json.dump(ranking, open(OUT / 'ranking.json', 'w'), ensure_ascii=False, separators=(',', ':'))
print('comunas', len(indice), 'años', ANIOS[0], ANIOS[-1])
