"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { buscarCelda, comunaDesdeDireccion, nombreComuna, type ResultadoCelda } from "@/lib/grilla";

const nf0 = new Intl.NumberFormat("es-CL", { maximumFractionDigits: 0 });
const nf1 = new Intl.NumberFormat("es-CL", { minimumFractionDigits: 1, maximumFractionDigits: 1 });

type ResultadoNominatim = {
  lat: string;
  lon: string;
  display_name: string;
  address?: Record<string, string>;
};

type Ubicacion = { lat: number; lon: number; etiqueta: string; address?: Record<string, string> };

export default function Direccion() {
  const [direccion, setDireccion] = useState("");
  const resultadoRef = useRef<HTMLElement>(null);
  const [opciones, setOpciones] = useState<ResultadoNominatim[] | null>(null);
  const [ubicacion, setUbicacion] = useState<Ubicacion | null>(null);
  const [cargando, setCargando] = useState<"geo" | "buscar" | null>(null);
  const [error, setError] = useState("");
  const [resultado, setResultado] = useState<ResultadoCelda | "fuera" | null>(null);

  // Al llegar un resultado, llevar la vista hasta él (salto directo, sin animación)
  useEffect(() => {
    if (!resultado || !ubicacion) return;
    resultadoRef.current?.scrollIntoView({ block: "start" });
  }, [resultado, ubicacion]);
  const [comunaCercana, setComunaCercana] = useState<{ slug: string; comuna: string } | null>(null);
  const [comunaNombre, setComunaNombre] = useState<string | null>(null);

  async function consultarGrilla(u: Ubicacion) {
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
    setOpciones(null);
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
        });
      },
      () => {
        setCargando(null);
        setError("No se pudo obtener tu ubicación. Revisa el permiso de ubicación del navegador.");
      },
      { enableHighAccuracy: true, timeout: 10000 },
    );
  }

  async function buscarDireccion(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setOpciones(null);
    setResultado(null);
    const q = direccion.trim();
    if (!q) return;
    setCargando("buscar");
    try {
      const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&countrycodes=cl&limit=5&accept-language=es&addressdetails=1&q=${encodeURIComponent(q)}`;
      const r = await fetch(url);
      if (!r.ok) throw new Error("fetch");
      const datos = (await r.json()) as ResultadoNominatim[];
      if (datos.length === 0) {
        setError("No encontramos esa dirección en OpenStreetMap. Prueba con calle, número y comuna.");
      } else if (datos.length === 1) {
        await elegirResultado(datos[0]);
      } else {
        setOpciones(datos);
      }
    } catch {
      setError("No pudimos consultar OpenStreetMap. Revisa tu conexión e intenta de nuevo.");
    } finally {
      setCargando(null);
    }
  }

  async function elegirResultado(r: ResultadoNominatim) {
    setOpciones(null);
    await consultarGrilla({ lat: parseFloat(r.lat), lon: parseFloat(r.lon), etiqueta: r.display_name, address: r.address });
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
          <form onSubmit={buscarDireccion} className="space-y-2">
            <label htmlFor="direccion" className="block text-sm font-medium">
              O busca tu dirección
            </label>
            <div className="flex gap-2">
              <input
                id="direccion"
                value={direccion}
                onChange={(e) => setDireccion(e.target.value)}
                placeholder="Ej. Av. Libertad 1000, Viña del Mar"
                autoComplete="off"
                className="w-full rounded-sm border border-line px-4 py-3 text-base outline-none focus:border-link"
              />
              <button
                type="submit"
                disabled={cargando !== null}
                className="shrink-0 rounded-sm border border-line px-4 py-2 text-sm hover:bg-tint disabled:opacity-60"
              >
                {cargando === "buscar" ? "Buscando…" : "Buscar"}
              </button>
            </div>
          </form>
          <p className="mt-2 text-sm text-muted">
            La dirección se envía a OpenStreetMap para ubicarla. Límite Vivo no la guarda. Búsqueda de direcciones con
            OpenStreetMap (Nominatim) ·{" "}
            <a
              href="https://www.openstreetmap.org/copyright"
              target="_blank"
              rel="noopener noreferrer"
              className="text-link underline"
            >
              © colaboradores de OpenStreetMap
            </a>
          </p>
        </div>

        {error && (
          <p role="alert" className="border border-line bg-tint px-4 py-3 text-sm">
            {error}
          </p>
        )}

        {opciones && opciones.length > 0 && (
          <div>
            <p className="mb-2 text-sm font-medium">Encontramos varias direcciones. Elige la correcta:</p>
            <ul className="divide-y divide-line border border-line">
              {opciones.map((o) => (
                <li key={`${o.lat}-${o.lon}`}>
                  <button
                    type="button"
                    onClick={() => elegirResultado(o)}
                    className="block w-full px-4 py-2 text-left text-sm hover:bg-tint"
                  >
                    {o.display_name}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>

      {ubicacion && resultado && (
        <section ref={resultadoRef} aria-live="polite"
          className="max-w-3xl scroll-mt-4 space-y-4 border-t border-ink pt-8">
          <p className="text-sm text-muted">{ubicacion.etiqueta}</p>
          {ubicacion.address && !ubicacion.address.house_number && (
            <p className="text-sm">
              OpenStreetMap no tiene registrado el número de esta dirección, así que se usa un punto de la calle. La distancia
              real a tu casa puede variar en algunos cientos de metros.
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
            <Resultado celda={resultado} comunaNombre={comunaNombre} lat={ubicacion.lat} lon={ubicacion.lon} porBusqueda={Boolean(ubicacion.address)} />
          )}
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
  porBusqueda,
}: {
  celda: ResultadoCelda;
  comunaNombre: string | null;
  lat: number;
  lon: number;
  porBusqueda: boolean;
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
            {porBusqueda
              ? "La ubicación de una dirección buscada por texto es aproximada, y el cálculo se hace por celdas de unos 100 m."
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
