# Límite Vivo

Plantación forestal junto a las zonas pobladas de Chile, comuna por comuna, con datos de MapBiomas Chile.

Sitio: https://limitevivo.nvrkth.com

Para cada una de las 343 comunas calcula:

- las hectáreas de plantación forestal a menos de 100, 200 y 500 m de una zona poblada, en 2000, 2022 y 2024;
- de dónde viene la plantación que hoy está junto a las casas: la que ya estaba en 2000, la que ya existía y a la que llegó la ciudad, y la que se plantó después de 2005;
- cuántas personas viven en manzanas del Censo 2024 a menos de 100 y 500 m de plantación, con niños, personas mayores y personas con dificultad para caminar;
- los sectores del borde urbano con más plantación a menos de 100 m y cuánto de su franja se quemó entre 2013 y 2025;
- cuánto se quemó la plantación de la franja de 500 m frente a la vegetación natural de la misma franja en los incendios de 2023 a 2025.

La metodología completa, el control de calidad y las limitaciones están en https://limitevivo.nvrkth.com/metodologia/.

## Datos

- MapBiomas Chile, cobertura y uso del suelo, Colecciones 1 y 2 (Google Earth Engine).
- MapBiomas Fuego Chile, Colección 1: área quemada anual y frecuencia de quema.
- Límites comunales de MapBiomas Chile (nivel político 4) y capa de comunas del MOP (servicio DPA).
- Cartografía del Censo de Población y Vivienda 2024 (INE), manzanas.
- Lugares con nombre de OpenStreetMap (© colaboradores de OpenStreetMap, ODbL).

Los datos de entrada no se incluyen en el repositorio; los scripts de descarga están en `scripts/`.

## Estructura

- `scripts/`: descarga de datos y cálculo (Python: rasterio, numpy, scipy, geopandas).
- `tests/`: pruebas automáticas y verificaciones independientes.
- `web/`: sitio estático (Next.js, exportación estática). Los datos ya calculados están en `web/public/datos/`.

## Reproducir

Orden de los cálculos, desde la raíz del repositorio:

```
python scripts/bajar_cobertura.py        # Colección 1 y comunas (Earth Engine)
python scripts/bajar_fuego.py            # MapBiomas Fuego
curl -L -o data/stats_political.xlsx https://chile.mapbiomas.org/wp-content/uploads/sites/7/2026/08/statistics_lulc_chile_col2_political_level_234.xlsx
python scripts/procesar.py data/stats_political.xlsx out && python scripts/enriquecer.py out
python scripts/comunas_mapbiomas.py      # polígonos comunales
COL=1 python scripts/nacional.py && COL=1 python scripts/validacion.py
python scripts/bajar_col2.py && python scripts/bajar_temprana.py
COL=2 python scripts/nacional.py && COL=2 python scripts/validacion.py
python scripts/sectores.py
COL=1 python scripts/crecimiento.py
COL=2 FINAL=2022 python scripts/crecimiento.py && COL=2 FINAL=2024 python scripts/crecimiento.py
python scripts/poblacion.py
python scripts/web_datos.py && python scripts/mapas.py && python scripts/geo_web.py && python scripts/web_datos.py
python scripts/grilla_direcciones.py
cd web && npm ci && npm run build
```

Los scripts de Earth Engine necesitan una cuenta con acceso a Earth Engine y un proyecto de Google Cloud.

## Licencia y cita

Código bajo licencia MIT. Los resultados derivan de datos de MapBiomas Chile y se citan según sus términos de uso:
MapBiomas – Colección 1 y 2 de la Serie Anual de Mapas de Cobertura y Uso del Suelo de Chile, y Colección 1 de MapBiomas Fuego Chile, consultadas el 30/10/2026 a través de https://chile.mapbiomas.org.

Autoría: [nvrkth.com](https://nvrkth.com)
