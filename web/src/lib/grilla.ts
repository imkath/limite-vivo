"use client";

export type Indice = {
  cell: number;
  tile: number;
  cells_por_tile: number;
  tope_dist_m: number;
  radio_ha_m: number;
  tiles: string[];
};

export type ResultadoCelda = {
  distanciaM: number;
  topeM: number;
  ha500: number;
  quema: boolean | null;
  slug: string;
};

type TileData = { slugs: string[]; celdas: [number, number, number, number, number][] };
type TileIndexado = { idx: Map<number, [number, number, number, number]>; slugs: string[] };

let indicePromesa: Promise<Indice | null> | null = null;
const tilesCache = new Map<string, Promise<TileIndexado | null>>();

async function obtenerIndice(): Promise<Indice | null> {
  if (!indicePromesa) {
    indicePromesa = fetch("/datos/grilla/indice.json")
      .then((r) => (r.ok ? r.json() : null))
      .catch(() => null);
  }
  return indicePromesa;
}

function nombreTile(ti: number, tj: number, tile: number) {
  return `${(ti * tile).toFixed(1)}_${(tj * tile).toFixed(1)}`;
}

async function obtenerTile(nombre: string): Promise<TileIndexado | null> {
  if (!tilesCache.has(nombre)) {
    tilesCache.set(
      nombre,
      fetch(`/datos/grilla/${nombre}.json`)
        .then((r) => (r.ok ? r.json() : null))
        .then((data: TileData | null) => {
          if (!data) return null;
          const idx = new Map<number, [number, number, number, number]>();
          for (const [clave, d, h5, q, slugIdx] of data.celdas) idx.set(clave, [d, h5, q, slugIdx]);
          return { idx, slugs: data.slugs };
        }),
    );
  }
  return tilesCache.get(nombre)!;
}

/** Busca la celda de la grilla que cubre una coordenada. Null si queda fuera de la grilla
 * (zona no poblada, o sin datos de MapBiomas). */
export async function buscarCelda(lat: number, lon: number): Promise<ResultadoCelda | null> {
  const ind = await obtenerIndice();
  if (!ind) return null;
  const i = Math.floor(lat / ind.cell);
  const j = Math.floor(lon / ind.cell);
  const ti = Math.floor(i / ind.cells_por_tile);
  const tj = Math.floor(j / ind.cells_por_tile);
  const nombre = nombreTile(ti, tj, ind.tile);
  if (!ind.tiles.includes(nombre)) return null;
  const tile = await obtenerTile(nombre);
  if (!tile) return null;
  const li = i - ti * ind.cells_por_tile;
  const lj = j - tj * ind.cells_por_tile;
  const clave = li * ind.cells_por_tile + lj;
  const fila = tile.idx.get(clave);
  if (!fila) return null;
  const [d, h5, q, slugIdx] = fila;
  return {
    distanciaM: d,
    topeM: ind.tope_dist_m,
    ha500: h5 / 10,
    quema: q === -1 ? null : q === 1,
    slug: tile.slugs[slugIdx],
  };
}

type FilaResumen = { slug: string; comuna: string; region: string };
let comunasPromesa: Promise<FilaResumen[] | null> | null = null;

async function obtenerComunas(): Promise<FilaResumen[] | null> {
  if (!comunasPromesa) {
    comunasPromesa = fetch("/datos/resumen.json")
      .then((r) => (r.ok ? r.json() : null))
      .then((data: { comunas: FilaResumen[] } | null) => data?.comunas ?? null)
      .catch(() => null);
  }
  return comunasPromesa;
}

const normalizar = (s: string) => s.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase().trim();

/** Intenta reconocer la comuna a partir de los campos de dirección que devuelve Nominatim. */
export async function comunaDesdeDireccion(
  address: Record<string, string> | undefined,
): Promise<FilaResumen | null> {
  if (!address) return null;
  const comunas = await obtenerComunas();
  if (!comunas) return null;
  const candidatos = [address.city, address.town, address.municipality, address.village, address.county, address.suburb].filter(
    Boolean,
  ) as string[];
  for (const cand of candidatos) {
    const n = normalizar(cand);
    const hit = comunas.find((c) => normalizar(c.comuna) === n);
    if (hit) return hit;
  }
  return null;
}

export async function nombreComuna(slug: string): Promise<string | null> {
  const comunas = await obtenerComunas();
  return comunas?.find((c) => c.slug === slug)?.comuna ?? null;
}
