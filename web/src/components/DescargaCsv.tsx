import fs from "node:fs";
import path from "node:path";

const RUTA = "/datos/limite-vivo-comunas.csv";

/** Peso real del archivo, leído al compilar */
function peso() {
  const bytes = fs.statSync(path.join(process.cwd(), "public", RUTA)).size;
  return `${Math.max(1, Math.round(bytes / 1024))} kB`;
}

/**
 * Botón de descarga del CSV con todas las comunas. Se ve como una acción (borde e ícono de descarga)
 * y dice qué archivo baja, para que no se confunda con un enlace a otra página.
 */
export default function DescargaCsv({ texto = "Descargar datos", compacto = false }: { texto?: string; compacto?: boolean }) {
  return (
    <a
      href={RUTA}
      download="limite-vivo-comunas.csv"
      className={`inline-flex max-w-full items-center gap-x-1.5 rounded-sm border border-ink text-ink hover:bg-tint ${compacto ? "whitespace-nowrap px-2 py-0.5" : "flex-wrap px-3 py-1.5 text-sm"}`}
    >
      <svg aria-hidden="true" viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.6">
        <path d="M8 2v8M4.5 6.8 8 10.3l3.5-3.5M3 13.5h10" />
      </svg>
      {texto}
      <span className="text-muted">(CSV, {peso()})</span>
    </a>
  );
}
