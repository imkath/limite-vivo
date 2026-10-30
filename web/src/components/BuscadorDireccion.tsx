"use client";
import { useEffect, useRef, useState } from "react";

/** Una sugerencia de Photon (OpenStreetMap) reducida a lo que usa la página. */
export type Sugerencia = {
  lat: number;
  lon: number;
  titulo: string;
  detalle: string;
  numeroExacto: boolean;
  address: Record<string, string>;
};

type PropiedadesPhoton = {
  name?: string;
  street?: string;
  housenumber?: string;
  district?: string;
  locality?: string;
  city?: string;
  county?: string;
  countrycode?: string;
};

const MIN_LETRAS = 4;
const ESPERA_MS = 350;
// Rectángulo que contiene a Chile continental e insular cercano; además se filtra por país
const BBOX_CHILE = "-76.0,-56.0,-66.0,-17.4";

function aSugerencia(f: { geometry: { coordinates: [number, number] }; properties: PropiedadesPhoton }): Sugerencia {
  const p = f.properties;
  const calle = p.street ?? p.name ?? "";
  const titulo = p.housenumber ? `${calle} ${p.housenumber}` : p.name ?? calle;
  const lugares = [p.district, p.locality, p.city].filter((x, i, a): x is string => Boolean(x) && a.indexOf(x) === i && x !== titulo);
  return {
    lat: f.geometry.coordinates[1],
    lon: f.geometry.coordinates[0],
    titulo,
    detalle: lugares.join(", "),
    numeroExacto: Boolean(p.housenumber),
    address: {
      ...(p.housenumber ? { house_number: p.housenumber } : {}),
      ...(p.district ? { suburb: p.district } : {}),
      ...(p.city ? { city: p.city } : {}),
      ...(p.county ? { county: p.county } : {}),
    },
  };
}

export default function BuscadorDireccion({ onElegir }: { onElegir: (s: Sugerencia) => void }) {
  const [texto, setTexto] = useState("");
  const [sugerencias, setSugerencias] = useState<Sugerencia[]>([]);
  const [abierto, setAbierto] = useState(false);
  const [sel, setSel] = useState(-1);
  const [estado, setEstado] = useState<"" | "buscando" | "vacio" | "error">("");
  const control = useRef<AbortController | null>(null);

  useEffect(() => {
    const q = texto.trim();
    if (q.length < MIN_LETRAS) return;
    const t = setTimeout(async () => {
      control.current?.abort();
      const ac = new AbortController();
      control.current = ac;
      setEstado("buscando");
      try {
        const url = `https://photon.komoot.io/api/?limit=8&bbox=${BBOX_CHILE}&q=${encodeURIComponent(q)}`;
        const r = await fetch(url, { signal: ac.signal });
        if (!r.ok) throw new Error(String(r.status));
        const datos = (await r.json()) as { features: Parameters<typeof aSugerencia>[0][] };
        const vistas = new Set<string>();
        const lista = datos.features
          .filter((f) => (f.properties as PropiedadesPhoton).countrycode === "CL")
          .map(aSugerencia)
          .filter((s) => {
            const clave = `${s.titulo}|${s.detalle}`;
            if (vistas.has(clave)) return false;
            vistas.add(clave);
            return true;
          })
          .slice(0, 6);
        setSugerencias(lista);
        setSel(-1);
        setAbierto(true);
        setEstado(lista.length ? "" : "vacio");
      } catch (e) {
        if ((e as Error).name !== "AbortError") setEstado("error");
      }
    }, ESPERA_MS);
    return () => clearTimeout(t);
  }, [texto]);

  function elegir(s: Sugerencia) {
    setTexto(s.detalle ? `${s.titulo}, ${s.detalle}` : s.titulo);
    setAbierto(false);
    setSugerencias([]);
    onElegir(s);
  }

  function teclas(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!abierto || sugerencias.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSel((i) => (i + 1) % sugerencias.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSel((i) => (i <= 0 ? sugerencias.length - 1 : i - 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      elegir(sugerencias[sel >= 0 ? sel : 0]);
    } else if (e.key === "Escape") {
      setAbierto(false);
    }
  }

  return (
    <div className="space-y-2">
      <label htmlFor="direccion" className="block text-sm font-medium">
        O escribe tu dirección
      </label>
      <input
        id="direccion"
        role="combobox"
        aria-expanded={abierto && sugerencias.length > 0}
        aria-controls="direccion-sugerencias"
        aria-autocomplete="list"
        aria-activedescendant={sel >= 0 ? `direccion-op-${sel}` : undefined}
        value={texto}
        onChange={(e) => {
          setTexto(e.target.value);
          if (e.target.value.trim().length < MIN_LETRAS) {
            setSugerencias([]);
            setEstado("");
          }
        }}
        onKeyDown={teclas}
        onFocus={() => sugerencias.length && setAbierto(true)}
        placeholder="Calle, número y comuna"
        autoComplete="off"
        className="w-full rounded-sm border border-line px-4 py-3 text-base outline-none focus:border-link"
      />
      <p className="min-h-5 text-sm text-muted" aria-live="polite">
        {estado === "buscando" && "Buscando…"}
        {estado === "vacio" && "No encontramos esa dirección en Chile. Prueba agregando la comuna."}
        {estado === "error" && "No pudimos consultar el buscador de direcciones. Revisa tu conexión e intenta de nuevo."}
        {estado === "" && texto.trim().length > 0 && texto.trim().length < MIN_LETRAS && "Sigue escribiendo para ver sugerencias."}
      </p>
      {abierto && sugerencias.length > 0 && (
        <ul id="direccion-sugerencias" role="listbox" className="divide-y divide-line rounded-sm border border-line">
          {sugerencias.map((s, i) => (
            <li
              key={`${s.lat},${s.lon},${s.titulo}`}
              id={`direccion-op-${i}`}
              role="option"
              aria-selected={i === sel}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => elegir(s)}
              onMouseEnter={() => setSel(i)}
              className={`cursor-pointer px-4 py-2 ${i === sel ? "bg-tint" : ""}`}
            >
              <span className="block">{s.titulo}</span>
              {s.detalle && <span className="block text-sm text-muted">{s.detalle}</span>}
            </li>
          ))}
        </ul>
      )}
      <p className="text-sm text-muted">
        Mientras escribes, el texto se envía al buscador Photon, que usa datos de{" "}
        <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer" className="text-link underline">
          OpenStreetMap
        </a>
        , para sugerir direcciones. Límite Vivo no lo guarda.
      </p>
    </div>
  );
}
