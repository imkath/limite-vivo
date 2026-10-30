import type { Comuna, Grupo, Indicador } from "./datos";
import { ha, haSigno, pct, pctSigno } from "./formato";

export type Diagnostico = {
  composicion: string;
  cambios: string[];
  transiciones: string[];
  desde2015: string | null;
  contexto: string[];
  implicancias: { tema: string; texto: string }[];
};

const NOMBRE_MIN: Record<string, string> = {
  bosque_nativo: "bosque nativo",
  matorral: "matorral",
  estepa_pastizal: "estepa y pastizal",
  humedal: "humedales",
  plantacion: "plantación forestal",
  agricultura: "agricultura",
  pastura: "pasturas",
  urbano: "infraestructura urbana",
  sin_vegetacion: "áreas sin vegetación",
  agua: "ríos, lagos y mar",
  hielo_nieve: "hielo y nieve",
  no_observado: "áreas no observadas",
};

/** Un cambio es relevante si es grande en hectáreas para la comuna o en proporción. */
function relevante(ind: Indicador, area: number, cambio: "cambio_total" | "cambio_desde_2015") {
  const c = ind[cambio];
  const base = cambio === "cambio_total" ? ind.inicio_ha : ind.c2015_ha;
  const umbralHa = Math.max(20, area * 0.005);
  return Math.abs(c.ha) >= umbralHa && (base < 20 || Math.abs(c.pct ?? 100) >= 5);
}

function fraseCambio(g: string, ind: Indicador, cambio: "cambio_total" | "cambio_desde_2015") {
  const c = ind[cambio];
  const base = cambio === "cambio_total" ? ind.inicio_ha : ind.c2015_ha;
  const verbo = c.ha > 0 ? "aumentó" : "disminuyó";
  const proporcion = c.pct !== null ? ` (${pctSigno(c.pct)})` : "";
  return `La superficie de ${NOMBRE_MIN[g]} ${verbo} de ${ha(base)} a ${ha(ind.actual_ha)}, una diferencia de ${haSigno(c.ha)}${proporcion}.`;
}

export function generarDiagnostico(c: Comuna, grupos: Record<string, Grupo>): Diagnostico {
  const ind = c.indicadores;
  const reg = c.region_indicadores;
  const orden = Object.keys(ind)
    .filter((g) => g !== "no_observado")
    .sort((a, b) => ind[b].actual_ha - ind[a].actual_ha);

  // Composición actual
  const principales = orden.filter((g) => ind[g].actual_pct_area >= 1).slice(0, 4);
  const lista = principales.map((g) => `${NOMBRE_MIN[g]} (${pct(ind[g].actual_pct_area)})`);
  const enumeracion = lista.length > 1 ? `${lista.slice(0, -1).join(", ")} y ${lista.at(-1)}` : lista[0];
  const composicion =
    `Según MapBiomas Chile (Colección 2), en el promedio 2022–2024 la comuna de ${c.comuna} ` +
    `(${ha(c.area_ha)}) está cubierta principalmente por ${enumeracion}.`;

  // Cambios 1999–2024
  const cambios = orden
    .filter((g) => relevante(ind[g], c.area_ha, "cambio_total"))
    .sort((a, b) => Math.abs(ind[b].cambio_total.ha) - Math.abs(ind[a].cambio_total.ha))
    .slice(0, 5)
    .map((g) => fraseCambio(g, ind[g], "cambio_total"));

  // Transiciones principales (brutas, 1999–2024)
  const umbralTr = Math.max(10, c.area_ha * 0.003);
  const transiciones = c.transiciones_1999_2024
    .filter(([de, a, v]) => v >= umbralTr && de !== "no_observado" && a !== "no_observado")
    .slice(0, 4)
    .map(([de, a, v]) => `${ha(v)} pasaron de ${NOMBRE_MIN[de]} a ${NOMBRE_MIN[a]}.`);

  // Desde el periodo 2014–2016
  const recientes = orden
    .filter((g) => relevante(ind[g], c.area_ha, "cambio_desde_2015"))
    .sort((a, b) => Math.abs(ind[b].cambio_desde_2015.ha) - Math.abs(ind[a].cambio_desde_2015.ha))
    .slice(0, 3);
  const desde2015 = recientes.length
    ? `Si el plan se apoya en información de uso de suelo de alrededor de 2015, como el Catastro de CONAF de ese año, ` +
      `conviene considerar los cambios ocurridos desde entonces. Entre el promedio 2014–2016 y el promedio 2022–2024: ` +
      recientes
        .map((g) => {
          const d = ind[g].cambio_desde_2015;
          return `${NOMBRE_MIN[g]} ${haSigno(d.ha)}${d.pct !== null ? ` (${pctSigno(d.pct)})` : ""}`;
        })
        .join("; ") + "."
    : null;

  // Contexto regional y nacional
  const contexto: string[] = [];
  for (const g of ["bosque_nativo", "plantacion", "urbano", "humedal"]) {
    const a = ind[g].actual_pct_area;
    const r = reg[g]?.actual_pct_area ?? 0;
    if (a >= 1 || r >= 1) {
      if (a >= r * 1.5 && a - r >= 2)
        contexto.push(`La proporción de ${NOMBRE_MIN[g]} (${pct(a)}) es mayor que el promedio de la región de ${c.region} (${pct(r)}).`);
      else if (a <= r * 0.5 && r - a >= 2)
        contexto.push(`La proporción de ${NOMBRE_MIN[g]} (${pct(a)}) es menor que el promedio de la región de ${c.region} (${pct(r)}).`);
    }
  }
  const rk = c.ranking;
  const destacado = (k: string, texto: string) => {
    const r = rk[k];
    if (r?.puesto && r.puesto <= Math.ceil(r.de * 0.1)) contexto.push(`Ocupa el puesto ${r.puesto} de ${r.de} comunas en ${texto}.`);
  };
  destacado("perdida_bosque_nativo_ha", "pérdida de bosque nativo en hectáreas entre 1999 y 2024");
  destacado("perdida_bosque_nativo_pct", "pérdida proporcional de bosque nativo");
  destacado("crecimiento_urbano_pct", "crecimiento proporcional de la infraestructura urbana");
  destacado("crecimiento_plantacion_ha", "aumento de plantación forestal en hectáreas");
  destacado("perdida_humedal_pct", "pérdida proporcional de humedales");

  // Implicancias para el plan
  const implicancias: Diagnostico["implicancias"] = [];
  const bn = ind.bosque_nativo;
  if (bn.cambio_total.ha < 0 && relevante(bn, c.area_ha, "cambio_total"))
    implicancias.push({
      tema: "Sumideros de carbono y biodiversidad",
      texto:
        `La disminución de bosque nativo (${haSigno(bn.cambio_total.ha)}) reduce la capacidad de captura de carbono y los servicios ecosistémicos de la comuna, como la regulación hídrica y el control de la erosión. ` +
        `Puede considerarse en las medidas de mitigación y en acciones de conservación o restauración.`,
    });
  const pl = ind.plantacion;
  if (pl.actual_pct_area >= 20)
    implicancias.push({
      tema: "Riesgo de incendios",
      texto:
        `Las plantaciones forestales cubren el ${pct(pl.actual_pct_area)} de la comuna. ` +
        `Es un antecedente para el análisis de exposición a incendios forestales y para coordinar el plan con el Plan Comunal de Reducción del Riesgo de Desastres (Ley 21.364), en especial en la interfaz urbano-forestal.`,
    });
  const ur = ind.urbano;
  if (ur.cambio_total.ha > 0 && relevante(ur, c.area_ha, "cambio_total"))
    implicancias.push({
      tema: "Expansión urbana",
      texto:
        `La infraestructura urbana creció ${haSigno(ur.cambio_total.ha)}${ur.cambio_total.pct !== null ? ` (${pctSigno(ur.cambio_total.pct)})` : ""}. ` +
        `El aumento de superficies impermeables se asocia a islas de calor y a mayor escorrentía en lluvias intensas, temas que pueden abordarse junto al Plan Regulador Comunal.`,
    });
  const hu = ind.humedal;
  if (hu.cambio_total.ha < 0 && relevante(hu, c.area_ha, "cambio_total"))
    implicancias.push({
      tema: "Humedales",
      texto:
        `La superficie de humedales disminuyó (${haSigno(hu.cambio_total.ha)}). ` +
        `Los humedales amortiguan inundaciones y sequías; si existen humedales urbanos, la Ley 21.202 permite solicitar su reconocimiento para protegerlos.`,
    });
  const hn = ind.hielo_nieve;
  if (hn.inicio_ha >= 50 && hn.cambio_total.ha < 0 && relevante(hn, c.area_ha, "cambio_total"))
    implicancias.push({
      tema: "Reservas de agua",
      texto: `La cobertura de hielo y nieve disminuyó (${haSigno(hn.cambio_total.ha)}), lo que puede afectar la disponibilidad de agua en temporada seca.`,
    });
  const ag = ind.agricultura;
  if (ag.cambio_total.ha < 0 && relevante(ag, c.area_ha, "cambio_total"))
    implicancias.push({
      tema: "Suelo agrícola",
      texto: `La superficie agrícola disminuyó (${haSigno(ag.cambio_total.ha)}). Conviene revisar hacia qué usos se transformó y su relación con la seguridad alimentaria local.`,
    });

  void grupos;
  return { composicion, cambios, transiciones, desde2015, contexto, implicancias };
}

export const CITA =
  "MapBiomas Chile – Colección 2 de la Serie Anual de Mapas de Cobertura y Uso del Suelo de Chile, accedido a través de https://chile.mapbiomas.org.";
