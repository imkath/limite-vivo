"""Genera el documento de postulación (DOCX) con las cifras de web/public/datos, para que web y PDF no se contradigan."""
import io
import json
import math
import sys

from docx import Document
from docx.enum.table import WD_TABLE_ALIGNMENT
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.oxml import OxmlElement
from docx.oxml.ns import qn
from docx.shared import Cm, Pt, RGBColor
from PIL import Image

AUTORIA = sys.argv[1] if len(sys.argv) > 1 else "[Nombre de la autora]"
WEB = sys.argv[2] if len(sys.argv) > 2 else "[enlace de la web]"
REPO = sys.argv[3] if len(sys.argv) > 3 else "[enlace del repositorio]"
REVISION = sys.argv[4] if len(sys.argv) > 4 else ""

D = "web/public/datos"
r = json.load(open(f"{D}/resumen.json"))
com = {c["slug"]: json.load(open(f"{D}/comunas/{c['slug']}.json")) for c in r["comunas"]}
c1, c2 = r["nacional"]["col1"], r["nacional"]["col2"]
v1, v2 = r["validacion"]["col1"], r["validacion"]["col2"]
sens = r["sensibilidad"]["col1"]
sin_una = r["sin_una_comuna"]["col1"]
n_sect = r["sectores_total"]
suma_sect = r["sectores_suma_100m_ha"]
top_sect = r["sectores_top"]


def n0(x):
    # Redondeo hacia arriba en .5, igual que Math.round de la web
    return f"{math.floor(x + 0.5):,}".replace(",", ".")


def n2(x):
    return f"{x:.2f}".replace(".", ",")


def n1(x):
    return f"{x:.1f}".replace(".", ",")


def nombre_sector(x):
    if x["lugar_m"] <= 500:
        return x["lugar"]
    if x["lugar_m"] <= 2000:
        d = f"{math.floor(x['lugar_m'] / 10 + 0.5) * 10} m" if x["lugar_m"] < 1000 else f"{x['lugar_m'] / 1000:.1f} km".replace(".", ",")
        return f"Cerca de {x['lugar']} (a {d})"
    return "Sin lugar con nombre a menos de 2 km"


def pct(a, b):
    return f"{(b - a) / a * 100:+.0f} %".replace("+", "+").replace("-", "−")


doc = Document()
st = doc.styles["Normal"]
st.font.name = "Aptos"
st.element.rPr.rFonts.set(qn("w:eastAsia"), "Aptos")
st.font.size = Pt(10.5)
st.paragraph_format.space_after = Pt(6)
st.paragraph_format.line_spacing = 1.2
for s in doc.sections:
    s.left_margin = s.right_margin = Cm(2.3)
    s.top_margin = s.bottom_margin = Cm(2.2)
for nivel, tam in ((1, 15), (2, 12.5)):
    h = doc.styles[f"Heading {nivel}"]
    h.font.name = "Aptos"
    h.font.size = Pt(tam)
    h.font.bold = True
    h.font.color.rgb = RGBColor(0x16, 0x18, 0x1A)
    h.paragraph_format.space_before = Pt(14)
    h.paragraph_format.space_after = Pt(6)


def p(texto, *, italic=False, size=None, align=None, color=None):
    par = doc.add_paragraph()
    run = par.add_run(texto)
    run.italic = italic
    if size:
        run.font.size = Pt(size)
    if color:
        run.font.color.rgb = RGBColor.from_string(color)
    if align:
        par.alignment = align
    return par


def lista(items):
    for t in items:
        doc.add_paragraph(t, style="List Bullet")


def tabla(cabecera, filas, anchos=None):
    t = doc.add_table(rows=1, cols=len(cabecera))
    t.alignment = WD_TABLE_ALIGNMENT.LEFT
    t.style = "Table Grid"
    for i, h in enumerate(cabecera):
        c = t.rows[0].cells[i]
        c.text = h
        c.paragraphs[0].runs[0].bold = True
    for f in filas:
        cells = t.add_row().cells
        for i, v in enumerate(f):
            cells[i].text = str(v)
            # Solo las cifras van a la derecha
            if i > 0 and any(ch.isdigit() for ch in str(v)[:3]):
                cells[i].paragraphs[0].alignment = WD_ALIGN_PARAGRAPH.RIGHT
    for row in t.rows:
        for c in row.cells:
            for par in c.paragraphs:
                par.paragraph_format.space_after = Pt(0)
                for run in par.runs:
                    run.font.size = Pt(9)
    if anchos:
        for row in t.rows:
            for i, w in enumerate(anchos):
                row.cells[i].width = Cm(w)
    doc.add_paragraph()
    return t


def imagen(slug, ancho_cm, pie):
    buf = io.BytesIO()
    Image.open(f"web/public/mapas/{slug}.webp").convert("RGB").save(buf, "PNG")
    buf.seek(0)
    doc.add_picture(buf, width=Cm(ancho_cm))
    p(pie, size=8.5, color="55595E")


# Portada
p("Premio MapBiomas Chile, primera edición (2026)", size=9, color="55595E")
p("Categoría 2: Aplicaciones generales, políticas públicas e iniciativas educativas o sociales", size=9, color="55595E")
t = doc.add_paragraph()
run = t.add_run("Límite Vivo")
run.bold = True
run.font.size = Pt(24)
p("Plantaciones forestales en el borde de las ciudades de Chile, por comuna y por sector, 2000 a 2024", size=13)
p(f"Autoría: {AUTORIA}", size=10)
p(f"Herramienta en línea: {WEB}", size=10)
p(f"Código y datos: {REPO}", size=10)

doc.add_heading("Resumen", 1)
p(
    f"Límite Vivo es una herramienta pública que calcula, para cada una de las 343 comunas de Chile, cuántas hectáreas de "
    f"plantación forestal hay a menos de 100, 200 y 500 metros de una zona poblada, cómo cambió esa franja desde el año 2000 y "
    f"qué pasó con ella en los incendios de 2023 a 2025. Todo el cálculo usa datos de MapBiomas Chile, en particular los mapas anuales de "
    f"cobertura y uso del suelo de las Colecciones 1 y 2 y el área quemada de MapBiomas Fuego, Colección 1."
)
p(
    f"En 2022 había {n0(c1['2022']['plantacion_500m_ha'])} ha de plantación a menos de 500 m de una zona poblada y "
    f"{n0(c1['2022']['plantacion_100m_ha'])} ha a menos de 100 m (Colección 1). La franja de 500 m creció "
    f"{pct(c1['2000']['plantacion_500m_ha'], c1['2022']['plantacion_500m_ha'])} entre 2000 y 2022 según la Colección 1 y "
    f"{pct(c2['2000']['plantacion_500m_ha'], c2['2024']['plantacion_500m_ha'])} entre 2000 y 2024 según la Colección 2. La "
    f"diferencia se explica por cómo cada colección clasifica la infraestructura, y por eso se informan ambas."
)
p(
    f"En las comunas con incendios cerca de zonas pobladas, la plantación de la franja de 500 m se quemó en mayor proporción que "
    f"la vegetación natural de la misma franja, {n2(v2['natural']['rr'])} veces más con la Colección 2 (intervalo de 95 %, "
    f"{n2(v2['natural']['ic95'][0])} a {n2(v2['natural']['ic95'][1])}) y {n2(v1['natural']['rr'])} veces más con la Colección 1 "
    f"({n2(v1['natural']['ic95'][0])} a {n2(v1['natural']['ic95'][1])}). Es una asociación observada en tres temporadas, no una "
    f"relación causal, y tiene excepciones como Viña del Mar en 2024."
)
p(
    f"Como una comuna puede tener la plantación concentrada en pocos bordes, el borde de cada zona poblada se divide además en "
    f"sectores de alrededor de 1 km. Hay {n0(n_sect)} sectores con plantación a menos de 100 m, cada uno con su ubicación y el nombre "
    f"del barrio, población o localidad más cercana según OpenStreetMap. "
    "La herramienta entrega una ficha por comuna con mapa, sectores, cifras por distancia, evolución, contraste con incendios y usos "
    "posibles en el Plan Comunal para la Reducción del Riesgo de Desastres (Ley 21.364). Los datos se descargan en CSV y el "
    "código es público."
)

doc.add_heading("1. Problema", 1)
p(
    "Los incendios de 2023 en Ñuble, Biobío y La Araucanía y el de febrero de 2024 en la Región de Valparaíso mostraron el daño "
    "que produce el fuego cuando llega a zonas pobladas. Una parte de ese riesgo está en el límite entre las ciudades y las "
    "plantaciones de pino y eucalipto, que en muchas comunas llegan hasta el borde de las casas."
)
p(
    "Ese límite se puede medir con los mapas de MapBiomas, pero no encontramos una cifra comparable por comuna de cuánta "
    "plantación hay junto a las zonas pobladas que un municipio pueda usar directamente. La Ley 21.364 (artículo 28) exige a cada comuna un Plan Comunal para la Reducción del Riesgo de Desastres, y "
    "según Corporación Ciudades, con datos de SENAPRED al 6 de julio de 2026, 127 de 345 comunas no lo tenían. El proyecto de "
    "ley de incendios forestales y rurales (boletín 16.335-14), que propone zonas de interfaz y de amortiguación, seguía en "
    "trámite en octubre de 2026."
)

doc.add_heading("2. Antecedentes", 1)
p(
    "La relación entre plantaciones e incendios en Chile está documentada. McWethy et al. (2018) mostraron que entre 2001 y "
    "2017 el fuego ocurrió de preferencia en plantaciones exóticas. Jaque Castillo et al. (2021) identificaron la cercanía entre "
    "la expansión urbana y las plantaciones como el factor principal del riesgo en el Gran Concepción. Hora et al. (2025) "
    "encontraron más plantación a menos de 30 m de las viviendas destruidas en el incendio de 2023 en el Biobío. Al presentar "
    "MapBiomas Fuego, sus autores informaron que cerca del 30 % de los incendios afectó áreas próximas a ciudades."
)
p(
    "Existen también mapas nacionales de interfaz urbano-forestal, como el análisis nacional de riesgo y zonas de interfaz de CONAF "
    "(2021, actualizado en 2024), Schug et al. (2023) y Gelabert et al. (2026). En nuestra revisión no encontramos un indicador "
    "que, para cada comuna y con las series de MapBiomas, cuantifique la plantación forestal a distancias fijas de las zonas "
    "pobladas, la siga desde el año 2000 y la contraste con el área quemada dentro de la misma comuna y franja. Límite Vivo se "
    "propone como complemento de esos trabajos."
)

doc.add_heading("3. Objetivo", 1)
p(
    "Entregar a municipios, organismos de emergencia y a la ciudadanía un indicador comunal, reproducible y actualizable con "
    "cada colección de MapBiomas, de cuánta plantación forestal hay junto a las zonas pobladas, cómo ha cambiado y cómo se "
    "comportó en los incendios recientes."
)

doc.add_heading("4. Datos", 1)
lista([
    "MapBiomas Chile, cobertura y uso del suelo, Colección 1 (2000 y 2022). GeoTIFF anuales de 30 m del almacenamiento público. Base de las cifras principales.",
    "MapBiomas Chile, cobertura y uso del suelo, Colección 2 (2000, 2022 y 2024), leída en Google Earth Engine y descargada en la misma grilla. Análisis de sensibilidad.",
    "MapBiomas Fuego Chile, Colección 1, área quemada anual 2023, 2024 y 2025. Cubre de Valparaíso a La Araucanía.",
    "Límites comunales de MapBiomas Chile (nivel político 4, 343 comunas) y estadísticas oficiales por comuna de ambas colecciones.",
])

doc.add_heading("5. Método", 1)
lista([
    "Zonas pobladas. Se usa la clase infraestructura urbana (código 24). Como incluye carreteras principales (Hernández et al., 2024), se eliminan las formas de menos de 3 píxeles de ancho con una apertura morfológica y las manchas de menos de 2 ha.",
    "Distancia. Para cada píxel se calcula la distancia en metros hasta el borde de la zona poblada más cercana, con el tamaño real del píxel según la latitud. Se consideran zonas pobladas hasta cerca de 1 km fuera de la comuna.",
    "Franjas. Se suman las hectáreas de plantación forestal (código 9) dentro de la comuna a menos de 100, 200 y 500 m, con el área de cada píxel según su latitud.",
    "Sectores. Con la cobertura de 2022 se marca el borde de cada zona poblada que tiene plantación a menos de 100 m. Los tramos expuestos a menos de unos 90 m entre sí se unen y se cortan en celdas de 0,01° (cerca de 1 km). Cada píxel de plantación a menos de 100 m se asigna al punto de zona poblada más cercano para sumar las hectáreas de cada sector. El largo del borde es aproximado (se cuenta en píxeles). Cada sector toma el nombre del lugar más cercano de OpenStreetMap (barrio, población, villa o localidad); si está a más de 500 m se indica la distancia y si está a más de 2 km se omite el nombre.",
    "Contraste con incendios. Con la cobertura de 2022 y el área quemada 2023 a 2025, se compara dentro de cada comuna (para no mezclar lugares con distinto clima, relieve e incendios) la proporción quemada de la plantación de la franja de 500 m con la de la vegetación natural y la agricultura de la misma franja. Las comunas se combinan con la razón de Mantel-Haenszel y el intervalo de confianza de 95 % se obtiene con 2.000 remuestreos de comunas. Entran las comunas con al menos 20 ha de plantación en la franja y 10 ha quemadas en ella.",
])

doc.add_heading("6. Control de calidad", 1)
lista([
    "En 960 comparaciones de plantación e infraestructura por comuna contra las estadísticas oficiales de la Colección 1, la diferencia mediana fue de 0,04 % y la máxima de 0,31 %.",
    "Con la Colección 2 la plantación concilia (mediana de 0,07 %), pero la infraestructura difiere cerca de 3 % de forma sistemática. La imagen de Earth Engine no es exactamente la versión de las estadísticas publicadas, y por eso esa colección se usa como análisis de sensibilidad.",
    "Las franjas de seis comunas se recalcularon con un método independiente (polígonos, buffer en UTM y área elipsoidal). Las diferencias fueron menores a 1 % en la franja de 500 m y a 3 % en la de 200 m, y llegaron a 9 % en la de 100 m.",
    f"La suma de la plantación de los {n0(n_sect)} sectores ({n0(suma_sect)} ha) difiere en {n1(abs(suma_sect / c1['2022']['plantacion_100m_ha'] - 1) * 100)} % de la cifra nacional a menos de 100 m. Ninguna comuna con 5 ha o más a esa distancia queda sin sectores, y su ubicación se revisó en mapas de control.",
    "Hay pruebas automáticas del filtro de zonas pobladas y del cálculo de Mantel-Haenszel, y las comunas sin plantación dan cero.",
    "El control encontró dos errores, que se corrigieron antes de entregar. Los mapas de control mostraron que la infraestructura incluía carreteras, y la verificación independiente mostró que la primera versión medía la distancia de centro a centro de píxel, lo que subestimaba la franja de 100 m en cerca de 15 %.",
])

doc.add_heading("7. Resultados nacionales", 1)
tabla(
    ["Distancia a zonas pobladas", "2000 (C1)", "2022 (C1)", "2000 (C2)", "2024 (C2)"],
    [[t, n0(c1["2000"][k]), n0(c1["2022"][k]), n0(c2["2000"][k]), n0(c2["2024"][k])] for k, t in (
        ("plantacion_100m_ha", "A menos de 100 m"), ("plantacion_200m_ha", "A menos de 200 m"), ("plantacion_500m_ha", "A menos de 500 m"))],
)
p("Hectáreas de plantación forestal. C1 y C2: Colecciones 1 y 2 de MapBiomas Chile.", size=8.5, color="55595E")
top = [c for c in r["comunas"] if c["puesto"]][:15]
p(f"Las 15 comunas con más plantación a menos de 500 m de zonas pobladas en 2022 (Colección 1):")
tabla(
    ["Comuna", "Región", "500 m, 2000", "500 m, 2022", "100 m, 2022"],
    [[f"{c['puesto']}. {c['comuna']}", c["region"], n0(c["p500_2000"]), n0(c["p500_2022"]), n0(c["p100_2022"])] for c in top],
)

p("Los 10 sectores del país con más plantación forestal a menos de 100 m de una zona poblada (cobertura 2022, Colección 1):")
tabla(
    ["Sector", "Comuna", "Plantación a menos de 100 m (ha)", "Borde expuesto aprox. (m)"],
    [[nombre_sector(x), f"{x['comuna']} (sector {x['n']})", n0(x["plantacion_100m_ha"]), n0(math.floor(x["borde_m"] / 10 + 0.5) * 10)] for x in top_sect[:10]],
)

doc.add_heading("8. Contraste con los incendios de 2023 a 2025", 1)
tabla(
    ["Plantación frente a", "Colección 1", "Colección 2"],
    [[nombre,
      f"{n2(v1[k]['rr'])} ({n2(v1[k]['ic95'][0])} a {n2(v1[k]['ic95'][1])}); {v1[k]['comunas_mayor']} de {v1[k]['comunas']} comunas",
      f"{n2(v2[k]['rr'])} ({n2(v2[k]['ic95'][0])} a {n2(v2[k]['ic95'][1])}); {v2[k]['comunas_mayor']} de {v2[k]['comunas']} comunas"]
     for k, nombre in (("natural", "Vegetación natural"), ("agricola", "Agricultura y pasturas"))],
)
p(
    f"Con ambas colecciones la plantación cercana a zonas pobladas se quemó en mayor proporción que la vegetación natural de la "
    f"misma franja. Con la Colección 2 el intervalo queda sobre 1; con la Colección 1 el límite inferior llega a "
    f"{n2(v1['natural']['ic95'][0])}, de modo que esa colección por sí sola no es concluyente. El resultado se mantiene al cambiar "
    f"los umbrales de inclusión (entre {n2(min(x['natural'] for x in sens))} y {n2(max(x['natural'] for x in sens))} veces) y al "
    f"sacar una comuna a la vez (entre {n2(sin_una[0])} y {n2(sin_una[1])} veces)."
)
vi = com["vina-del-mar"]["fuego_col1"]
to = com["tome"]["fuego_col1"]
p(
    f"Casos. En Tomé se quemó el {n1(to['plantacion_quemada_ha'] / to['plantacion_ha'] * 100)} % de la plantación de la franja y "
    f"el {n1(to['natural_quemada_ha'] / to['natural_ha'] * 100)} % de la vegetación natural. En Viña del Mar ocurrió lo contrario, con el "
    f"{n1(vi['plantacion_quemada_ha'] / vi['plantacion_ha'] * 100)} % de la plantación quemada frente al "
    f"{n1(vi['natural_quemada_ha'] / vi['natural_ha'] * 100)} % de la vegetación natural. Según estos mapas, el incendio de 2024 "
    f"quemó en proporción más matorral y bosque que plantación, y la herramienta muestra ese caso igual que los demás."
)
imagen("tome", 9.5, "Tomé. Rojo: zona poblada. Naranjo: plantación a menos de 500 m. Café: otra plantación. Verde claro: vegetación natural. Zonas oscurecidas: quemado 2023 a 2025. Cobertura 2022, Colección 1.")

doc.add_heading("9. La herramienta", 1)
lista([
    "Inicio con las cifras nacionales, el contraste con incendios, un mapa clicable de las comunas de Valparaíso a Los Lagos, los 25 sectores con más plantación junto a zonas pobladas y un ranking filtrable por región.",
    "Una ficha por comuna (343) con mapa, sectores numerados con enlace a OpenStreetMap, comunas vecinas, tabla por distancia en ambas colecciones, indicación de si las colecciones coinciden en la tendencia, contraste con incendios cuando hay cobertura de Fuego y usos para el municipio.",
    "Metodología completa con antecedentes, control de calidad y limitaciones.",
    "Datos descargables en CSV y código abierto en Python (rasterio, numpy, scipy, geopandas) y en la web (Next.js, exportación estática).",
])

doc.add_heading("10. Impacto potencial", 1)
p(
    "Un municipio puede incorporar la ficha como antecedente de amenaza de incendio forestal en su Plan Comunal para la "
    "Reducción del Riesgo de Desastres, priorizar cortafuegos, limpieza de bordes y rutas de evacuación donde la plantación está "
    "a menos de 100 m de las casas, y usar la cifra al revisar el Plan Regulador Comunal. Los organismos de emergencia ganan una "
    "vista nacional comparable. Si se aprueba una ley con zonas de amortiguación, la herramienta permite estimar cuánta plantación "
    "queda dentro de franjas de 100, 200 o 500 m en cada comuna. Y las organizaciones vecinales y la prensa tienen un dato verificable de su propia comuna. "
    "Como se apoya solo en datos abiertos de MapBiomas, se puede actualizar con cada nueva colección. La temporada de incendios "
    "2026-2027 coincide además con un El Niño fuerte a muy fuerte según el Centro de Predicción Climática de la NOAA (8 de octubre "
    "de 2026), lo que hace oportuno contar con estos datos antes del verano."
)

doc.add_heading("11. Limitaciones", 1)
lista([
    "Mide exposición y no probabilidad de incendio, porque no considera igniciones, viento, pendiente, sequía ni manejo.",
    "Depende de la clasificación de MapBiomas; las colecciones difieren sobre todo en infraestructura, lo que cambia la magnitud de la tendencia.",
    "Con píxeles de 30 m, la franja de 100 m tiene una incertidumbre de método de hasta 10 %. No incluye casas aisladas ni zonas pobladas de menos de 2 ha.",
    "El contraste con incendios cubre tres temporadas y solo de Valparaíso a La Araucanía, y muestra asociación, no causalidad.",
    "La revisión de trabajos previos no fue exhaustiva.",
])

if REVISION:
    doc.add_heading("12. Revisión externa", 1)
    p(REVISION)

doc.add_heading("Referencias", 1)
refs = [
    "Gelabert Vadillo, P., Félez Bernal, J., Crespo Pérez, R., Alcasena Urdioz, F. y Rodrigues Mimbrero, M. (2026). Cartografía y análisis de la Interfaz Urbano-Forestal en Chile. Actas del XXI Congreso de la Asociación Española de Teledetección. https://doi.org/10.17398/3101-7177.2.133",
    "Hernández, H. J., González, V., Cortés, L., Hormazábal, C., Muñoz, et al. (2024). Assessing Chile's national expansion of urban and artificial coverages between 2000 and 2022. ISPRS Archives XLVIII-3-2024. https://doi.org/10.5194/isprs-archives-XLVIII-3-2024-643-2024",
    "Hora, B., González-Mathiesen, C., Aravena-Solís, N. y Tapia, T. (2025). Land Cover and Wildfire Risk: A Multi-Buffer Spatial Analysis of the Relationship Between Housing Destruction and Land Cover in Chile's Bío-Bío Region in 2023. Sustainability 17(10), 4416. https://doi.org/10.3390/su17104416",
    "Jaque Castillo, E., Fernández, A., Fuentes Robles, R. y Ojeda, C. G. (2021). Data-based wildfire risk model for Mediterranean ecosystems - case study of the Concepción metropolitan area in central Chile. Natural Hazards and Earth System Sciences 21, 3663-3678. https://doi.org/10.5194/nhess-21-3663-2021",
    "McWethy, D. B., Pauchard, A., García, R. A., Holz, A., González, M. E., et al. (2018). Landscape drivers of recent fire activity (2001-2017) in south-central Chile. PLOS ONE 13(8), e0201195. https://doi.org/10.1371/journal.pone.0201195",
    "Schug, F., Bar-Massada, A., Carlson, A. R., Cox, H., et al. (2023). The global wildland-urban interface. Nature 621, 94-99. https://doi.org/10.1038/s41586-023-06320-0",
    "CONAF (2024). Análisis Nacional de Riesgo de Incendios Forestales y Zonas de Interfaz. https://www.conaf.cl/incendios/analisis-nacional-de-riesgo-de-incendios-forestales/",
    "Universidad de Chile (2026). MapBiomas Fuego revela 1,2 millones de hectáreas quemadas en 13 años. https://uchile.cl/noticias/244116/mapbiomas-fuego-revela-12-millones-de-hectareas-quemadas-en-13-anos",
    "Corporación Ciudades, con datos de SENAPRED al 6-7-2026, citado en G5 Noticias (10-8-2026). https://g5noticias.cl/2026/08/10/a-cinco-anos-de-la-nueva-institucionalidad-un-40%de-las-comunas-de-chile-siguen-sin-un-plan-formalizado-para-reducir-el-riesgo-de-desastres/",
    "Ley 21.364 (2021), artículo 28. Biblioteca del Congreso Nacional de Chile.",
    "NOAA Climate Prediction Center (2026). ENSO Diagnostic Discussion, 8 de octubre de 2026. https://www.cpc.ncep.noaa.gov/products/analysis_monitoring/enso_advisory/ensodisc.shtml",
    "OpenStreetMap (2026). Lugares con nombre (place), consultados el 30-10-2026 vía Overpass API. © colaboradores de OpenStreetMap, licencia ODbL. https://www.openstreetmap.org/copyright",
]
for t in refs:
    par = doc.add_paragraph(t)
    par.paragraph_format.left_indent = Cm(0.6)
    par.paragraph_format.first_line_indent = Cm(-0.6)
    for run in par.runs:
        run.font.size = Pt(9)

doc.add_heading("Cita de los datos de MapBiomas", 2)
for t in (
    "MapBiomas – Colección 1 de la Serie Anual de Mapas de Cobertura y Uso del Suelo de Chile, consultada el 30/10/2026 a través del enlace: https://chile.mapbiomas.org",
    "MapBiomas – Colección 2 de la Serie Anual de Mapas de Cobertura y Uso del Suelo de Chile, consultada el 30/10/2026 a través del enlace: https://chile.mapbiomas.org",
    "MapBiomas – Colección 1 de MapBiomas Fuego Chile (área quemada anual), consultada el 30/10/2026 a través del enlace: https://chile.mapbiomas.org",
):
    par = doc.add_paragraph(t)
    for run in par.runs:
        run.font.size = Pt(9)

doc.save("out/Limite_Vivo_MapBiomas_2026.docx")
print("ok")
