"use client";
import "leaflet/dist/leaflet.css";
import { useEffect, useRef } from "react";

/**
 * Mapa para corregir el punto: el pin se arrastra o se mueve con un clic, y cada cambio
 * recalcula el resultado. Leaflet se carga solo cuando la persona abre este mapa.
 */
export default function MapaAjuste({
  lat,
  lon,
  onMover,
}: {
  lat: number;
  lon: number;
  onMover: (lat: number, lon: number) => void;
}) {
  const contenedor = useRef<HTMLDivElement>(null);
  const mover = useRef(onMover);
  // Guarda la última función recibida sin volver a crear el mapa
  useEffect(() => {
    mover.current = onMover;
  });

  useEffect(() => {
    let mapa: import("leaflet").Map | null = null;
    let cancelado = false;
    import("leaflet").then((L) => {
      if (cancelado || !contenedor.current) return;
      mapa = L.map(contenedor.current, { scrollWheelZoom: false }).setView([lat, lon], 17);
      L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        attribution: '© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">colaboradores de OpenStreetMap</a>',
      }).addTo(mapa);
      const icono = L.divIcon({ className: "pin-ajuste", iconSize: [22, 22], iconAnchor: [11, 11] });
      const pin = L.marker([lat, lon], { draggable: true, icon: icono, keyboard: true, title: "Punto a revisar" }).addTo(mapa);
      pin.on("dragend", () => {
        const p = pin.getLatLng();
        mover.current(p.lat, p.lng);
      });
      mapa.on("click", (e: import("leaflet").LeafletMouseEvent) => {
        pin.setLatLng(e.latlng);
        mover.current(e.latlng.lat, e.latlng.lng);
      });
    });
    return () => {
      cancelado = true;
      mapa?.remove();
    };
    // El mapa se crea una sola vez con el punto inicial; los movimientos posteriores los hace la persona
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div
      ref={contenedor}
      className="h-80 w-full border border-line"
      role="application"
      aria-label="Mapa para ajustar el punto. Arrastra el marcador o haz clic donde está tu casa."
    />
  );
}
