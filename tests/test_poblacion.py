import sys

import numpy as np

sys.path.insert(0, "scripts")
from poblacion import COLUMNAS, exposicion  # noqa: E402


def _tabla(n):
    t = {c: np.zeros(n) for c in COLUMNAS}
    t["n_per"] = np.array([10.0, 20.0, 30.0, 40.0])[:n]
    t["n_edad_0_5"] = np.array([1.0, 2.0, 3.0, 4.0])[:n]
    t["n_edad_6_13"] = np.array([1.0, 1.0, 1.0, 1.0])[:n]
    return t


def test_cuenta_solo_manzanas_dentro_de_la_distancia():
    dist = np.array([0.0, 100.0, 300.0, np.inf])
    r = exposicion(dist, _tabla(4))
    assert r["100m"]["personas"] == 30          # 0 m y 100 m cuentan, 300 m no
    assert r["500m"]["personas"] == 60          # la manzana sin plantación cerca nunca cuenta
    assert r["total"]["personas"] == 100
    assert r["100m"]["ninos_0_13"] == 1 + 1 + 2 + 1


def test_nulos_no_rompen_la_suma():
    t = _tabla(2)
    t["n_edad_60_mas"] = np.array([np.nan, 5.0])
    r = exposicion(np.array([0.0, 0.0]), t)
    assert r["100m"]["mayores_60"] == 5
