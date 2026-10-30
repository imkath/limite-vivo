import Link from "next/link";

export default function NoEncontrada() {
  return (
    <div className="max-w-3xl space-y-4">
      <h1 className="text-3xl font-semibold tracking-tight">No encontramos esa página</h1>
      <p>
        Puede que el enlace esté mal escrito o que la página ya no exista. Puedes{" "}
        <Link href="/" className="text-link underline">volver al inicio</Link>, revisar el{" "}
        <Link href="/comunas/" className="text-link underline">listado de comunas</Link> o{" "}
        <Link href="/direccion/" className="text-link underline">buscar tu dirección</Link>.
      </p>
    </div>
  );
}
