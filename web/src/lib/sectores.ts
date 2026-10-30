import type { Sector } from "./datos";

const nf0 = new Intl.NumberFormat("es-CL", { maximumFractionDigits: 0 });
const nf1 = new Intl.NumberFormat("es-CL", { minimumFractionDigits: 1, maximumFractionDigits: 1 });

/** Nombre del sector según la distancia al lugar con nombre más cercano de OpenStreetMap. */
export function nombreSector(s: Sector) {
  if (s.lugar_m <= 500) return s.lugar;
  if (s.lugar_m <= 2000) {
    const d = s.lugar_m < 1000 ? `${nf0.format(Math.round(s.lugar_m / 10) * 10)} m` : `${nf1.format(s.lugar_m / 1000)} km`;
    return `Cerca de ${s.lugar} (a ${d})`;
  }
  return "Sin lugar con nombre a menos de 2 km";
}
