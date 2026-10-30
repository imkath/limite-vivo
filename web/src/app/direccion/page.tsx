import type { Metadata } from "next";
import Direccion from "@/components/Direccion";
import Migas from "@/components/Migas";

export const metadata: Metadata = {
  title: "Tu dirección",
  description:
    "Ubica tu dirección o usa tu ubicación para saber a cuántos metros hay plantación forestal, según MapBiomas Chile.",
};

export default function PaginaDireccion() {
  return (
    <div className="space-y-3">
      <Migas ruta={[{ texto: "Tu dirección" }]} />
      <Direccion />
    </div>
  );
}
