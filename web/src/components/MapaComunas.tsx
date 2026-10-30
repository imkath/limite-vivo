"use client";
import Link from "next/link";
import { useMemo, useState } from "react";
import type { FilaResumen, Mapa } from "@/lib/datos";
import { ha } from "@/lib/formato";
import { nombreSector } from "@/lib/sectores";

const COLORES = ["#eceeef", "#f6ddb0", "#f0b35c", "#ed8c1a", "#7a4a0c"] as const;
const nf0 = new Intl.NumberFormat("es-CL", { maximumFractionDigits: 0 });

/** Cuantil lineal sobre un arreglo ya ordenado. */
function cuantil(valores: number[], p: number) {
  const k = (valores.length - 1) * p;
  const f = Math.floor(k);
  const c = Math.min(f + 1, valores.length - 1);
  return valores[f] + (valores[c] - valores[f]) * (k - f);
}

export default function MapaComunas({ mapa, filas }: { mapa: Mapa; filas: FilaResumen[] }) {
  const porSlug = useMemo(() => new Map(filas.map((f) => [f.slug, f])), [filas]);

  const cortes = useMemo(() => {
    const valores = mapa.comunas
      .map((c) => porSlug.get(c.slug)?.p500_2022 ?? 0)
      .filter((v) => v > 0)
      .sort((a, b) => a - b);
    if (valores.length === 0) return [0, 0, 0];
    return [cuantil(valores, 0.25), cuantil(valores, 0.5), cuantil(valores, 0.75)];
  }, [mapa, porSlug]);

  const clase = (v: number) => {
    if (v <= 0) return 0;
    if (v <= cortes[0]) return 1;
    if (v <= cortes[1]) return 2;
    if (v <= cortes[2]) return 3;
    return 4;
  };

  const [activo, setActivo] = useState<string | null>(null);
  const comunaActiva = activo ? porSlug.get(activo) : null;

  const rango = (i: number) => {
    if (i === 0) return "0 ha";
    if (i === 1) return `Hasta ${ha(cortes[0])}`;
    if (i === 4) return `Más de ${ha(cortes[2])}`;
    return `De ${nf0.format(Math.round(cortes[i - 2]))} a ${ha(cortes[i - 1])}`;
  };

  return (
    <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
      <div className="mx-auto w-full max-w-xs lg:mx-0 lg:w-80 lg:max-w-none lg:flex-shrink-0">
        <svg
          viewBox={`0 0 ${mapa.ancho} ${mapa.alto}`}
          role="img"
          aria-label="Mapa de comunas entre las regiones de Valparaíso y Los Lagos, coloreadas según hectáreas de plantación forestal a menos de 500 m de una zona poblada en 2022"
          className="mapa-svg mx-auto block h-auto max-h-[70vh] w-full lg:max-h-none"
          preserveAspectRatio="xMidYMid meet"
        >
          {mapa.comunas.map((c) => {
            const fila = porSlug.get(c.slug);
            const valor = fila?.p500_2022 ?? 0;
            const color = COLORES[clase(valor)];
            const titulo = fila ? `${fila.comuna}, ${ha(valor)} a menos de 500 m en 2022` : c.slug;
            return (
              <a
                key={c.slug}
                href={`/comuna/${c.slug}/`}
                onMouseEnter={() => setActivo(c.slug)}
                onMouseLeave={() => setActivo((a) => (a === c.slug ? null : a))}
                onFocus={() => setActivo(c.slug)}
                onBlur={() => setActivo((a) => (a === c.slug ? null : a))}
              >
                <title>{titulo}</title>
                <path d={c.d} style={{ fill: color }} />
              </a>
            );
          })}
        </svg>
        <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
          {COLORES.map((color, i) => (
            <li key={color} className="inline-flex items-center gap-1.5">
              <span className="inline-block h-3 w-3 border border-line" style={{ background: color }} />
              {rango(i)}
            </li>
          ))}
        </ul>
      </div>

      <div className="min-h-40 flex-1 border border-line p-4 lg:sticky lg:top-4">
        {comunaActiva ? (
          <div className="space-y-2">
            <p className="text-lg font-medium">{comunaActiva.comuna}</p>
            <p className="text-sm text-muted">Región de {comunaActiva.region}</p>
            <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
              <dt className="text-muted">A menos de 500 m, 2022</dt>
              <dd className="text-right tabular-nums">{ha(comunaActiva.p500_2022)}</dd>
              <dt className="text-muted">A menos de 100 m, 2022</dt>
              <dd className="text-right tabular-nums">{ha(comunaActiva.p100_2022)}</dd>
            </dl>
            {comunaActiva.sectores_top3.length > 0 && (
              <div className="pt-2 text-sm">
                <p className="text-muted">
                  {comunaActiva.sectores_n === 1 ? "Su único sector expuesto" : `Sus sectores con más plantación (de ${comunaActiva.sectores_n})`}
                </p>
                <ol className="mt-1 space-y-1">
                  {comunaActiva.sectores_top3.map((x) => (
                    <li key={x.n} className="flex justify-between gap-3">
                      <span>{x.n}. {nombreSector(x)}</span>
                      <span className="tabular-nums">{x.plantacion_100m_ha < 1 ? "menos de 1 ha" : ha(x.plantacion_100m_ha)}</span>
                    </li>
                  ))}
                </ol>
              </div>
            )}
            <p>
              <Link href={`/comuna/${comunaActiva.slug}/`} className="text-link underline-offset-2 hover:underline">
                Ver ficha
              </Link>
            </p>
          </div>
        ) : (
          <p className="text-sm text-muted">
            Pasa el cursor o usa el tabulador sobre una comuna del mapa para ver sus hectáreas de plantación junto a zonas
            pobladas.
          </p>
        )}
      </div>
    </div>
  );
}
