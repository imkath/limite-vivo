"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

const SECCIONES = [
  { href: "/hallazgos/", texto: "Hallazgos" },
  { href: "/comunas/", texto: "Comunas", tambien: "/comuna/" },
  { href: "/direccion/", texto: "Tu dirección" },
  { href: "/metodologia/", texto: "Metodología" },
];

/** Enlaces del menú; la sección actual queda marcada (las fichas de comuna cuentan como "Comunas"). */
export default function Navegacion() {
  const ruta = usePathname() ?? "/";
  return (
    <>
      {SECCIONES.map((s) => {
        const activa = ruta.startsWith(s.href) || (s.tambien ? ruta.startsWith(s.tambien) : false);
        return (
          <Link
            key={s.href}
            href={s.href}
            aria-current={activa ? "page" : undefined}
            className={
              activa
                ? "font-semibold text-ink underline decoration-2 underline-offset-[6px]"
                : "text-ink hover:text-link"
            }
          >
            {s.texto}
          </Link>
        );
      })}
    </>
  );
}
