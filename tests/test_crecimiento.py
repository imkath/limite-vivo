import sys

import numpy as np

sys.path.insert(0, "scripts")
from crecimiento import descomponer  # noqa: E402

P, U, O = 9, 24, 3  # plantación, infraestructura, otra cobertura


def _caso():
    """Grilla de 60x60 píxeles de 10 m: una ciudad que crece hacia el este y plantación a su alrededor."""
    c0 = np.full((60, 60), O, np.uint8)
    c0[20:40, 5:20] = U          # ciudad inicial (300 píxeles de 0,01 ha = 3 ha)
    c0[20:40, 30:40] = P         # plantación al este, a ~100 m de la ciudad inicial
    c0[5:10, 5:20] = P           # plantación al norte, a ~100 m; se cosecha después
    c1 = c0.copy()
    c1[20:40, 20:28] = U         # la ciudad crece hacia el este
    c1[5:10, 5:20] = O           # la plantación norte desaparece
    c1[42:47, 5:20] = P          # se planta al sur, a ~25 m de la ciudad
    return c0, c1


def test_partes_suman_exacto():
    c0, c1 = _caso()
    dentro = np.ones(c0.shape, bool)
    area = np.full((60, 1), 0.01)  # 10 m x 10 m = 0,01 ha
    r = descomponer(c0, c1, dentro, area, 10.0, 10.0, distancias=(50, 150))
    for d in ("50m", "150m"):
        x = r[d]
        assert abs(x["final_ha"] - (x["ya_estaba_ha"] + x["llego_ciudad_ha"] + x["plantacion_nueva_ha"])) < 1e-9
        assert abs(x["inicial_ha"] - (x["sigue_ha"] + x["salio_ha"])) < 1e-9


def test_reconoce_cada_movimiento():
    c0, c1 = _caso()
    r = descomponer(c0, c1, np.ones(c0.shape, bool), np.full((60, 1), 0.01), 10.0, 10.0, distancias=(50,))["50m"]
    assert r["inicial_ha"] == 0                 # al inicio nada estaba a menos de 50 m
    assert r["llego_ciudad_ha"] > 0             # la ciudad llegó a la plantación del este
    assert r["plantacion_nueva_ha"] > 0         # la plantación sur es nueva y está junto a la ciudad
    assert r["poblado_nuevo_junto_a_plantacion_ha"] > 0


def test_sin_cambios_todo_ya_estaba():
    c0, _ = _caso()
    r = descomponer(c0, c0, np.ones(c0.shape, bool), np.full((60, 1), 0.01), 10.0, 10.0, distancias=(150,))["150m"]
    assert r["llego_ciudad_ha"] == r["plantacion_nueva_ha"] == r["salio_ha"] == 0
    assert r["ya_estaba_ha"] == r["sigue_ha"] == r["inicial_ha"] == r["final_ha"] > 0


def test_replantacion_no_cuenta_como_nueva():
    """Un rodal talado en 2000 (otra clase ese año) que fue plantación en 2001-2005 no es plantación nueva."""
    c0, c1 = _caso()
    temprana = np.zeros(c0.shape, bool)
    temprana[42:47, 5:20] = True     # la plantación sur ya existía, solo estaba cosechada en 2000
    area = np.full((60, 1), 0.01)
    sin = descomponer(c0, c1, np.ones(c0.shape, bool), area, 10.0, 10.0, distancias=(50,))["50m"]
    con = descomponer(c0, c1, np.ones(c0.shape, bool), area, 10.0, 10.0, temprana=temprana, distancias=(50,))["50m"]
    assert sin["plantacion_nueva_ha"] > 0 and con["plantacion_nueva_ha"] == 0
    assert abs(con["ya_estaba_ha"] - sin["plantacion_nueva_ha"]) < 1e-9   # pasa a "ya estaba": la ciudad no se movió
