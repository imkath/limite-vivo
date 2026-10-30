import { SITIO } from "@/lib/enlaces";

/** JSON-LD de schema.org. Solo se usan tipos que Google documenta: WebSite, Dataset y BreadcrumbList. */
export function JsonLd({ datos }: { datos: object }) {
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(datos) }} />;
}

export const SITIO_WEB = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  name: "Límite Vivo",
  url: `${SITIO}/`,
  inLanguage: "es-CL",
  description:
    "Plantación forestal a menos de 100, 200 y 500 m de zonas pobladas en cada comuna de Chile, con datos de MapBiomas Chile.",
};

export const CONJUNTO_DE_DATOS = {
  "@context": "https://schema.org",
  "@type": "Dataset",
  name: "Límite Vivo: plantación forestal junto a zonas pobladas por comuna de Chile",
  description:
    "Hectáreas de plantación forestal a menos de 100, 200 y 500 metros de zonas pobladas en las 343 comunas de Chile, para 2000 y 2022 (MapBiomas Chile, Colección 1) y 2000 y 2024 (Colección 2), con la plantación y la vegetación natural quemadas en esa franja entre 2023 y 2025 según MapBiomas Fuego.",
  url: `${SITIO}/hallazgos/`,
  inLanguage: "es",
  license: "https://creativecommons.org/licenses/by/4.0/",
  isAccessibleForFree: true,
  creator: { "@type": "Organization", name: "nvrkth.com", url: "https://nvrkth.com" },
  isBasedOn: "https://chile.mapbiomas.org",
  keywords: ["plantación forestal", "interfaz urbano-forestal", "incendios forestales", "Chile", "MapBiomas", "comunas"],
  spatialCoverage: { "@type": "Place", name: "Chile" },
  temporalCoverage: "2000/2025",
  variableMeasured: [
    "Plantación forestal a menos de 100 m de zonas pobladas (ha)",
    "Plantación forestal a menos de 200 m de zonas pobladas (ha)",
    "Plantación forestal a menos de 500 m de zonas pobladas (ha)",
    "Plantación y vegetación natural quemadas en la franja de 500 m, 2023-2025 (ha)",
  ],
  distribution: [
    { "@type": "DataDownload", encodingFormat: "text/csv", contentUrl: `${SITIO}/datos/limite-vivo-comunas.csv` },
  ],
};
