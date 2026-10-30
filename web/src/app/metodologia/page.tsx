import type { Metadata } from "next";
import { CITAS, resumen } from "@/lib/datos";
import { ha } from "@/lib/formato";

export const metadata: Metadata = {
  title: "Metodología",
  description: "Datos, método, control de calidad, contraste con incendios y limitaciones de Límite Vivo.",
};

const nf = new Intl.NumberFormat("es-CL", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const A = ({ href, children }: { href: string; children: React.ReactNode }) => (
  <a href={href} target="_blank" rel="noopener noreferrer" className="text-link underline">{children}</a>
);

const H2 = ({ children }: { children: React.ReactNode }) => (
  <h2 className="text-2xl font-semibold tracking-tight">{children}</h2>
);

export default function Metodologia() {
  const r = resumen();
  const v = r.validacion;
  const sens = r.sensibilidad.col1 ?? [];
  const sinUna = r.sin_una_comuna.col1;
  return (
    <article className="max-w-3xl space-y-10 leading-relaxed">
      <header className="space-y-3">
        <h1 className="text-3xl font-semibold tracking-tight">Metodología</h1>
        <p className="text-lg text-muted">Cómo se calcula cada cifra, cómo se revisó y qué no se puede concluir con ella.</p>
      </header>

      <section className="space-y-3">
        <H2>De dónde parte</H2>
        <p>
          Que la cercanía entre plantaciones y viviendas aumenta el riesgo de incendio está documentado en Chile. McWethy et al.
          (<A href="https://doi.org/10.1371/journal.pone.0201195">2018</A>) mostraron que entre 2001 y 2017 el fuego ocurrió de
          preferencia en plantaciones exóticas. Jaque Castillo et al.
          (<A href="https://doi.org/10.5194/nhess-21-3663-2021">2021</A>) identificaron la cercanía entre la expansión urbana y las
          plantaciones como el factor principal del riesgo en el Gran Concepción. Hora et al.
          (<A href="https://doi.org/10.3390/su17104416">2025</A>) encontraron más plantación a menos de 30 m de las viviendas
          destruidas en el incendio de 2023 en el Biobío. Y al presentar MapBiomas Fuego, sus autores informaron que cerca del
          30 % de los incendios afectó áreas próximas a ciudades
          (<A href="https://uchile.cl/noticias/244116/mapbiomas-fuego-revela-12-millones-de-hectareas-quemadas-en-13-anos">Universidad de Chile, 2026</A>).
        </p>
        <p>
          También existen mapas nacionales de interfaz urbano-forestal. CONAF publica un{" "}
          <A href="https://www.conaf.cl/incendios/analisis-nacional-de-riesgo-de-incendios-forestales/">análisis nacional de riesgo y
          zonas de interfaz</A> (2021, actualizado en 2024), y hay mapas de interfaz para todo el país en Schug et al.
          (<A href="https://doi.org/10.1038/s41586-023-06320-0">2023</A>) y Gelabert et al.
          (<A href="https://doi.org/10.17398/3101-7177.2.133">2026</A>).
        </p>
        <p>
          En nuestra revisión no encontramos un indicador que, para cada comuna del país y con las series de MapBiomas, cuantifique
          la plantación forestal a 100, 200 y 500 m de zonas pobladas, la siga desde el año 2000 y la contraste con el área quemada
          dentro de la misma comuna y la misma franja. Eso es lo que agrega Límite Vivo, como complemento de los trabajos
          anteriores.
        </p>
        <p>
          Hay además una necesidad práctica. La Ley 21.364 (artículo 28) exige a cada comuna un Plan Comunal para la Reducción del
          Riesgo de Desastres, y según Corporación Ciudades, con datos de SENAPRED al 6 de julio de 2026, 127 de 345 comunas no lo
          tenían (<A href="https://g5noticias.cl/2026/08/10/a-cinco-anos-de-la-nueva-institucionalidad-un-40%de-las-comunas-de-chile-siguen-sin-un-plan-formalizado-para-reducir-el-riesgo-de-desastres/">nota de prensa</A>).
          El proyecto de ley de incendios forestales y rurales (boletín 16.335-14), que propone zonas de interfaz y de
          amortiguación, seguía en trámite en octubre de 2026.
        </p>
      </section>

      <section className="space-y-3">
        <H2>Datos</H2>
        <ul className="list-disc space-y-2 pl-5">
          <li>
            Cobertura y uso del suelo de MapBiomas Chile, Colección 1, años 2000 y 2022. Son los GeoTIFF anuales de 30 m del
            almacenamiento público de MapBiomas, y son la base de las cifras principales.
          </li>
          <li>
            Cobertura y uso del suelo de MapBiomas Chile, Colección 2, años 2000, 2022 y 2024, leída en Google Earth Engine y
            descargada en la misma grilla que la Colección 1. Se usa como análisis de sensibilidad (ver control de calidad).
          </li>
          <li>
            Área quemada anual de MapBiomas Fuego Chile, Colección 1, años 2023, 2024 y 2025. Cubre de la Región de Valparaíso a
            la de La Araucanía, así que la comparación con incendios solo se hace en esas regiones.
          </li>
          <li>Límites comunales de MapBiomas Chile (nivel político 4, 343 comunas), los mismos que usa MapBiomas en sus estadísticas.</li>
          <li>Estadísticas oficiales por comuna de las Colecciones 1 y 2, para el control de calidad y el contexto de cada ficha.</li>
        </ul>
      </section>

      <section className="space-y-3">
        <H2>Método</H2>
        <ol className="list-decimal space-y-2 pl-5">
          <li>
            Zonas pobladas. Se parte de la clase infraestructura urbana (código 24), que según el equipo de MapBiomas Chile incluye
            también las carreteras principales (<A href="https://doi.org/10.5194/isprs-archives-XLVIII-3-2024-643-2024">Hernández et al., 2024</A>).
            Para quedarse con ciudades, pueblos y villorrios se eliminan las formas de menos de 3 píxeles de ancho (unos 75 a 90 m)
            con una apertura morfológica, y luego las manchas de menos de 2 ha.
          </li>
          <li>
            Distancia. Para cada píxel se calcula la distancia en metros hasta el borde de la zona poblada más cercana, con el
            tamaño real del píxel en esa latitud (unos 30 m de alto y entre 17 y 29 m de ancho). Se consideran zonas pobladas hasta
            cerca de 1 km fuera del límite comunal, porque una ciudad vecina también deja expuesta la plantación de la comuna.
          </li>
          <li>
            Franjas. Se suman las hectáreas de plantación forestal (código 9) dentro de la comuna a menos de 100, 200 y 500 m de
            una zona poblada. El área de cada píxel depende de su latitud.
          </li>
          <li>Comparación en el tiempo. El cálculo se repite para cada año disponible en cada colección.</li>
          <li>
            Sectores. Con la cobertura de 2022 (Colección 1) se marca el borde de cada zona poblada que tiene plantación a menos
            de 100 m. Los tramos de borde expuesto que quedan a menos de unos 90 m entre sí se unen, y luego se cortan en celdas
            de 0,01° (cerca de 1 km) para que cada sector sea un trozo de borde que se pueda recorrer. Cada píxel de plantación a
            menos de 100 m se asigna al punto de zona poblada más cercano, y así se suman las hectáreas de cada sector. El largo
            del borde es aproximado, porque se cuenta en píxeles de 30 m. Un sector puede incluir plantación ubicada en una comuna
            vecina, porque lo que importa es el borde donde vive la gente.
          </li>
          <li>
            Nombres de los sectores. Cada sector toma el nombre del lugar más cercano registrado en{" "}
            <A href="https://www.openstreetmap.org/copyright">OpenStreetMap</A> (barrio, población, villa o localidad; ©
            colaboradores de OpenStreetMap, licencia ODbL). Si ese lugar está a más de 500 m se indica la distancia, y si está a
            más de 2 km el sector se identifica solo por sus coordenadas. Es una referencia para ubicarse, no un límite oficial.
          </li>
        </ol>
      </section>

      <section className="space-y-3">
        <H2>Control de calidad</H2>
        <ul className="list-disc space-y-2 pl-5">
          <li>
            La plantación y la infraestructura totales de cada comuna, calculadas desde los mapas de la Colección 1, se compararon
            con la estadística oficial de MapBiomas. En 960 comparaciones la diferencia mediana fue de 0,04 % y la máxima de 0,31 %.
          </li>
          <li>
            Con la Colección 2 la plantación también calza (diferencia mediana de 0,07 %), pero la infraestructura difiere cerca de
            3 % de forma sistemática. La imagen disponible en Earth Engine no es exactamente la versión con que se publicaron las
            estadísticas, y por eso la Colección 2 se usa como análisis de sensibilidad y no como base.
          </li>
          <li>
            Las franjas se recalcularon en seis comunas con un método independiente (polígonos, buffer en metros en proyección UTM
            y área elipsoidal). En la franja de 500 m los dos métodos difieren menos de 1 %, en la de 200 m menos de 3 % y en la de
            100 m hasta 9 %, porque a esa distancia el tamaño del píxel pesa más.
          </li>
          <li>
            Hay pruebas automáticas para el filtro de zonas pobladas (un camino de 1 o 2 píxeles se elimina, una ciudad con un
            camino conserva la ciudad) y para el cálculo de Mantel-Haenszel. Las comunas sin plantación, como Macul, dan cero.
          </li>
          <li>
            La suma de la plantación de los {r.sectores_total.toLocaleString("es-CL")} sectores ({ha(r.sectores_suma_100m_ha)}) difiere en{" "}
            {nf.format(Math.abs(r.sectores_suma_100m_ha / r.nacional.col1["2022"].plantacion_100m_ha - 1) * 100)} % de la cifra
            nacional a menos de 100 m ({ha(r.nacional.col1["2022"].plantacion_100m_ha)}), porque se descartan tramos muy cortos y porque parte de la plantación se asigna a bordes de comunas
            vecinas. Ninguna comuna con 5 ha o más a menos de 100 m queda sin sectores, y la ubicación de los sectores se revisó
            sobre mapas de control en Tomé, Viña del Mar y Cabrero.
          </li>
          <li>
            Revisando mapas de control de Viña del Mar, Santa Juana y Tomé se detectó que la infraestructura incluía carreteras, lo
            que llevó al filtro descrito arriba. La verificación independiente detectó que la primera versión medía la distancia de
            centro a centro de píxel, lo que subestimaba la franja de 100 m en cerca de 15 %. Ambos errores se corrigieron antes de
            publicar.
          </li>
        </ul>
      </section>

      <section className="space-y-3">
        <H2>Contraste con los incendios de 2023 a 2025</H2>
        <p>
          Se usó la cobertura de 2022, anterior a los incendios, y el área quemada de 2023, 2024 y 2025. En la franja de 500 m de
          cada comuna se comparó la proporción quemada de la plantación con la del bosque nativo, el matorral, el pastizal y los
          humedales de la misma franja, y también con la de la agricultura.
        </p>
        <p>
          La comparación se hace dentro de cada comuna para no mezclar lugares distintos, porque cada comuna tiene su clima, su
          relieve y sus propios incendios, y lo que interesa es qué se quemó más estando en la misma franja y bajo el mismo fuego. Los
          resultados por comuna se combinaron con la razón de Mantel-Haenszel, y el intervalo de confianza de 95 % se obtuvo con 2.000 remuestreos de
          comunas. Entran las comunas con al menos 20 ha de plantación en la franja y al menos 10 ha quemadas en ella.
        </p>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[520px] text-sm">
            <thead>
              <tr className="border-b border-ink text-left">
                <th className="py-2 font-medium">Plantación frente a</th>
                <th className="py-2 text-right font-medium">Colección 1</th>
                <th className="py-2 text-right font-medium">Colección 2</th>
              </tr>
            </thead>
            <tbody>
              {(["natural", "agricola"] as const).map((k) => (
                <tr key={k} className="border-b border-line">
                  <td className="py-2">{k === "natural" ? "Vegetación natural" : "Agricultura y pasturas"}</td>
                  {(["col1", "col2"] as const).map((c) => (
                    <td key={c} className="py-2 text-right">
                      {nf.format(v[c][k].rr)} veces ({nf.format(v[c][k].ic95[0])} a {nf.format(v[c][k].ic95[1])}),{" "}
                      {v[c][k].comunas_mayor} de {v[c][k].comunas} comunas
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p>
          Con las dos colecciones la plantación cercana a zonas pobladas se quemó en mayor proporción que la vegetación natural de
          la misma franja. Con la Colección 2 el intervalo queda claramente sobre 1. Con la Colección 1 el límite inferior llega
          a {nf.format(v.col1.natural.ic95[0])}, así que con esa colección el resultado no alcanza a ser concluyente por sí solo.
        </p>
        <p>
          El resultado no depende de los umbrales de inclusión. Con la Colección 1, al cambiar el mínimo de plantación y de área
          quemada la razón queda entre{" "}
          {nf.format(Math.min(...sens.map((x) => x.natural)))} y {nf.format(Math.max(...sens.map((x) => x.natural)))} veces, y al
          sacar una comuna a la vez queda entre {sinUna ? nf.format(sinUna[0]) : "-"} y {sinUna ? nf.format(sinUna[1]) : "-"} veces.
          Hay comunas donde pasó lo contrario, como Viña del Mar en 2024, y se muestran tal cual en sus fichas.
        </p>
      </section>

      <section className="space-y-3">
        <H2>Limitaciones</H2>
        <ul className="list-disc space-y-2 pl-5">
          <li>
            Mide exposición, no probabilidad de incendio. No considera dónde se inician los fuegos, el viento, la pendiente, la
            sequía ni el manejo de cada plantación.
          </li>
          <li>
            Depende de la clasificación de MapBiomas. Las dos colecciones difieren, sobre todo en la infraestructura, y eso cambia
            cuánto creció la franja entre 2000 y 2022 o 2024. Por eso se informan las dos.
          </li>
          <li>
            Con píxeles de 30 m, la franja de 100 m tiene una incertidumbre de método de hasta 10 %. No se consideran casas
            aisladas ni zonas pobladas de menos de 2 ha.
          </li>
          <li>
            El contraste con incendios cubre tres temporadas y solo las regiones de Valparaíso a La Araucanía. Con más años podría
            cambiar.
          </li>
          <li>
            Es una asociación, no una relación causal. La plantación podría quemarse más también por dónde está dentro de la
            franja, por ejemplo en laderas.
          </li>
          <li>
            La búsqueda de trabajos previos no fue exhaustiva. Si conoces un trabajo que haga lo mismo, lo citaremos.
          </li>
        </ul>
      </section>

      <section className="space-y-3">
        <H2>Código y datos</H2>
        <p>
          Todo el procesamiento está en Python (rasterio, numpy, scipy y geopandas) y el código es público. Los resultados por
          comuna se pueden <a href="/datos/limite-vivo-comunas.csv" download className="text-link underline">descargar en CSV</a>.
        </p>
        <p className="text-sm text-muted">Fuentes de datos</p>
        <ul className="list-disc space-y-1 pl-5 text-sm text-muted">{CITAS.map((x) => <li key={x}>{x}</li>)}</ul>
      </section>
    </article>
  );
}
