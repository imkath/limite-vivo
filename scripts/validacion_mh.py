"""Razón de Mantel-Haenszel para tasas de quema por área, estratificada por comuna."""


def razon_mh(filas, x, xq, y, yq):
    """filas: dicts con área total y quemada de dos coberturas (x e y) en cada comuna."""
    num = sum(f[xq] * f[y] / (f[x] + f[y]) for f in filas if f[x] + f[y] > 0)
    den = sum(f[yq] * f[x] / (f[x] + f[y]) for f in filas if f[x] + f[y] > 0)
    return num / den if den else float("nan")
