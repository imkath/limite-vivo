"use client";
import Link from "next/link";
import { useMemo, useState } from "react";

type Item = { slug: string; comuna: string; region: string };
const norm = (s: string) => s.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();

export default function Buscador({ comunas }: { comunas: Item[] }) {
  const [q, setQ] = useState("");
  const resultados = useMemo(() => {
    const t = norm(q.trim());
    if (!t) return [];
    return comunas.filter((c) => norm(c.comuna).includes(t)).slice(0, 8);
  }, [q, comunas]);
  return (
    <div className="max-w-xl">
      <label htmlFor="buscar" className="mb-2 block text-sm font-medium">Busca tu comuna</label>
      <input
        id="buscar"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Ej. Curanilahue, Valdivia, Colina"
        autoComplete="off"
        className="w-full rounded-md border border-line px-4 py-3 text-base outline-none focus:border-accent"
      />
      {resultados.length > 0 && (
        <ul className="mt-2 divide-y divide-line rounded-md border border-line">
          {resultados.map((c) => (
            <li key={c.slug}>
              <Link href={`/comuna/${c.slug}/`} className="flex justify-between px-4 py-2 hover:bg-accent-soft">
                <span>{c.comuna}</span>
                <span className="text-sm text-muted">{c.region}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
      {q.trim() && resultados.length === 0 && <p className="mt-2 text-sm text-muted">No encontramos esa comuna.</p>}
    </div>
  );
}
