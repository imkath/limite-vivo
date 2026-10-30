import type { Metadata } from "next";
import Link from "next/link";
import { CITAS, comuna, resumen, type Franja, type Fuego } from "@/lib/datos";
import { ha, haSigno, pct, tasa } from "@/lib/formato";

export const dynamicParams = false;

export function generateStaticParams() {
  return resumen().comunas.map((c) => ({ slug: c.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const c = comuna((await params).slug);
  return {
    title: c.comuna,
    description: `Plantación forestal a menos de 100, 200 y 500 m de zonas pobladas en ${c.comuna}, ${c.region}. Datos de MapBiomas Chile.`,
  };
}

const DIST = [
  { k: "plantacion_100m_ha", d: "100 m" },
  { k: "plantacion_200m_ha", d: "200 m" },
  { k: "plantacion_500m_ha", d: "500 m" },
] as const;

const LEYENDA = [
  ["#cc211c", "Zona poblada"],
  ["#ed8c1a", "Plantación a menos de 500 m"],
  ["#9e8040", "Otra plantación"],
  ["#c7dec2", "Vegetación natural"],
] as const;

function Barras({ f }: { f: Fuego }) {
  const filas = [
    { n: "Plantación forestal", t: tasa(f.plantacion_quemada_ha, f.plantacion_ha), q: f.plantacion_quemada_ha, a: f.plantacion_ha, c: "#9e8040" },
    { n: "Vegetación natural (bosque nativo, matorral, pastizal y humedal)", t: tasa(f.natural_quemada_ha, f.natural_ha), q: f.natural_quemada_ha, a: f.natural_ha, c: "#3f7d4a" },
    { n: "Agricultura y pasturas", t: tasa(f.agricola_quemada_ha, f.agricola_ha), q: f.agricola_quemada_ha, a: f.agricola_ha, c: "#b08ab5" },
  ].filter((x) => x.a >= 1);
  const max = Math.max(...filas.map((x) => x.t), 1);
  return (
    <div className="space-y-3">
      {filas.map((x) => (
        <div key={x.n}>
          <div className="flex flex-wrap justify-between gap-x-3 text-sm">
            <span>{x.n}</span>
            <span>{pct(x.t)} <span className="text-muted">({ha(x.q)} de {ha(x.a)})</span></span>
          </div>
          <div className="mt-1 h-2.5 bg-tint" role="presentation">
            <div className="h-2.5" style={{ width: `${(x.t / max) * 100}%`, background: x.c }} />
          </div>
        </div>
      ))}
    </div>
  );
}

function Tabla({ a, b, ea, eb }: { a: Franja; b: Franja; ea: string; eb: string }) {
  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="border-b border-ink text-left">
          <th className="py-2 font-medium">Distancia</th>
          <th className="py-2 text-right font-medium">{ea}</th>
          <th className="py-2 text-right font-medium">{eb}</th>
          <th className="py-2 text-right font-medium">Cambio</th>
        </tr>
      </thead>
      <tbody>
        {DIST.map(({ k, d }) => (
          <tr key={k} className="border-b border-line">
            <td className="py-2">A menos de {d}</td>
            <td className="py-2 text-right">{ha(a[k])}</td>
            <td className="py-2 text-right">{ha(b[k])}</td>
            <td className="py-2 text-right">{haSigno(b[k] - a[k])}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/** Dirección del cambio de la franja de 500 m; bajo 5 % o 10 ha se considera estable. */
function tendencia(antes: number, despues: number) {
  const d = despues - antes;
  if (Math.abs(d) < 10 || (antes > 0 && Math.abs(d / antes) < 0.05)) return "estable";
  return d > 0 ? "creció" : "bajó";
}

export default async function FichaComuna({ params }: { params: Promise<{ slug: string }> }) {
  const c = comuna((await params).slug);
  const f22 = c.col1["2022"];
  const sinFranja = f22.plantacion_500m_ha < 1 && c.col2["2024"].plantacion_500m_ha < 1;
  const fu = c.fuego_col1;
  const tp = fu ? tasa(fu.plantacion_quemada_ha, fu.plantacion_ha) : 0;
  const tn = fu ? tasa(fu.natural_quemada_ha, fu.natural_ha) : 0;
  const t1 = tendencia(c.col1["2000"].plantacion_500m_ha, f22.plantacion_500m_ha);
  const t2 = tendencia(c.col2["2000"].plantacion_500m_ha, c.col2["2024"].plantacion_500m_ha);
  const s = c.serie_col2;
  const n = s.anios.length - 1;

  return (
    <article className="space-y-12">
      <header className="space-y-2">
        <Link href="/#comunas" className="no-print text-sm text-link hover:underline">← Todas las comunas</Link>
        <h1 className="text-3xl font-semibold tracking-tight">{c.comuna}</h1>
        <p className="text-muted">Provincia de {c.provincia}, Región de {c.region}. Superficie comunal de {ha(c.area_ha)}.</p>
      </header>

      {sinFranja ? (
        <section className="max-w-3xl">
          <p>
            Según MapBiomas Chile, en {c.comuna} no hay plantación forestal a menos de 500 m de una zona poblada, ni en 2022
            (Colección 1) ni en 2024 (Colección 2).
          </p>
        </section>
      ) : (
        <>
          <section aria-labelledby="franja" className="space-y-6">
            <h2 id="franja" className="sr-only">Plantación junto a zonas pobladas</h2>
            {f22.plantacion_500m_ha >= 1 ? (
              <p className="max-w-3xl text-lg">
                En 2022, {c.comuna} tenía {ha(f22.plantacion_500m_ha)} de plantación forestal a menos de 500 m de una zona poblada
                y {ha(f22.plantacion_100m_ha)} a menos de 100 m.
                {c.puesto ? ` Es la comuna número ${c.puesto} de ${c.puesto_de} en el país por la franja de 500 m.` : ""} De toda
                su plantación ({ha(f22.plantacion_ha)}), el {pct(tasa(f22.plantacion_500m_ha, f22.plantacion_ha))} queda dentro
                de esa franja.
              </p>
            ) : (
              <p className="max-w-3xl text-lg">
                Según la Colección 2, en 2024 {c.comuna} tenía {ha(c.col2["2024"].plantacion_500m_ha)} de plantación forestal a
                menos de 500 m de una zona poblada y {ha(c.col2["2024"].plantacion_100m_ha)} a menos de 100 m. La Colección 1 no
                registra plantación en esa franja en 2022, así que la cifra es menos segura.
              </p>
            )}

            <figure className="space-y-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={`/mapas/${c.slug}.webp`} alt={`Mapa de ${c.comuna} con las zonas pobladas, la plantación forestal a menos de 500 m y el área quemada entre 2023 y 2025`}
                className="w-full border border-line" loading="lazy" />
              <figcaption className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
                {LEYENDA.map(([color, texto]) => (
                  <span key={texto} className="inline-flex items-center gap-1.5">
                    <span className="inline-block h-3 w-3" style={{ background: color }} />
                    {texto}
                  </span>
                ))}
                <span>Las zonas más oscuras se quemaron entre 2023 y 2025. La línea negra es el límite comunal. Cobertura 2022, Colección 1.</span>
              </figcaption>
            </figure>

            <div className="grid gap-8 lg:grid-cols-2">
              <div>
                <h3 className="mb-2 font-medium">Colección 1, 2000 y 2022</h3>
                <Tabla a={c.col1["2000"]} b={f22} ea="2000" eb="2022" />
              </div>
              <div>
                <h3 className="mb-2 font-medium">Colección 2, 2000 y 2024</h3>
                <Tabla a={c.col2["2000"]} b={c.col2["2024"]} ea="2000" eb="2024" />
              </div>
            </div>
            <p className="max-w-3xl text-sm text-muted">
              {t1 === t2
                ? `Las dos colecciones coinciden: la franja de 500 m ${t1 === "estable" ? "se mantuvo estable" : t1} desde el año 2000.`
                : `Las dos colecciones no coinciden en la tendencia (según la Colección 1 la franja de 500 m ${t1 === "estable" ? "se mantuvo estable" : t1}, según la Colección 2 ${t2 === "estable" ? "se mantuvo estable" : t2}), así que la evolución en esta comuna es incierta.`}{" "}
              Las colecciones clasifican de forma distinta la plantación y la infraestructura, por eso las hectáreas no son iguales.
            </p>
          </section>

          <section aria-labelledby="fuego" className="max-w-3xl space-y-4">
            <h2 id="fuego" className="text-2xl font-semibold tracking-tight">Incendios de 2023 a 2025</h2>
            {!c.fuego_cubierta ? (
              <p>MapBiomas Fuego (Colección 1) no cubre esta comuna, así que no hay comparación con incendios.</p>
            ) : fu ? (
              <>
                <p>
                  Dentro de la franja de 500 m de {c.comuna}, entre 2023 y 2025 se quemó el {pct(tp)} de la plantación forestal y el{" "}
                  {pct(tn)} de la vegetación natural.{" "}
                  {tp > tn
                    ? "Aquí la plantación cercana a las casas se quemó en mayor proporción, como pasó en la mayoría de las comunas con incendios."
                    : "Aquí pasó lo contrario que en la mayoría de las comunas con incendios: la vegetación natural se quemó en mayor proporción que la plantación."}
                </p>
                <Barras f={fu} />
                <p className="text-sm text-muted">
                  Cobertura de 2022, antes de los incendios (MapBiomas Chile, Colección 1). Área quemada en 2023, 2024 y 2025
                  (MapBiomas Fuego Chile, Colección 1).
                </p>
              </>
            ) : (
              <p>
                {c.quemado_2023_2025_ha >= 1
                  ? `MapBiomas Fuego registra ${ha(c.quemado_2023_2025_ha)} quemadas en la comuna entre 2023 y 2025, pero muy poco dentro de la franja de 500 m como para comparar.`
                  : "MapBiomas Fuego no registra área quemada en la comuna entre 2023 y 2025."}
              </p>
            )}
          </section>

          <section aria-labelledby="usos" className="max-w-3xl space-y-3">
            <h2 id="usos" className="text-2xl font-semibold tracking-tight">Para el municipio</h2>
            <p>
              La franja puede entrar como antecedente de amenaza de incendio forestal en el Plan Comunal para la Reducción del
              Riesgo de Desastres (Ley 21.364).
              {f22.plantacion_100m_ha >= 1
                ? ` Las ${ha(f22.plantacion_100m_ha)} a menos de 100 m son el primer lugar donde mirar al planificar cortafuegos, limpieza de bordes y rutas de evacuación.`
                : ""}{" "}
              También sirve al revisar el Plan Regulador Comunal y al evaluar dónde crece la ciudad, y se puede actualizar con
              cada nueva colección de MapBiomas.
            </p>
          </section>
        </>
      )}

      <section aria-labelledby="contexto" className="max-w-3xl space-y-2">
        <h2 id="contexto" className="text-2xl font-semibold tracking-tight">La comuna entre {s.anios[0]} y {s.anios[n]}</h2>
        <p>
          Según las estadísticas oficiales de la Colección 2, la plantación forestal de {c.comuna} pasó de {ha(s.plantacion[0])} en{" "}
          {s.anios[0]} a {ha(s.plantacion[n])} en {s.anios[n]}, y la infraestructura urbana de {ha(s.urbano[0])} a{" "}
          {ha(s.urbano[n])}.
        </p>
      </section>

      <footer className="space-y-2 border-t border-line pt-6 text-sm text-muted">
        <p>
          <a href="/datos/limite-vivo-comunas.csv" download className="text-link underline">Datos de todas las comunas (CSV)</a>
          {" · "}
          <Link href="/metodologia/" className="text-link underline">Metodología y limitaciones</Link>
        </p>
        <p>Fuentes</p>
        <ul className="list-disc space-y-1 pl-5">
          {CITAS.map((x) => <li key={x}>{x}</li>)}
        </ul>
      </footer>
    </article>
  );
}
