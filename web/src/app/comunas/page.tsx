import type { Metadata } from "next";
import Migas from "@/components/Migas";
import Link from "next/link";
import Ranking from "@/components/Ranking";
import { filasLivianas, resumen } from "@/lib/datos";

export const metadata: Metadata = {
  title: "Comunas",
  description: "Ranking de comunas de Chile por hectáreas de plantación forestal a menos de 500 m de zonas pobladas.",
};

export default function Comunas() {
  const r = resumen();
  return (
    <div className="space-y-8">
      <header className="max-w-3xl space-y-3">
        <Migas ruta={[{ texto: "Comunas" }]} />
        <h1 className="text-3xl font-semibold leading-tight tracking-tight sm:text-4xl">Comunas</h1>
        <p className="text-lg text-muted">
          Todas las comunas con plantación forestal a menos de 500 m de una zona poblada, ordenadas por hectáreas en 2022
          (MapBiomas Chile, Colección 1). Cada nombre lleva a su ficha, con el mapa, los sectores y lo que pasó en los
          incendios. También puedes recorrerlas en el <Link href="/#mapa" className="text-link underline">mapa del inicio</Link>.
        </p>
      </header>
      <Ranking filas={filasLivianas(r)} todasInicial />
    </div>
  );
}
