"use client";
import { useState } from "react";
import type { Sector } from "@/lib/datos";
import { ha } from "@/lib/formato";
import { nombreSector } from "@/lib/sectores";

const nf0 = new Intl.NumberFormat("es-CL", { maximumFractionDigits: 0 });

const enlaceMapa = (s: Sector) =>
  `https://www.openstreetmap.org/?mlat=${s.lat}&mlon=${s.lon}#map=16/${s.lat}/${s.lon}`;

export default function Sectores({ sectores, conFuego }: { sectores: Sector[]; conFuego: boolean }) {
  const [todos, setTodos] = useState(false);
  const visibles = todos ? sectores : sectores.slice(0, 10);
  return (
    <div className="space-y-3">
      <div className="overflow-x-auto">
        <table className="w-full text-sm sm:min-w-[620px]">
          <thead>
            <tr className="border-b border-ink text-left">
              <th className="py-2 pr-2 font-medium">N.º</th>
              <th className="py-2 pr-2 font-medium">Sector</th>
              <th className="hidden py-2 pr-2 text-right font-medium sm:table-cell">Borde expuesto (aprox.)</th>
              <th className="py-2 pr-2 text-right font-medium">Plantación a menos de 100 m</th>
              {conFuego && <th className="hidden py-2 pr-2 text-right font-medium sm:table-cell">Plantación quemada 2023-2025</th>}
              {conFuego && (
                <th className="py-2 pr-2 text-right font-medium">
                  Franja quemada 2013-2025<span className="sr-only"> (franja de 100 m, cualquier cobertura)</span>
                </th>
              )}
              <th className="py-2 text-right font-medium">Mapa</th>
            </tr>
          </thead>
          <tbody>
            {visibles.map((s) => (
              <tr key={s.n} id={`sector-${s.n}`} className="fila-sector border-b border-line">
                <td className="py-2 pr-2">
                  {s.marca ? (
                    <>
                      <a href={`#marca-${s.n}`} className="hidden text-link underline sm:inline" aria-label={`Ver el sector ${s.n} en el mapa`}>
                        {s.n}
                      </a>
                      <span className="sm:hidden">{s.n}</span>
                    </>
                  ) : (
                    <span className="text-muted">{s.n}</span>
                  )}
                </td>
                <td className="py-2 pr-2">{nombreSector(s)}</td>
                <td className="hidden py-2 pr-2 text-right sm:table-cell">{nf0.format(Math.round(s.borde_m / 10) * 10)} m</td>
                <td className="py-2 pr-2 text-right">{s.plantacion_100m_ha < 1 ? "menos de 1 ha" : ha(s.plantacion_100m_ha)}</td>
                {conFuego && (
                  <td className="hidden py-2 pr-2 text-right sm:table-cell">
                    {s.quemada_ha === null ? "sin dato" : s.quemada_ha < 0.5 ? "0 ha" : ha(s.quemada_ha)}
                  </td>
                )}
                {conFuego && (
                  <td className="py-2 pr-2 text-right">
                    {s.franja_quemada_2013_2025_ha === null
                      ? "sin dato"
                      : s.franja_quemada_2013_2025_ha < 0.5
                        ? "0 ha"
                        : ha(s.franja_quemada_2013_2025_ha)}
                    {(s.franja_reincidente_2013_2025_ha ?? 0) >= 0.5 && (
                      <span className="block text-xs text-muted">
                        {ha(s.franja_reincidente_2013_2025_ha as number)} dos o más veces
                      </span>
                    )}
                  </td>
                )}
                <td className="whitespace-nowrap py-2 text-right">
                  <a href={enlaceMapa(s)} target="_blank" rel="noopener noreferrer" className="text-link underline"
                    aria-label={`Ver el sector ${s.n} en OpenStreetMap`}>
                    Ver
                  </a>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!todos && sectores.length > 10 && (
        <button onClick={() => setTodos(true)} className="rounded-sm border border-line px-4 py-2 text-sm hover:bg-tint">
          Ver los {sectores.length} sectores
        </button>
      )}
    </div>
  );
}
