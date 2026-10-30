"""Pruebas unitarias del cálculo de franjas y de la validación."""
import sys

import numpy as np

sys.path.insert(0, "scripts")
from franja import URBANO, zona_poblada  # noqa: E402
from validacion_mh import razon_mh  # noqa: E402

AREA = np.full((60, 1), 0.075)  # ha por píxel, como en Chile central


def test_carretera_no_es_zona_poblada():
    c = np.zeros((60, 60), np.uint8)
    c[30, :] = URBANO          # línea de 1 píxel (camino)
    c[10:12, :] = URBANO       # línea de 2 píxeles
    assert not zona_poblada(c, AREA).any()


def test_mancha_chica_se_descarta_y_grande_se_mantiene():
    c = np.zeros((60, 60), np.uint8)
    c[5:9, 5:9] = URBANO       # 16 px = 1,2 ha, menor a 2 ha
    c[30:40, 30:40] = URBANO   # 100 px = 7,5 ha
    m = zona_poblada(c, AREA)
    assert not m[5:9, 5:9].any()
    assert m[30:40, 30:40].all()


def test_ciudad_con_camino_conserva_la_ciudad_y_borra_el_camino():
    c = np.zeros((60, 60), np.uint8)
    c[20:35, 20:35] = URBANO
    c[27, 35:] = URBANO        # camino que sale de la ciudad
    m = zona_poblada(c, AREA)
    assert m[20:35, 20:35].all()
    assert not m[27, 40:].any()


def test_mh_sin_diferencia_da_uno():
    filas = [dict(p=100, pq=10, n=200, nq=20), dict(p=50, pq=25, n=50, nq=25)]
    assert abs(razon_mh(filas, "p", "pq", "n", "nq") - 1) < 1e-9


def test_mh_doble_da_dos():
    filas = [dict(p=100, pq=20, n=100, nq=10), dict(p=300, pq=60, n=100, nq=10)]
    assert abs(razon_mh(filas, "p", "pq", "n", "nq") - 2) < 1e-9


if __name__ == "__main__":
    for nombre, f in list(globals().items()):
        if nombre.startswith("test_"):
            f()
            print("ok", nombre)
