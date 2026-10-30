"""Extrae de la estadística oficial de la Colección 1 la superficie por comuna y clase (2000 y 2022)."""
import json
import openpyxl

wb = openpyxl.load_workbook("data/stats_col1.xlsx", read_only=True)
ws = wb["COVERAGE"]
filas = ws.iter_rows(values_only=True)
cab = next(filas)
i_nom, i_cls, i_cat = cab.index("NAME"), cab.index("class_id"), cab.index("territory_category")
i_fid = cab.index("FEATURE_ID")
i00, i22 = cab.index(2000), cab.index(2022)
out = {}
for r in filas:
    if r[i_cat] != "nivel-politico-4":
        continue
    c = out.setdefault(str(r[i_fid]), {"nombre": r[i_nom], "clases": {}})
    c["clases"][str(r[i_cls])] = {"2000": r[i00] or 0, "2022": r[i22] or 0}
json.dump(out, open("data/stats_col1_comunas.json", "w"), ensure_ascii=False)
print(len(out), "comunas")
