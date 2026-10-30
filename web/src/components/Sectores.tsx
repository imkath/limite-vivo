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
        <table className="w-full min-w-[620px] text-sm">
          <thead>
            <tr className="border-b border-ink text-left">
              <th className="py-2 pr-2 font-medium">N.º</th>
              <th className="py-2 pr-2 font-medium">Sector</th>
              <th className="py-2 pr-2 text-right font-medium">Borde expuesto (aprox.)</th>
              <th className="py-2 pr-2 text-right font-medium">Plantación a menos de 100 m</th>
              {conFuego && <th className="py-2 pr-2 text-right font-medium">Plantación quemada 2023-2025</th>}
              <th className="py-2 font-medium"><span className="sr-only">Mapa</span></th>
            </tr>
          </thead>
          <tbody>
            {visibles.map((s) => (
              <tr key={s.n} className="border-b border-line">
                <td className="py-2 pr-2 text-muted">{s.n}</td>
                <td className="py-2 pr-2">{nombreSector(s)}</td>
                <td className="py-2 pr-2 text-right">{nf0.format(Math.round(s.borde_m / 10) * 10)} m</td>
                <td className="py-2 pr-2 text-right">{s.plantacion_100m_ha < 1 ? "menos de 1 ha" : ha(s.plantacion_100m_ha)}</td>
                {conFuego && (
                  <td className="py-2 pr-2 text-right">
                    {s.quemada_ha === null ? "sin dato" : s.quemada_ha < 0.5 ? "0 ha" : ha(s.quemada_ha)}
                  </td>
                )}
                <td className="whitespace-nowrap py-2 text-right">
                  <a href={enlaceMapa(s)} target="_blank" rel="noopener noreferrer" className="text-link underline"
                    aria-label={`Ver el sector ${s.n} en OpenStreetMap`}>
                    Ver en mapa
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
