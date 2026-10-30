import type { Metadata } from "next";
import Migas from "@/components/Migas";
import Link from "next/link";
import { nombreSector } from "@/lib/sectores";
import { VISOR_CONAF } from "@/lib/enlaces";
import { CONJUNTO_DE_DATOS, JsonLd } from "@/components/DatosEstructurados";
import { resumen, type Origen as Partes } from "@/lib/datos";
import { entero, ha, pct, pctSigno, tasa } from "@/lib/formato";
import Origen from "@/components/Origen";

export const metadata: Metadata = {
  title: "Hallazgos",
  description:
    "Cuánta plantación forestal hay junto a las zonas pobladas de Chile, cómo cambió desde 2000 y qué pasó con ella en los incendios de 2023 a 2025.",
};

const nf2 = new Intl.NumberFormat("es-CL", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const DIST = [
  ["plantacion_100m_ha", "A menos de 100 m"],
  ["plantacion_200m_ha", "A menos de 200 m"],
  ["plantacion_500m_ha", "A menos de 500 m"],
] as const;

export default function Hallazgos() {
  const r = resumen();
  const c1 = r.nacional.col1;
  const c2 = r.nacional.col2;
  const v1 = r.validacion.col1.natural;
  const v2 = r.validacion.col2.natural;
  const crec = (a: number, b: number) => ((b - a) / a) * 100;
  const conFranja = r.comunas.filter((c) => c.puesto !== null).length;

  // Rango de cada parte del origen entre colecciones (C1 2000-2022, C2 2000-2022) y distancias (100 y 500 m)
  const casos: Partes[] = [r.crecimiento.col1_2022["100m"], r.crecimiento.col1_2022["500m"], r.crecimiento.col2_2022["100m"], r.crecimiento.col2_2022["500m"]];
  const parte = (k: "ya_estaba_ha" | "llego_ciudad_ha" | "plantacion_nueva_ha") =>
    casos.map((o) => tasa(o[k], o.ya_estaba_ha + o.llego_ciudad_ha + o.plantacion_nueva_ha));
  const rango = (v: number[]) => `entre el ${pct(Math.min(...v)).replace("\u00a0%", "")} y el ${pct(Math.max(...v))}`;
  const o1 = r.crecimiento.col1_2022["100m"];
  const po = r.poblacion;
  const ORIGENES = [
    ["Colección 1, 2000-2022, a menos de 100 m", r.crecimiento.col1_2022["100m"]],
    ["Colección 1, 2000-2022, a menos de 500 m", r.crecimiento.col1_2022["500m"]],
    ["Colección 2, 2000-2022, a menos de 100 m", r.crecimiento.col2_2022["100m"]],
    ["Colección 2, 2000-2022, a menos de 500 m", r.crecimiento.col2_2022["500m"]],
    ["Colección 2, 2000-2024, a menos de 100 m", r.crecimiento.col2_2024["100m"]],
  ] as const;

  return (
    <div className="space-y-16">
      <JsonLd datos={CONJUNTO_DE_DATOS} />
      <header className="max-w-3xl space-y-3">
        <Migas ruta={[{ texto: "Hallazgos" }]} />
        <h1 className="text-3xl font-semibold leading-tight tracking-tight sm:text-4xl">Hallazgos</h1>
        <p className="text-lg text-muted">
          Lo que muestran los mapas de MapBiomas Chile sobre la plantación forestal que llega hasta el borde de las zonas
          pobladas, separada del bosque nativo y el matorral. Sirve para discutir con cifras las franjas de protección entre
          plantaciones y viviendas, y complementa el{" "}
          <a href={VISOR_CONAF} target="_blank" rel="noopener noreferrer" className="text-link underline">mapa de riesgo de CONAF</a>.
          El detalle del cálculo y sus límites está en la{" "}
          <Link href="/metodologia/" className="text-link underline">metodología</Link>.
        </p>
      </header>

      <section aria-labelledby="chile" className="space-y-4">
        <h2 id="chile" className="text-2xl font-semibold tracking-tight">Chile completo</h2>
        <p className="max-w-3xl">
          En 2022 había {ha(c1["2022"].plantacion_500m_ha)} de plantación forestal a menos de 500 m de una zona poblada,
          repartidas en {conFranja} comunas. De esas, {ha(c1["2022"].plantacion_100m_ha)} estaban a menos de 100 m, más o menos
          una cuadra. Dicho de otro modo, una franja de protección de 100 m alrededor de las zonas pobladas abarcaría hoy{" "}
          {ha(c1["2022"].plantacion_100m_ha)} de plantación, y una de 500 m, {ha(c1["2022"].plantacion_500m_ha)}. La ficha de cada
          comuna da la cifra local.
        </p>
        <div className="overflow-x-auto">
          <table className="w-full max-w-3xl text-sm">
            <caption className="mb-2 text-left text-muted">Hectáreas de plantación forestal según su distancia a zonas pobladas</caption>
            <thead>
              <tr className="border-b border-ink text-left">
                <th className="py-2 font-medium">Distancia</th>
                <th className="py-2 text-right font-medium">2000 (C1)</th>
                <th className="py-2 text-right font-medium">2022 (C1)</th>
                <th className="py-2 text-right font-medium">2000 (C2)</th>
                <th className="py-2 text-right font-medium">2024 (C2)</th>
              </tr>
            </thead>
            <tbody>
              {DIST.map(([k, t]) => (
                <tr key={k} className="border-b border-line">
                  <td className="py-2">{t}</td>
                  <td className="py-2 text-right">{ha(c1["2000"][k])}</td>
                  <td className="py-2 text-right">{ha(c1["2022"][k])}</td>
                  <td className="py-2 text-right">{ha(c2["2000"][k])}</td>
                  <td className="py-2 text-right">{ha(c2["2024"][k])}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="max-w-3xl text-sm text-muted">
          C1 y C2 son las Colecciones 1 y 2 de MapBiomas Chile. La franja de 500 m creció{" "}
          {pctSigno(crec(c1["2000"].plantacion_500m_ha, c1["2022"].plantacion_500m_ha))} según la primera y{" "}
          {pctSigno(crec(c2["2000"].plantacion_500m_ha, c2["2024"].plantacion_500m_ha))} según la segunda. La diferencia viene de
          cómo cada colección dibuja la infraestructura urbana, así que mostramos las dos en vez de elegir la que conviene.{" "}
          <Link href="/metodologia/" className="text-link underline">Metodología</Link>
        </p>
      </section>

      <section aria-labelledby="origen" className="space-y-4">
        <h2 id="origen" className="text-2xl font-semibold tracking-tight">Quién se acercó a quién</h2>
        <p className="max-w-3xl">
          La franja creció por dos caminos que se deciden en lugares distintos. Uno es la ciudad que se extiende hasta plantaciones
          que ya existían, algo que pasa por el Plan Regulador y los permisos de loteo. El otro es la plantación nueva junto a las
          casas, que depende de dónde se planta. Límite Vivo separa los dos, píxel a píxel, comparando 2000 con 2022.
        </p>
        <p className="max-w-3xl">
          Según la Colección 1, de las {ha(o1.final_ha)} de plantación que en 2022 estaban a menos de 100 m de una zona poblada,{" "}
          {ha(o1.ya_estaba_ha)} ya estaban ahí en 2000, {ha(o1.llego_ciudad_ha)} ya existían más lejos y la ciudad creció hasta
          ellas, y {ha(o1.plantacion_nueva_ha)} se plantaron después de 2005.
        </p>
        <Origen o={o1} distancia="100 m" />
        <p className="max-w-3xl">
          Las dos colecciones no dan las mismas proporciones. Según la colección y la distancia, {rango(parte("llego_ciudad_ha"))}{" "}
          de la plantación junto a las casas es plantación que ya existía y a la que llegó la ciudad, y{" "}
          {rango(parte("plantacion_nueva_ha"))} se plantó después de 2005. En las dos, ambos caminos pesan; ninguno explica la
          franja por sí solo.
        </p>
        <div className="overflow-x-auto">
          <table className="w-full max-w-3xl text-sm">
            <caption className="mb-2 text-left text-muted">Origen de la plantación junto a zonas pobladas, en hectáreas</caption>
            <thead>
              <tr className="border-b border-ink text-left">
                <th className="py-2 pr-2 font-medium">Caso</th>
                <th className="py-2 pr-2 text-right font-medium">Ya estaba</th>
                <th className="py-2 pr-2 text-right font-medium">Llegó la ciudad</th>
                <th className="py-2 text-right font-medium">Plantación nueva</th>
              </tr>
            </thead>
            <tbody>
              {ORIGENES.map(([t, o]) => (
                <tr key={t} className="border-b border-line">
                  <td className="py-2 pr-2">{t}</td>
                  <td className="py-2 pr-2 text-right">{ha(o.ya_estaba_ha)}</td>
                  <td className="py-2 pr-2 text-right">{ha(o.llego_ciudad_ha)}</td>
                  <td className="py-2 text-right">{ha(o.plantacion_nueva_ha)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="max-w-3xl text-sm text-muted">
          Una plantación se considera existente si aparece como plantación en algún año entre 2000 y 2005, para no confundir la
          cosecha y la replantación con plantación nueva. Hernández y otros (2024) midieron con MapBiomas el crecimiento de la
          infraestructura urbana de Chile entre 2000 y 2022; aquí se mide ese crecimiento en relación con la plantación y por
          comuna.
        </p>
      </section>

      <section aria-labelledby="personas" className="space-y-4">
        <h2 id="personas" className="text-2xl font-semibold tracking-tight">Personas que viven al lado</h2>
        <p className="max-w-3xl">
          Con las manzanas del Censo 2024, {entero(po["100m"].personas)} personas viven en manzanas que llegan a menos de 100 m de
          plantación forestal, en {entero(po["100m"].viviendas)} viviendas ocupadas. Si se cuentan solo las manzanas cuyo centro
          está a menos de 100 m, son {entero(po.centro["100m"])}. La cifra real de personas que viven a menos de una cuadra de una
          plantación está entre esos dos valores. A menos de 500 m, el rango va de {entero(po.centro["500m"])} a{" "}
          {entero(po["500m"].personas)}. En esas manzanas que llegan a menos de 100 m hay {entero(po["100m"].ninos_0_13)} niñas y niños de 0 a 13 años,{" "}
          {entero(po["100m"].mayores_60)} personas de 60 años o más y {entero(po["100m"].dificultad_mover)} personas que no pueden
          caminar o subir escaleras, o lo hacen con mucha dificultad.
        </p>
        <p className="max-w-3xl">
          Sarricolea y otros (2020) estimaron que cerca de 3 millones de personas viven en la interfaz urbano-forestal entre
          Valparaíso y La Araucanía, considerando toda la vegetación que puede quemarse. La cifra de Límite Vivo es más acotada a
          propósito: solo plantación forestal, para todo el país y comuna por comuna.
        </p>
        <div className="overflow-x-auto">
          <table className="w-full max-w-3xl text-sm">
            <caption className="mb-2 text-left text-muted">Las 15 comunas con más personas a menos de 100 m de plantación forestal</caption>
            <thead>
              <tr className="border-b border-ink text-left">
                <th className="py-2 pr-2 font-medium">Comuna</th>
                <th className="py-2 pr-2 text-right font-medium">Manzanas que llegan a menos de 100 m</th>
                <th className="py-2 pr-2 text-right font-medium">A menos de 500 m</th>
                <th className="py-2 text-right font-medium">De quienes viven en manzanas</th>
              </tr>
            </thead>
            <tbody>
              {r.top_personas.map((x) => (
                <tr key={x.slug} className="border-b border-line">
                  <td className="py-2 pr-2">
                    <Link href={`/comuna/${x.slug}/#personas`} className="text-link underline-offset-2 hover:underline">{x.comuna}</Link>
                  </td>
                  <td className="py-2 pr-2 text-right">{entero(x.personas)}</td>
                  <td className="py-2 pr-2 text-right">{entero(x.personas_500m)}</td>
                  <td className="py-2 text-right">{pct(tasa(x.personas, x.personas_total))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="max-w-3xl text-sm text-muted">
          Se cuentan las manzanas urbanas y de aldeas del Censo 2024, que reúnen al 89 % de la población; quedan fuera las
          viviendas rurales dispersas, que sumarían personas. La tabla usa el criterio amplio (manzanas que llegan a menos de 100
          m). Plantación de 2022 (Colección 1).
        </p>
      </section>

      <section aria-labelledby="incendios" className="max-w-3xl space-y-4">
        <h2 id="incendios" className="text-2xl font-semibold tracking-tight">Qué pasó en los incendios de 2023 a 2025</h2>
        <p>
          En las comunas donde hubo fuego cerca de zonas pobladas, comparamos dentro de la misma franja de 500 m qué parte de la
          plantación se quemó y qué parte del bosque nativo, el matorral y el pastizal. La plantación se quemó en mayor
          proporción, {nf2.format(v1.rr)} veces más con la Colección 1 (intervalo de 95 %, {nf2.format(v1.ic95[0])} a{" "}
          {nf2.format(v1.ic95[1])}; en {v1.comunas_mayor} de {v1.comunas} comunas) y {nf2.format(v2.rr)} veces más con la
          Colección 2 ({nf2.format(v2.ic95[0])} a {nf2.format(v2.ic95[1])}; en {v2.comunas_mayor} de {v2.comunas} comunas).
        </p>
        <p>
          Son tres temporadas de incendios y el resultado muestra una asociación, no una causa. Tampoco se cumple en todas
          partes. En Viña del Mar, por ejemplo, el incendio de febrero de 2024 quemó en proporción más vegetación natural que
          plantación. Límite Vivo no anticipa dónde va a partir un incendio. Muestra dónde la plantación forestal llega hasta el
          borde de las zonas pobladas.
        </p>
      </section>

      <section aria-labelledby="sectores" className="space-y-4">
        <h2 id="sectores" className="text-2xl font-semibold tracking-tight">Los bordes con más plantación junto a las casas</h2>
        <p className="max-w-3xl">
          Una comuna grande puede tener la plantación concentrada en unos pocos bordes. Por eso Límite Vivo divide el borde de cada
          zona poblada en sectores de alrededor de 1 km y mide cuánta plantación tiene cada uno a menos de 100 m. En todo el país hay{" "}
          {r.sectores_total.toLocaleString("es-CL")} sectores así. Estos son los 25 con más plantación; el resto está en la ficha de
          cada comuna.
        </p>
        <p className="max-w-3xl">
          Donde hay datos de MapBiomas Fuego, la ficha también dice cuánto de la franja de 100 m de cada sector se quemó entre
          2013 y 2025. De {r.sectores_historial.con_dato.toLocaleString("es-CL")} sectores con datos,{" "}
          {r.sectores_historial.quemados.toLocaleString("es-CL")} tuvieron al menos media hectárea quemada en ese período y{" "}
          {r.sectores_historial.reincidentes.toLocaleString("es-CL")} tuvieron media hectárea o más que se quemó dos o más veces.
        </p>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-ink text-left">
                <th className="py-2 pr-2 font-medium">Sector</th>
                <th className="py-2 pr-2 font-medium">Comuna</th>
                <th className="py-2 pr-2 text-right font-medium">Plantación a menos de 100 m</th>
                <th className="hidden py-2 pr-2 text-right font-medium sm:table-cell">Borde expuesto (aprox.)</th>
              </tr>
            </thead>
            <tbody>
              {r.sectores_top.map((s) => (
                <tr key={`${s.slug}-${s.n}`} className="border-b border-line">
                  <td className="py-2 pr-2">{nombreSector(s)}</td>
                  <td className="py-2 pr-2">
                    <Link href={`/comuna/${s.slug}/`} className="text-link underline-offset-2 hover:underline">{s.comuna}</Link>
                    <span className="text-muted">, sector {s.n}</span>
                  </td>
                  <td className="py-2 pr-2 text-right">{ha(s.plantacion_100m_ha)}</td>
                  <td className="hidden py-2 pr-2 text-right sm:table-cell">{(Math.round(s.borde_m / 10) * 10).toLocaleString("es-CL")} m</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
