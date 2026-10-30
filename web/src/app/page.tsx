import Link from "next/link";
import Buscador from "@/components/Buscador";
import Ranking from "@/components/Ranking";
import { resumen } from "@/lib/datos";
import { ha, pctSigno } from "@/lib/formato";

const nf2 = new Intl.NumberFormat("es-CL", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const DIST = [
  ["plantacion_100m_ha", "A menos de 100 m"],
  ["plantacion_200m_ha", "A menos de 200 m"],
  ["plantacion_500m_ha", "A menos de 500 m"],
] as const;

export default function Inicio() {
  const r = resumen();
  const c1 = r.nacional.col1;
  const c2 = r.nacional.col2;
  const v1 = r.validacion.col1.natural;
  const v2 = r.validacion.col2.natural;
  const crec = (a: number, b: number) => ((b - a) / a) * 100;
  const conFranja = r.comunas.filter((c) => c.puesto !== null).length;

  return (
    <div className="space-y-16">
      <section className="max-w-3xl space-y-5">
        <h1 className="text-3xl font-semibold leading-tight tracking-tight sm:text-4xl">
          ¿Cuánta plantación de pino y eucalipto hay junto a las casas de tu comuna?
        </h1>
        <p className="text-lg text-muted">
          Límite Vivo calcula, para cada comuna de Chile, las hectáreas de plantación forestal que hay a menos de 100, 200 y
          500 metros de una zona poblada, cómo cambiaron desde el año 2000 y qué pasó con ellas en los incendios de 2023 a 2025.
          Los cálculos usan los mapas de MapBiomas Chile.
        </p>
        <Buscador comunas={r.comunas} />
      </section>

      <section aria-labelledby="chile" className="space-y-4">
        <h2 id="chile" className="text-2xl font-semibold tracking-tight">Chile completo</h2>
        <p className="max-w-3xl">
          En 2022 había {ha(c1["2022"].plantacion_500m_ha)} de plantación forestal a menos de 500 m de una zona poblada,
          repartidas en {conFranja} comunas. De esas, {ha(c1["2022"].plantacion_100m_ha)} estaban a menos de 100 m, más o menos
          una cuadra.
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

      <section id="comunas" aria-labelledby="ranking" className="scroll-mt-6 space-y-4">
        <h2 id="ranking" className="text-2xl font-semibold tracking-tight">Comunas con más plantación junto a zonas pobladas</h2>
        <p className="max-w-3xl text-sm text-muted">
          Ordenadas por hectáreas de plantación forestal a menos de 500 m de una zona poblada en 2022 (Colección 1). Cada comuna
          tiene una ficha con su mapa, el detalle por distancia y lo que pasó en los incendios.
        </p>
        <Ranking filas={r.comunas} />
      </section>

      <section aria-labelledby="usos" className="max-w-3xl space-y-3">
        <h2 id="usos" className="text-2xl font-semibold tracking-tight">Quién puede usarlo</h2>
        <p>
          Un municipio puede usar su ficha como antecedente en el Plan Comunal para la Reducción del Riesgo de Desastres que exige
          la Ley 21.364, para decidir dónde partir con cortafuegos y planes de evacuación, y al revisar el Plan Regulador Comunal.
          Los organismos de emergencia tienen una vista nacional comparable. Y cualquier vecina, junta de vecinos o periodista
          puede ver la cifra de su propia comuna, descargar los datos y revisar cómo se calcularon.
        </p>
      </section>
    </div>
  );
}
