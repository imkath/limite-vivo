"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import BuscadorDireccion from "@/components/BuscadorDireccion";
import { buscarCelda, comunaDesdeDireccion, nombreComuna, type ResultadoCelda } from "@/lib/grilla";

// Leaflet necesita el navegador; se descarga solo si la persona abre el mapa
const MapaAjuste = dynamic(() => import("@/components/MapaAjuste"), {
  ssr: false,
  loading: () => <p className="text-sm text-muted">Cargando el mapa…</p>,
});

const nf0 = new Intl.NumberFormat("es-CL", { maximumFractionDigits: 0 });
const nf1 = new Intl.NumberFormat("es-CL", { minimumFractionDigits: 1, maximumFractionDigits: 1 });

type Fuente = "gps" | "busqueda" | "mapa";
type Ubicacion = {
  lat: number;
  lon: number;
  etiqueta: string;
  fuente: Fuente;
  exacto?: boolean;
  address?: Record<string, string>;
};

export default function Direccion() {
  const resultadoRef = useRef<HTMLElement>(null);
  const [mapaInicio, setMapaInicio] = useState<{ lat: number; lon: number } | null>(null);
  const [ubicacion, setUbicacion] = useState<Ubicacion | null>(null);
  const [cargando, setCargando] = useState<"geo" | null>(null);
  const [error, setError] = useState("");
  const [resultado, setResultado] = useState<ResultadoCelda | "fuera" | null>(null);

  // Al llegar un resultado, llevar la vista hasta él (salto directo, sin animación)
  useEffect(() => {
    if (!resultado || !ubicacion || ubicacion.fuente === "mapa") return;
    resultadoRef.current?.scrollIntoView({ block: "start" });
  }, [resultado, ubicacion]);
  const [comunaCercana, setComunaCercana] = useState<{ slug: string; comuna: string } | null>(null);
  const [comunaNombre, setComunaNombre] = useState<string | null>(null);

  async function consultarGrilla(u: Ubicacion) {
    if (u.fuente !== "mapa") setMapaInicio(null);
    setUbicacion(u);
    setResultado(null);
    setComunaCercana(null);
    setComunaNombre(null);
    const celda = await buscarCelda(u.lat, u.lon);
    if (celda) {
      setResultado(celda);
      setComunaNombre(await nombreComuna(celda.slug));
      return;
    }
    setResultado("fuera");
    // Con la ubicación del navegador no se consulta ningún servicio externo, así que solo hay comuna de
    // referencia cuando la dirección vino de una búsqueda en OpenStreetMap.
    const cercana = await comunaDesdeDireccion(u.address);
    if (cercana) setComunaCercana(cercana);
  }

  function usarMiUbicacion() {
    setError("");
    if (!("geolocation" in navigator)) {
      setError("Este navegador no entrega la ubicación del equipo.");
      return;
    }
    setCargando("geo");
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        setCargando(null);
        await consultarGrilla({
          lat: pos.coords.latitude,
          lon: pos.coords.longitude,
          etiqueta: "Tu ubicación actual",
          fuente: "gps",
        });
      },
      () => {
        setCargando(null);
        setError("No se pudo obtener tu ubicación. Revisa el permiso de ubicación del navegador.");
      },
      { enableHighAccuracy: true, timeout: 10000 },
    );
  }

  return (
    <div className="space-y-10">
      <section className="max-w-3xl space-y-3">
        <h1 className="text-3xl font-semibold tracking-tight">Tu dirección</h1>
        <p className="text-muted">
          Ubica tu dirección para saber a cuántos metros hay plantación forestal, según los mapas de MapBiomas Chile.
        </p>
      </section>

      <section className="max-w-xl space-y-6">
        <div>
          <button
            type="button"
            onClick={usarMiUbicacion}
            disabled={cargando !== null}
            className="rounded-sm border border-line px-4 py-2 text-sm hover:bg-tint disabled:opacity-60"
          >
            {cargando === "geo" ? "Obteniendo tu ubicación…" : "Usar mi ubicación"}
          </button>
          <p className="mt-2 text-sm text-muted">
            Usa la ubicación del navegador. No se envía a ningún servidor externo.
          </p>
        </div>

        <div className="border-t border-line pt-6">
          <BuscadorDireccion
            onElegir={(sug) =>
              consultarGrilla({
                lat: sug.lat,
                lon: sug.lon,
                etiqueta: sug.detalle ? `${sug.titulo}, ${sug.detalle}` : sug.titulo,
                fuente: "busqueda",
                exacto: sug.numeroExacto,
                address: sug.address,
              })
            }
          />
        </div>

        {error && (
          <p role="alert" className="border border-line bg-tint px-4 py-3 text-sm">
            {error}
          </p>
        )}

      </section>

      {ubicacion && resultado && (
        <section ref={resultadoRef} aria-live="polite"
          className="max-w-3xl scroll-mt-4 space-y-4 border-t border-ink pt-8">
          <p className="text-sm text-muted">{ubicacion.etiqueta}</p>
          {ubicacion.fuente === "busqueda" && !ubicacion.exacto && (
            <p className="text-sm">
              No tenemos el número exacto de esta dirección, así que el punto quedó en algún lugar de la calle. Si no está en
              tu casa, ajústalo en el mapa más abajo.
            </p>
          )}
          {resultado === "fuera" ? (
            <div className="space-y-3">
              <p className="text-lg">
                Esa coordenada queda fuera de las zonas que cubre esta herramienta. Límite Vivo solo mide distancias
                dentro de zonas pobladas y sus bordes, según MapBiomas Chile.
              </p>
              {comunaCercana && (
                <p>
                  Puedes revisar la ficha de{" "}
                  <Link href={`/comuna/${comunaCercana.slug}/`} className="text-link underline">
                    {comunaCercana.comuna}
                  </Link>
                  , la comuna de esa dirección.
                </p>
              )}
              {!comunaCercana && (
                <p>
                  Puedes buscar tu comuna en el{" "}
                  <Link href="/" className="text-link underline">inicio</Link> para ver su ficha.
                </p>
              )}
            </div>
          ) : (
            <Resultado celda={resultado} comunaNombre={comunaNombre} lat={ubicacion.lat} lon={ubicacion.lon} fuente={ubicacion.fuente} />
          )}
          <div className="space-y-3 border-t border-line pt-6">
            {mapaInicio ? (
              <>
                <p className="text-sm">Arrastra el marcador o haz clic donde está tu casa. El resultado de arriba se recalcula al instante.</p>
                <MapaAjuste
                  lat={mapaInicio.lat}
                  lon={mapaInicio.lon}
                  onMover={(lat, lon) => consultarGrilla({ lat, lon, etiqueta: "Punto ajustado en el mapa", fuente: "mapa" })}
                />
              </>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => setMapaInicio({ lat: ubicacion.lat, lon: ubicacion.lon })}
                  className="rounded-sm border border-line px-4 py-2 text-sm hover:bg-tint"
                >
                  Ajustar el punto en el mapa
                </button>
                <p className="text-sm text-muted">
                  Si el punto no quedó en tu casa, puedes moverlo. El mapa se carga desde OpenStreetMap, que verá la zona que
                  estás mirando.
                </p>
              </>
            )}
          </div>
        </section>
      )}

    </div>
  );
}

/** Distancia legible: metros redondeados a 10 (bajo 100 m) o a 50, y kilómetros sobre 1 km. */
function distanciaTexto(m: number) {
  if (m < 100) return `${nf0.format(Math.max(10, Math.round(m / 10) * 10))} m`;
  if (m < 1000) return `${nf0.format(Math.round(m / 50) * 50)} m`;
  return `${nf1.format(m / 1000)} km`;
}

// Regla con las franjas de la herramienta; cada tramo ocupa el mismo ancho para que las distancias cortas se vean
const MARCAS = [0, 100, 200, 500, 1000, 3000];
const ETIQUETAS = ["0", "100 m", "200 m", "500 m", "1 km", "3 km"];

function posicion(m: number) {
  if (m >= MARCAS[MARCAS.length - 1]) return 100;
  const k = MARCAS.findIndex((x, i) => m >= x && m < MARCAS[i + 1]);
  const tramo = 100 / (MARCAS.length - 1);
  return k * tramo + ((m - MARCAS[k]) / (MARCAS[k + 1] - MARCAS[k])) * tramo;
}

function Regla({ distancia }: { distancia: number }) {
  const x = posicion(distancia);
  const tramo = 100 / (MARCAS.length - 1);
  return (
    <figure className="space-y-2" aria-hidden="true">
      <div className="relative h-3">
        {MARCAS.slice(0, -1).map((m, i) => (
          <div
            key={m}
            className="absolute top-0 h-3 border-r border-bg"
            style={{ left: `${i * tramo}%`, width: `${tramo}%`, background: m < 500 ? (m < 100 ? "#ed8c1a" : m < 200 ? "#f2a94f" : "#f7cb93") : "#e3e5e7" }}
          />
        ))}
        <div className="absolute -top-1.5 h-6 w-0.5 bg-ink" style={{ left: `calc(${x}% - 1px)` }} />
      </div>
      <div className="relative h-4 text-xs text-muted">
        {ETIQUETAS.map((t, i) => (
          <span
            key={t}
            className="absolute whitespace-nowrap"
            style={{ left: `${i * tramo}%`, transform: i === 0 ? "none" : i === ETIQUETAS.length - 1 ? "translateX(-100%)" : "translateX(-50%)" }}
          >
            {t}
          </span>
        ))}
      </div>
      <figcaption className="text-xs text-muted">
        La línea marca la distancia a la plantación más cercana. En naranjo, las franjas de 100, 200 y 500 m que usa Límite Vivo.
      </figcaption>
    </figure>
  );
}

function Resultado({
  celda,
  comunaNombre,
  lat,
  lon,
  fuente,
}: {
  celda: ResultadoCelda;
  comunaNombre: string | null;
  lat: number;
  lon: number;
  fuente: Fuente;
}) {
  const d = celda.distanciaM;
  const lejos = d >= celda.topeM;
  const titular = lejos
    ? `No hay plantación forestal a menos de ${nf0.format(celda.topeM / 1000)} km de ese punto.`
    : d === 0
      ? "Hay plantación forestal junto a ese punto."
      : d <= 500
        ? `Hay plantación forestal a unos ${distanciaTexto(d)} de ese punto.`
        : `La plantación forestal más cercana está a unos ${distanciaTexto(d)}.`;
  const osm = `https://www.openstreetmap.org/?mlat=${lat.toFixed(5)}&mlon=${lon.toFixed(5)}#map=16/${lat.toFixed(5)}/${lon.toFixed(5)}`;
  return (
    <div className="space-y-6">
      <p className="text-2xl font-semibold leading-snug tracking-tight">{titular}</p>
      <Regla distancia={lejos ? celda.topeM : d} />
      <dl className="divide-y divide-line border-y border-line text-sm">
        <div className="flex justify-between gap-4 py-2">
          <dt className="text-muted">Plantación más cercana</dt>
          <dd className="text-right">{lejos ? `a más de ${nf0.format(celda.topeM / 1000)} km` : d === 0 ? "en la misma celda de unos 100 m" : `a unos ${distanciaTexto(d)}`}</dd>
        </div>
        <div className="flex justify-between gap-4 py-2">
          <dt className="text-muted">Plantación en un radio de 500 m</dt>
          <dd className="text-right">{celda.ha500 < 0.05 ? "ninguna" : `${nf1.format(celda.ha500)} ha`}</dd>
        </div>
        <div className="flex justify-between gap-4 py-2">
          <dt className="text-muted">Área quemada a menos de 500 m, 2023 a 2025</dt>
          <dd className="text-right">
            {celda.quema === null ? "sin dato en esta región" : celda.quema ? "sí" : "no"}
          </dd>
        </div>
      </dl>
      <aside aria-labelledby="antes" className="space-y-2 pt-2 text-sm">
        <h2 id="antes" className="font-semibold">Antes de sacar conclusiones</h2>
        <ul className="list-disc space-y-1 pl-5">
          <li>
            Esto mide distancia, no riesgo de incendio. Que haya plantación cerca no significa que ese lugar se vaya a quemar, ni
            que esté a salvo si no la hay.
          </li>
          <li>
            Los mapas son de 2022 (MapBiomas Chile, Colección 1), la versión que calza con las estadísticas oficiales y es
            anterior a los incendios de 2023 y 2024. Una plantación cortada, quemada o plantada después puede no aparecer.
          </li>
          <li>
            {fuente === "busqueda"
              ? "La ubicación de una dirección buscada por texto es aproximada, y el cálculo se hace por celdas de unos 100 m."
              : fuente === "mapa"
                ? "El cálculo se hace por celdas de unos 100 m, así que un punto movido unos metros puede dar el mismo resultado."
                : "La ubicación del navegador puede tener un error de algunas decenas de metros, y el cálculo se hace por celdas de unos 100 m."}
          </li>
          {celda.quema === null && <li>MapBiomas Fuego cubre de la Región de Valparaíso a la de La Araucanía.</li>}
        </ul>
      </aside>
      <ul className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
        <li>
          <Link href={`/comuna/${celda.slug}/`} className="text-link underline">
            Ver la ficha de {comunaNombre ?? "la comuna"} y sus sectores
          </Link>
        </li>
        <li>
          <a href={osm} target="_blank" rel="noopener noreferrer" className="text-link underline">
            Ver este punto en OpenStreetMap
          </a>
        </li>
      </ul>
    </div>
  );
}
