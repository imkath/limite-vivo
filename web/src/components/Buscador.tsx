"use client";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useMemo, useRef, useState } from "react";
import { ha } from "@/lib/formato";

type Item = { slug: string; comuna: string; region: string; p500_2022: number };

const EJEMPLOS = ["constitucion", "tome", "vina-del-mar", "valdivia", "concepcion"];

const norm = (s: string) => s.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();

export default function Buscador({ comunas }: { comunas: Item[] }) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [sel, setSel] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);

  const resultados = useMemo(() => {
    const t = norm(q.trim());
    if (!t) return [];
    return comunas.filter((c) => norm(c.comuna).includes(t)).slice(0, 8);
  }, [q, comunas]);

  const ejemplos = useMemo(() => {
    const porSlug = new Map(comunas.map((c) => [c.slug, c]));
    return EJEMPLOS.map((s) => porSlug.get(s)).filter((c): c is Item => !!c);
  }, [comunas]);

  const irA = (slug: string) => router.push(`/comuna/${slug}/`);

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      if (resultados.length) setSel((s) => (s + 1) % resultados.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      if (resultados.length) setSel((s) => (s - 1 + resultados.length) % resultados.length);
    } else if (e.key === "Enter") {
      if (sel >= 0 && resultados[sel]) {
        e.preventDefault();
        irA(resultados[sel].slug);
      } else if (resultados.length === 1) {
        e.preventDefault();
        irA(resultados[0].slug);
      }
    } else if (e.key === "Escape") {
      setQ("");
      setSel(-1);
    }
  };

  return (
    <div className="max-w-xl">
      <label htmlFor="buscar" className="mb-2 block text-sm font-medium">Busca tu comuna</label>
      <input
        id="buscar"
        ref={inputRef}
        value={q}
        onChange={(e) => {
          setQ(e.target.value);
          setSel(-1);
        }}
        onKeyDown={onKeyDown}
        placeholder="Ej. Curanilahue, Valdivia, Colina"
        autoComplete="off"
        role="combobox"
        aria-expanded={resultados.length > 0}
        aria-controls="buscar-resultados"
        aria-activedescendant={sel >= 0 ? `buscar-op-${sel}` : undefined}
        className="w-full rounded-sm border border-line px-4 py-3 text-base outline-none focus:border-link"
      />
      {resultados.length > 0 && (
        <ul id="buscar-resultados" role="listbox" className="mt-2 divide-y divide-line rounded-sm border border-line">
          {resultados.map((c, i) => (
            <li key={c.slug} id={`buscar-op-${i}`} role="option" aria-selected={i === sel}>
              <Link
                prefetch={false}
                href={`/comuna/${c.slug}/`}
                onMouseEnter={() => setSel(i)}
                className={`flex justify-between gap-3 px-4 py-2 hover:bg-tint ${i === sel ? "bg-tint" : ""}`}
              >
                <span>
                  {c.comuna} <span className="text-sm text-muted">{c.region}</span>
                </span>
                <span className="shrink-0 text-sm tabular-nums text-muted">
                  {c.p500_2022 > 0 ? `${ha(c.p500_2022)} a 500 m` : "sin franja"}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
      {q.trim() && resultados.length === 0 && <p className="mt-2 text-sm text-muted">No encontramos esa comuna.</p>}
      {!q.trim() && (
        <p className="mt-3 flex flex-wrap items-baseline gap-x-2 gap-y-1 text-sm text-muted">
          <span>Prueba con</span>
          {ejemplos.map((c, i) => (
            <span key={c.slug}>
              <Link href={`/comuna/${c.slug}/`} className="text-link underline-offset-2 hover:underline">
                {c.comuna}
              </Link>
              {i < ejemplos.length - 1 ? "," : ""}
            </span>
          ))}
        </p>
      )}
    </div>
  );
}
