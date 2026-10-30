const nf0 = new Intl.NumberFormat("es-CL", { maximumFractionDigits: 0 });
const nf1 = new Intl.NumberFormat("es-CL", { maximumFractionDigits: 1, minimumFractionDigits: 1 });

export const ha = (v: number) => `${nf0.format(Math.round(v))}\u00a0ha`;
export const pct = (v: number) => `${nf1.format(v)}\u00a0%`;
export const signo = (v: number) => (v > 0 ? "+" : v < 0 ? "−" : "");
export const haSigno = (v: number) => {
  const r = Math.round(v);
  return `${signo(r)}${nf0.format(Math.abs(r))}\u00a0ha`;
};
export const pctSigno = (v: number) => {
  const r = Math.round(v * 10) / 10;
  return `${signo(r)}${nf1.format(Math.abs(r))}\u00a0%`;
};
export const veces = (v: number) => `${nf1.format(v)} veces`;
export const tasa = (quemada: number, total: number) => (total > 0 ? (quemada / total) * 100 : 0);

/** Nombre oficial de la región con su artículo ("Región del Biobío", "Región Metropolitana de Santiago"). */
export function nombreRegion(r: string) {
  if (r.startsWith("Metropolitana")) return "Región Metropolitana de Santiago";
  if (["Biobío", "Maule"].includes(r) || r.startsWith("Libertador")) return `Región del ${r}`;
  return `Región de ${r}`;
}

/** Número entero con separador de miles chileno ("12.345"). */
export const entero = (v: number) => nf0.format(Math.round(v));
