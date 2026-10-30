import type { Origen as Partes } from "@/lib/datos";
import { ha, pct, tasa } from "@/lib/formato";

const PARTES = [
  { k: "ya_estaba_ha", color: "#9e8040", texto: "Ya estaba junto a las casas en 2000" },
  { k: "llego_ciudad_ha", color: "#cc211c", texto: "La plantación existía y la zona poblada creció hasta ella" },
  { k: "plantacion_nueva_ha", color: "#ed8c1a", texto: "Se plantó después de 2005" },
] as const;

/** Barra apilada con las tres partes de la plantación que hoy está a menos de cierta distancia de las casas. */
export default function Origen({ o, distancia }: { o: Partes; distancia: string }) {
  const total = o.ya_estaba_ha + o.llego_ciudad_ha + o.plantacion_nueva_ha;
  return (
    <figure className="max-w-3xl space-y-3">
      <div className="flex h-4 w-full overflow-hidden bg-tint" role="presentation">
        {PARTES.map((p) => (
          <div key={p.k} style={{ width: `${tasa(o[p.k], total)}%`, background: p.color }} />
        ))}
      </div>
      <figcaption>
        <p className="sr-only">Plantación a menos de {distancia} de una zona poblada, según su origen:</p>
        <ul className="space-y-1 text-sm">
          {PARTES.map((p) => (
            <li key={p.k} className="flex items-start gap-2">
              <span className="mt-1 inline-block h-3 w-3 shrink-0" style={{ background: p.color }} aria-hidden="true" />
              <span>
                {p.texto}: <strong className="font-semibold">{ha(o[p.k])}</strong>{" "}
                <span className="text-muted">({pct(tasa(o[p.k], total))})</span>
              </span>
            </li>
          ))}
        </ul>
      </figcaption>
    </figure>
  );
}
