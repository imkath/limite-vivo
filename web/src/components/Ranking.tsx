"use client";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { FilaResumen } from "@/lib/datos";
import { ha, haSigno } from "@/lib/formato";

export default function Ranking({ filas, todasInicial = false }: { filas: FilaResumen[]; todasInicial?: boolean }) {
  const regiones = useMemo(() => [...new Set(filas.map((f) => f.region))].sort((a, b) => a.localeCompare(b, "es")), [filas]);
  const [region, setRegion] = useState("");
  // Permite enlazar el listado ya filtrado: /comunas/?region=Maule
  useEffect(() => {
    const r = new URLSearchParams(window.location.search).get("region");
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (r && filas.some((f) => f.region === r)) setRegion(r);
  }, [filas]);
  const [todas, setTodas] = useState(todasInicial);
  const visibles = filas.filter((f) => f.puesto !== null && (!region || f.region === region));
  const mostradas = todas || region ? visibles : visibles.slice(0, 25);
  return (
    <div>
      <div className="mb-3 flex flex-wrap items-end gap-3">
        <div>
          <label htmlFor="region" className="mb-1 block text-sm font-medium">Región</label>
          <select id="region" value={region} onChange={(e) => setRegion(e.target.value)}
            className="rounded-sm border border-line bg-bg px-3 py-2 text-sm">
            <option value="">Todo Chile</option>
            {regiones.map((r) => <option key={r} value={r}>{r}</option>)}
          </select>
        </div>
        <p className="text-sm text-muted">{visibles.length} comunas con plantación a menos de 500 m de zonas pobladas</p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] text-sm">
          <thead>
            <tr className="border-b border-line text-left text-muted">
              <th className="py-2 pr-2 font-medium">#</th>
              <th className="py-2 pr-2 font-medium">Comuna</th>
              <th className="py-2 pr-2 font-medium">Región</th>
              <th className="py-2 pr-2 text-right font-medium">A menos de 500 m, 2022</th>
              <th className="py-2 pr-2 text-right font-medium">Cambio desde 2000</th>
              <th className="py-2 text-right font-medium">A menos de 100 m</th>
            </tr>
          </thead>
          <tbody>
            {mostradas.map((f) => (
              <tr key={f.slug} className="border-b border-line">
                <td className="py-2 pr-2 tabular-nums text-muted">{f.puesto}</td>
                <td className="py-2 pr-2"><Link href={`/comuna/${f.slug}/`} className="text-link underline-offset-2 hover:underline">{f.comuna}</Link></td>
                <td className="py-2 pr-2 text-muted">{f.region}</td>
                <td className="py-2 pr-2 text-right tabular-nums">{ha(f.p500_2022)}</td>
                <td className="py-2 pr-2 text-right tabular-nums">{haSigno(f.p500_2022 - f.p500_2000)}</td>
                <td className="py-2 text-right tabular-nums">{ha(f.p100_2022)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!todas && !region && visibles.length > 25 && (
        <button onClick={() => setTodas(true)} className="mt-3 rounded-sm border border-line px-4 py-2 text-sm hover:bg-tint">
          Ver las {visibles.length} comunas
        </button>
      )}
    </div>
  );
}

