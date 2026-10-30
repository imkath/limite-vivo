import fs from "node:fs";
import path from "node:path";

export type Franja = {
  plantacion_ha: number;
  plantacion_100m_ha: number;
  plantacion_200m_ha: number;
  plantacion_500m_ha: number;
  poblado_ha: number;
};
export type Fuego = {
  plantacion_ha: number;
  plantacion_quemada_ha: number;
  natural_ha: number;
  natural_quemada_ha: number;
  agricola_ha: number;
  agricola_quemada_ha: number;
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
  quemado_2023_2025_ha: number;
  serie_col2: { anios: number[]; plantacion: number[]; urbano: number[] };
  puesto: number | null;
  puesto_de: number;
};
export type Validacion = { rr: number; ic95: [number, number]; comunas_mayor: number; comunas: number };
export type FilaResumen = {
  slug: string;
  comuna: string;
  region: string;
  puesto: number | null;
  p500_2000: number;
  p500_2022: number;
  p100_2022: number;
  p500_2024_c2: number;
  fuego: boolean;
};
export type Resumen = {
  nacional: { col1: Record<string, Franja>; col2: Record<string, Franja> };
  validacion: Record<"col1" | "col2", Record<"natural" | "agricola", Validacion>>;
  sensibilidad: Record<"col1" | "col2", { plantacion_min_ha: number; quemado_min_ha: number; comunas: number; natural: number; agricola: number }[] | null>;
  sin_una_comuna: Record<"col1" | "col2", [number, number] | null>;
  comunas: FilaResumen[];
};

const DIR = path.join(process.cwd(), "public", "datos");
const leer = <T,>(f: string): T => JSON.parse(fs.readFileSync(path.join(DIR, f), "utf8"));

export const resumen = () => leer<Resumen>("resumen.json");
export const comuna = (slug: string) => leer<Comuna>(`comunas/${slug}.json`);

export const CITA =
  "MapBiomas Chile. Colección 1 y Colección 2 de la Serie Anual de Mapas de Cobertura y Uso del Suelo de Chile; MapBiomas Fuego Chile, Colección 1. Accedido el 30-10-2026 a través de https://chile.mapbiomas.org.";
