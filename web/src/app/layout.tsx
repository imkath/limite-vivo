import type { Metadata } from "next";
import { IBM_Plex_Sans } from "next/font/google";
import Link from "next/link";
import "./globals.css";

const plex = IBM_Plex_Sans({ subsets: ["latin"], weight: ["400", "500", "600"], variable: "--font-plex" });

export const metadata: Metadata = {
  title: { default: "Límite Vivo", template: "%s · Límite Vivo" },
  description:
    "Plantaciones forestales en el borde de las ciudades de Chile: hectáreas de plantación a menos de 100, 200 y 500 m de zonas pobladas en cada comuna, su evolución desde 2000 y su relación con los incendios 2023-2025. Datos de MapBiomas Chile.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es-CL" className={plex.variable}>
      <body className="min-h-screen">
        <header className="no-print border-b border-ink">
          <nav className="mx-auto flex max-w-5xl flex-wrap items-baseline justify-between gap-3 px-4 py-3">
            <Link href="/" className="text-base font-semibold tracking-tight text-ink">Límite Vivo</Link>
            <div className="flex gap-5 text-sm">
              <Link href="/#comunas" className="text-ink hover:text-link">Comunas</Link>
              <Link href="/direccion/" className="text-ink hover:text-link">Tu dirección</Link>
              <Link href="/metodologia/" className="text-ink hover:text-link">Metodología</Link>
              <a href="/datos/limite-vivo-comunas.csv" download className="text-ink hover:text-link">Datos (CSV)</a>
            </div>
          </nav>
        </header>
        <main className="mx-auto max-w-5xl px-4 py-10">{children}</main>
        <footer className="no-print border-t border-line">
          <div className="mx-auto max-w-5xl space-y-2 px-4 py-6 text-sm text-muted">
            <p>
              Datos de MapBiomas Chile (cobertura y uso del suelo, Colecciones 1 y 2; Fuego, Colección 1), bajo licencia CC BY 4.0.{" "}
              <a href="https://chile.mapbiomas.org" target="_blank" rel="noopener noreferrer" className="text-link underline">chile.mapbiomas.org</a>
            </p>
            <p>
              Límite Vivo es un proyecto independiente de{" "}
              <a href="https://nvrkth.com" target="_blank" rel="noopener noreferrer" className="text-link underline">nvrkth.com</a>{" "}
              y no tiene relación institucional con MapBiomas. El código es abierto.
            </p>
          </div>
        </footer>
      </body>
    </html>
  );
}
