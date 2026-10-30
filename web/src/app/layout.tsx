import type { Metadata } from "next";
import { IBM_Plex_Sans } from "next/font/google";
import Link from "next/link";
import DescargaCsv from "@/components/DescargaCsv";
import Navegacion from "@/components/Navegacion";
import { SITIO } from "@/lib/enlaces";
import "./globals.css";

const plex = IBM_Plex_Sans({ subsets: ["latin"], weight: ["400", "500", "600", "700"], variable: "--font-plex" });

export const metadata: Metadata = {
  metadataBase: new URL(SITIO),
  openGraph: { siteName: "Límite Vivo", locale: "es_CL", type: "website" },
  title: { default: "Límite Vivo", template: "%s · Límite Vivo" },
  description:
    "Plantaciones forestales en el borde de las ciudades de Chile: hectáreas de plantación a menos de 100, 200 y 500 m de zonas pobladas en cada comuna, su evolución desde 2000 y su relación con los incendios 2023-2025. Datos de MapBiomas Chile.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es-CL" className={plex.variable}>
      <body className="min-h-screen">
        <header className="no-print border-b border-ink">
          <nav className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 px-4 py-3">
            <Link href="/" className="text-base font-bold uppercase tracking-[0.08em] text-ink">Límite Vivo</Link>
            <div className="flex flex-wrap items-center gap-x-5 gap-y-2 whitespace-nowrap text-sm">
              <Navegacion />
              <DescargaCsv compacto />
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
