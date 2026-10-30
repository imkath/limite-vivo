import Link from "next/link";
import Buscador from "@/components/Buscador";
import MapaComunas from "@/components/MapaComunas";
import { filasBuscador, filasLivianas, mapa, resumen } from "@/lib/datos";
import { VISOR_CONAF } from "@/lib/enlaces";
import { JsonLd, SITIO_WEB } from "@/components/DatosEstructurados";
import { entero, ha, pct } from "@/lib/formato";

const nf2 = new Intl.NumberFormat("es-CL", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function Inicio() {
  const r = resumen();
  const m = mapa();
  const enMapa = new Set(m.comunas.map((x) => x.slug));
  const total500 = r.comunas.reduce((a, c) => a + c.p500_2022, 0);
  const pctMapa = (r.comunas.filter((c) => enMapa.has(c.slug)).reduce((a, c) => a + c.p500_2022, 0) / total500) * 100;
  const c1 = r.nacional.col1;
  const v1 = r.validacion.col1.natural;
  const v2 = r.validacion.col2.natural;
  const [bajo, alto] = [Math.min(v1.rr, v2.rr), Math.max(v1.rr, v2.rr)];
  const o = r.crecimiento.col1_2022["100m"];
  const po = r.poblacion;

  return (
    <div className="space-y-16">
      <JsonLd datos={SITIO_WEB} />
      <section className="max-w-3xl space-y-5">
        <h1 className="text-3xl font-semibold leading-tight tracking-tight sm:text-4xl">
          ¿Cuánta plantación de pino y eucalipto hay junto a las casas de tu comuna?
        </h1>
        <p className="text-lg text-muted">
          Límite Vivo mide, con los mapas de MapBiomas Chile, cuánta plantación forestal hay a menos de 100, 200 y 500 metros
          de las zonas pobladas de cada comuna y en qué bordes se concentra.
        </p>
        <Buscador comunas={filasBuscador(r)} />
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 pt-1">
          <Link href="/direccion/" className="rounded-sm border border-ink px-4 py-2 text-sm text-ink hover:bg-tint">
            Buscar por dirección
          </Link>
          <p className="text-sm text-muted">Te dice a cuántos metros de tu casa está la plantación más cercana.</p>
        </div>
      </section>

      <section aria-labelledby="hallazgo" className="max-w-3xl space-y-3 border-t border-ink pt-6">
        <h2 id="hallazgo" className="text-2xl font-semibold tracking-tight">Lo principal</h2>
        <p>
          En 2022 había {ha(c1["2022"].plantacion_500m_ha)} de plantación forestal a menos de 500 m de una zona poblada, y{" "}
          {ha(c1["2022"].plantacion_100m_ha)} a menos de 100 m. En los incendios de 2023 a 2025, dentro de una misma comuna, la
          plantación junto a las casas se quemó entre {nf2.format(bajo)} y {nf2.format(alto)} veces más que el bosque nativo,
          el matorral y el pastizal de esa misma franja, según la colección de MapBiomas que se use.
        </p>
        <p>
          Según el Censo 2024, entre {entero(po.centro["100m"])} y {entero(po["100m"].personas)} personas viven a menos de 100 m
          de plantación forestal, según si se mide desde el centro o desde el borde de su manzana.
          Y la franja no creció por un solo motivo. De la plantación que hoy está a menos de 100 m de las casas, una parte ya
          existía y fue la ciudad la que llegó hasta ella ({ha(o.llego_ciudad_ha)} según la Colección 1), y otra se plantó
          después de 2005 ({ha(o.plantacion_nueva_ha)}).
        </p>
        <p>
          Son cifras para discutir con datos las franjas de protección entre plantaciones y viviendas, y para saber, comuna por
          comuna, si el problema se juega más en el Plan Regulador o en dónde se planta.
        </p>
        <p>
          <Link href="/hallazgos/" className="text-link underline">Ver los hallazgos completos</Link>
        </p>
      </section>

      <section aria-labelledby="aporte" className="max-w-3xl space-y-3">
        <h2 id="aporte" className="text-2xl font-semibold tracking-tight">Qué agrega Límite Vivo</h2>
        <p>
          CONAF publica el mapa oficial de riesgo de incendio en las zonas de interfaz entre ciudades y vegetación, y es la
          referencia para conocer el riesgo de un lugar. Límite Vivo lo complementa con lo que ese mapa no muestra. Distingue la
          plantación forestal del bosque nativo y el matorral, compara 2000, 2022 y 2024, separa si fue la ciudad la que llegó a
          la plantación o la plantación la que llegó a la ciudad, cuenta a las personas que viven al lado con el Censo 2024 y
          contrasta todo con lo que se quemó. Los datos y el código quedan abiertos para revisarlos.
        </p>
        <p>
          <a href={VISOR_CONAF} target="_blank" rel="noopener noreferrer" className="text-link underline">
            Visor de zonas de interfaz de CONAF
          </a>
        </p>
      </section>

      <section id="mapa" aria-labelledby="titulo-mapa" className="scroll-mt-6 space-y-4">
        <h2 id="titulo-mapa" className="text-2xl font-semibold tracking-tight">Recorre el mapa</h2>
        <p className="max-w-3xl text-sm text-muted">
          Cada comuna está coloreada según sus hectáreas de plantación a menos de 500 m de zonas pobladas en 2022. El mapa
          cubre de Valparaíso a Los Lagos, donde está el {pct(pctMapa)} de esa plantación; el resto del país está en el{" "}
          <Link href="/comunas/" className="text-link underline">listado de comunas</Link>.
        </p>
        <MapaComunas mapa={m} filas={filasLivianas(r)} />
      </section>

      <section aria-labelledby="usos" className="max-w-3xl space-y-3">
        <h2 id="usos" className="text-2xl font-semibold tracking-tight">Quién puede usarlo</h2>
        <p>
          Un municipio puede usar su ficha como antecedente en el Plan Comunal para la Reducción del Riesgo de Desastres que exige
          la Ley 21.364, para decidir dónde partir con cortafuegos y planes de evacuación (con cuántas personas, niños, mayores y
          personas con dificultad para moverse viven junto a la plantación), y al revisar el Plan Regulador Comunal, sabiendo
          cuánto de la franja viene del crecimiento de la propia ciudad.
          Los organismos de emergencia tienen una vista nacional comparable. Y cualquier vecina, junta de vecinos o periodista
          puede ver la cifra de su propia comuna, descargar los datos y revisar cómo se calcularon.
        </p>
      </section>
    </div>
  );
}
