import fs from "node:fs";
import path from "node:path";

export type Franja = {
  plantacion_ha: number;
  plantacion_100m_ha: number;
  plantacion_200m_ha: number;
  plantacion_500m_ha: number;
  poblado_ha: number;
};
export type Sector = {
  n: number;
  lat: number;
  lon: number;
  borde_m: number;
  plantacion_100m_ha: number;
  quemada_ha: number | null;
  /** Superficie de la franja de 100 m del sector quemada al menos una vez entre 2013 y 2025 (null sin datos de Fuego) */
  franja_quemada_2013_2025_ha: number | null;
  /** La misma franja, quemada dos o más veces entre 2013 y 2025 */
  franja_reincidente_2013_2025_ha: number | null;
  lugar: string;
  lugar_m: number;
  /** Posición del marcador numerado en la imagen del mapa, en % del ancho y del alto */
  marca?: [number, number];
};
export type SectorBreve = Pick<Sector, "n" | "lugar" | "lugar_m" | "plantacion_100m_ha">;
export type Fuego = {
  plantacion_ha: number;
  plantacion_quemada_ha: number;
  natural_ha: number;
  natural_quemada_ha: number;
  agricola_ha: number;
  agricola_quemada_ha: number;
};
/** De dónde viene la plantación que está junto a las zonas pobladas al final del período (scripts/crecimiento.py). */
export type Origen = {
  final_ha: number;
  ya_estaba_ha: number;
  llego_ciudad_ha: number;
  plantacion_nueva_ha: number;
  inicial_ha: number;
  salio_ha: number;
  poblado_nuevo_junto_a_plantacion_ha: number;
};
export type Crecimiento = Record<"100m" | "500m", Origen>;
/** Personas en manzanas del Censo 2024 según su distancia a la plantación (scripts/poblacion.py). */
export type GrupoPoblacion = { personas: number; viviendas: number; ninos_0_13: number; mayores_60: number; dificultad_mover: number };
export type Poblacion = Record<"100m" | "500m" | "total", GrupoPoblacion> & {
  /** Personas contando solo las manzanas cuyo punto interior está dentro de la distancia (criterio estricto) */
  centro: Record<"100m" | "500m", number>;
};
export type Comuna = {
  slug: string;
  comuna: string;
  provincia: string;
  region: string;
  area_ha: number;
  col1: Record<"2000" | "2022", Franja>;
  col2: Record<"2000" | "2022" | "2024", Franja>;
  fuego_col1: Fuego | null;
  fuego_col2: Fuego | null;
  fuego_cubierta: boolean;
  sectores: Sector[];
  crecimiento: Crecimiento;
  poblacion: Poblacion | null;
  mapa_px?: [number, number];
  quemado_2023_2025_ha: number;
  serie_col2: { anios: number[]; plantacion: number[]; urbano: number[] };
  puesto: number | null;
  puesto_de: number;
};
export type Mapa = { ancho: number; alto: number; comunas: { slug: string; d: string }[] };
export type Vecinas = Record<string, string[]>;
export type Validacion = { rr: number; ic95: [number, number]; comunas_mayor: number; comunas: number };
export type FilaResumen = {
  slug: string;
  personas_100m?: number;
  personas_500m?: number;
  llego_ciudad_100m?: number;
  comuna: string;
  region: string;
  puesto: number | null;
  p500_2000: number;
  p500_2022: number;
  p100_2022: number;
  p500_2024_c2: number;
  fuego: boolean;
  sectores_n: number;
  sectores_top3: SectorBreve[];
};
export type Resumen = {
  nacional: { col1: Record<string, Franja>; col2: Record<string, Franja> };
  validacion: Record<"col1" | "col2", Record<"natural" | "agricola", Validacion>>;
  sensibilidad: Record<"col1" | "col2", { plantacion_min_ha: number; quemado_min_ha: number; comunas: number; natural: number; agricola: number }[] | null>;
  sin_una_comuna: Record<"col1" | "col2", [number, number] | null>;
  comunas: FilaResumen[];
  sectores_total: number;
  sectores_suma_100m_ha: number;
  sectores_top: (Sector & { slug: string; comuna: string; region: string })[];
  sectores_historial: { con_dato: number; quemados: number; reincidentes: number };
  crecimiento: Record<"col1_2022" | "col2_2022" | "col2_2024", Crecimiento>;
  poblacion: Poblacion;
  top_personas: (GrupoPoblacion & { slug: string; comuna: string; region: string; personas_500m: number; personas_total: number })[];
  top_llego_ciudad: (Origen & { slug: string; comuna: string; region: string })[];
};

const DIR = path.join(process.cwd(), "public", "datos");
const leer = <T,>(f: string): T => JSON.parse(fs.readFileSync(path.join(DIR, f), "utf8"));

export const resumen = () => leer<Resumen>("resumen.json");
export const comuna = (slug: string) => leer<Comuna>(`comunas/${slug}.json`);
export const mapa = () => leer<Mapa>("mapa.json");
export const vecinas = (slug: string): string[] => leer<Vecinas>("vecinas.json")[slug] ?? [];

// Formato exigido en https://chile.mapbiomas.org/terminos-de-uso/
export const CITAS = [
  "MapBiomas – Colección 1 de la Serie Anual de Mapas de Cobertura y Uso del Suelo de Chile, consultada el 30/10/2026 a través del enlace: https://chile.mapbiomas.org",
  "MapBiomas – Colección 2 de la Serie Anual de Mapas de Cobertura y Uso del Suelo de Chile, consultada el 30/10/2026 a través del enlace: https://chile.mapbiomas.org",
  "MapBiomas – Colección 1 de MapBiomas Fuego Chile (área quemada anual y frecuencia de quema), consultada el 30/10/2026 a través del enlace: https://chile.mapbiomas.org",
  "Instituto Nacional de Estadísticas (INE) – Cartografía del Censo de Población y Vivienda 2024, manzanas, consultada el 30/10/2026 en https://censo2024.ine.gob.cl/resultados/",
];


/** Solo los campos que usan el buscador, el ranking y el mapa, para no enviar datos de más al navegador. */
export function filasLivianas(r: Resumen): FilaResumen[] {
  return r.comunas.map((c) => ({
    slug: c.slug,
    comuna: c.comuna,
    region: c.region,
    puesto: c.puesto,
    p500_2000: c.p500_2000,
    p500_2022: c.p500_2022,
    p100_2022: c.p100_2022,
    p500_2024_c2: 0,
    fuego: c.fuego,
    sectores_n: c.sectores_n,
    sectores_top3: c.sectores_top3.map((x) => ({
      n: x.n,
      lugar: x.lugar,
      lugar_m: x.lugar_m,
      plantacion_100m_ha: x.plantacion_100m_ha,
    })),
  }));
}

/** Para el buscador basta con el nombre, la región y la cifra de 500 m. */
export function filasBuscador(r: Resumen) {
  return r.comunas.map((c) => ({ slug: c.slug, comuna: c.comuna, region: c.region, p500_2022: c.p500_2022 }));
}
