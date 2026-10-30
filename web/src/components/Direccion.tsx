"use client";
import Link from "next/link";
import { useState } from "react";
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
  const [opciones, setOpciones] = useState<ResultadoNominatim[] | null>(null);
  const [ubicacion, setUbicacion] = useState<Ubicacion | null>(null);
  const [cargando, setCargando] = useState<"geo" | "buscar" | null>(null);
  const [error, setError] = useState("");
  const [resultado, setResultado] = useState<ResultadoCelda | "fuera" | null>(null);
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
    let address = u.address;
    if (!address) {
      try {
        const r = await fetch(
          `https://nominatim.openstreetmap.org/reverse?format=jsonv2&accept-language=es&zoom=10&lat=${u.lat}&lon=${u.lon}`,
        );
        if (r.ok) {
          const j = (await r.json()) as { address?: Record<string, string> };
          address = j.address;
        }
      } catch {
        // sin conexión a Nominatim: seguimos sin comuna de referencia
      }
    }
    const cercana = await comunaDesdeDireccion(address);
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
        <section className="max-w-3xl space-y-4 border-t border-ink pt-8">
          <p className="text-sm text-muted">{ubicacion.etiqueta}</p>
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
            </div>
          ) : (
            <Resultado celda={resultado} comunaNombre={comunaNombre} />
          )}
        </section>
      )}

      <section className="max-w-3xl space-y-2 border-t border-line pt-6 text-sm text-muted">
        <h2 className="text-base font-medium text-ink">Limitaciones</h2>
        <p>
          Los datos son de la cobertura 2022 de MapBiomas Chile (resolución de 30 m, agrupada en celdas de unos 100 m).
          La ubicación de tu dirección puede ser aproximada, sobre todo si la buscaste por texto. La herramienta mide
          distancia a la plantación forestal más cercana, no el riesgo de incendio de tu dirección.
        </p>
      </section>
    </div>
  );
}

function Resultado({ celda, comunaNombre }: { celda: ResultadoCelda; comunaNombre: string | null }) {
  const redondeada = Math.round(celda.distanciaM / 50) * 50;
  const frase =
    celda.distanciaM >= celda.topeM
      ? `La plantación forestal más cercana a tu dirección está a más de ${nf0.format(celda.topeM)} m.`
      : celda.distanciaM === 0
        ? "Tu dirección está dentro de una plantación forestal o justo en su borde."
        : `La plantación forestal más cercana a tu dirección está a ${nf0.format(redondeada)} m.`;
  return (
    <div className="space-y-3">
      <p className="text-lg">{frase}</p>
      <p>
        En un radio de 500 m hay {nf1.format(celda.ha500)} ha de plantación forestal.
      </p>
      <p>
        {celda.quema === null
          ? "No hay dato de incendios para esta zona: MapBiomas Fuego no cubre esta región."
          : celda.quema
            ? "Entre 2023 y 2025 hubo área quemada a menos de 500 m de tu dirección, según MapBiomas Fuego."
            : "Entre 2023 y 2025 no hubo área quemada a menos de 500 m de tu dirección, según MapBiomas Fuego."}
      </p>
      <p>
        <Link href={`/comuna/${celda.slug}/`} className="text-link underline">
          Ver la ficha de {comunaNombre ?? "la comuna"}
        </Link>
      </p>
    </div>
  );
}
