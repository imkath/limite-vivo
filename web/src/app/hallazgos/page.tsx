import type { Metadata } from "next";
import Migas from "@/components/Migas";
import Link from "next/link";
import { nombreSector } from "@/lib/sectores";
import { VISOR_CONAF } from "@/lib/enlaces";
import { CONJUNTO_DE_DATOS, JsonLd } from "@/components/DatosEstructurados";
import { resumen } from "@/lib/datos";
import { ha, pctSigno } from "@/lib/formato";

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
          <table className="w-full min-w-[560px] max-w-3xl text-sm">
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
        <div className="overflow-x-auto">
          <table className="w-full min-w-[620px] text-sm">
            <thead>
              <tr className="border-b border-ink text-left">
                <th className="py-2 pr-2 font-medium">Sector</th>
                <th className="py-2 pr-2 font-medium">Comuna</th>
                <th className="py-2 pr-2 text-right font-medium">Plantación a menos de 100 m</th>
                <th className="py-2 pr-2 text-right font-medium">Borde expuesto (aprox.)</th>
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
                  <td className="py-2 pr-2 text-right">{(Math.round(s.borde_m / 10) * 10).toLocaleString("es-CL")} m</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
