const nf0 = new Intl.NumberFormat("es-CL", { maximumFractionDigits: 0 });
const nf1 = new Intl.NumberFormat("es-CL", { maximumFractionDigits: 1, minimumFractionDigits: 1 });

export const ha = (v: number) => `${nf0.format(Math.round(v))} ha`;
export const pct = (v: number) => `${nf1.format(v)} %`;
export const signo = (v: number) => (v > 0 ? "+" : v < 0 ? "−" : "");
export const haSigno = (v: number) => {
  const r = Math.round(v);
  return `${signo(r)}${nf0.format(Math.abs(r))} ha`;
};
export const pctSigno = (v: number) => {
  const r = Math.round(v * 10) / 10;
  return `${signo(r)}${nf1.format(Math.abs(r))} %`;
};
export const veces = (v: number) => `${nf1.format(v)} veces`;
export const tasa = (quemada: number, total: number) => (total > 0 ? (quemada / total) * 100 : 0);
