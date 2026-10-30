import Link from "next/link";
import { JsonLd } from "@/components/DatosEstructurados";
import { SITIO } from "@/lib/enlaces";

type Miga = { texto: string; href?: string };

/**
 * Migas de pan con "Inicio" al principio y la página actual al final (sin enlace).
 * Incluye el BreadcrumbList de schema.org con las mismas rutas.
 */
export default function Migas({ ruta }: { ruta: Miga[] }) {
  const todas: Miga[] = [{ texto: "Inicio", href: "/" }, ...ruta];
  return (
    <>
      <nav aria-label="Migas de pan" className="no-print text-sm">
        <ol className="flex flex-wrap gap-x-2 gap-y-1 text-muted">
          {todas.map((m, i) => {
            const ultima = i === todas.length - 1;
            return (
              <li key={m.texto} className="flex gap-x-2">
                {ultima || !m.href ? (
                  <span aria-current={ultima ? "page" : undefined} className="text-ink">{m.texto}</span>
                ) : (
                  <Link prefetch={false} href={m.href} className="text-link underline-offset-2 hover:underline">{m.texto}</Link>
                )}
                {!ultima && <span aria-hidden="true">/</span>}
              </li>
            );
          })}
        </ol>
      </nav>
      <JsonLd
        datos={{
          "@context": "https://schema.org",
          "@type": "BreadcrumbList",
          itemListElement: todas.map((m, i) => ({
            "@type": "ListItem",
            position: i + 1,
            name: m.texto,
            ...(m.href ? { item: `${SITIO}${m.href}` } : {}),
          })),
        }}
      />
    </>
  );
}
