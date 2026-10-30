# Límite Vivo: dirección de diseño

**Dirección: carta topográfica del IGM.** La herramienta es cartografía pública para municipios, así que toma el lenguaje de las cartas del Instituto Geográfico Militar: papel blanco, tinta negra, azul de hidrografía, y colores temáticos que salen del propio mapa de datos. Nada decorativo que no sea dato.

## Color (por rol)
- Texto: `#16181a` (tinta). Texto secundario: `#55595e` (contraste 7:1 sobre blanco).
- Superficie: `#ffffff`. Líneas y filetes: `#d9dbdd`.
- Enlaces y foco: `#1f4e8c`, azul de hidrografía de las cartas IGM. Es el único color de interfaz.
- Datos, idénticos a la leyenda del mapa: zona poblada `#cc211c`, plantación a menos de 500 m `#ed8c1a`, otra plantación `#9e8040`, vegetación natural `#c7dec2` (barras: `#3f7d4a`), agricultura `#b08ab5`.
- Excluido: verde "ambiental" como acento de marca, porque no sale del dato y es el cliché de la categoría.

## Tipografía
- IBM Plex Sans en todo (400, 500, 600), con cifras tabulares. Familia hecha para documentación técnica, con números muy legibles y licencia OFL.
- Excluido: serif en títulos con sans en el cuerpo. La jerarquía va por tamaño y peso dentro de una sola familia.

## Forma
- Radio de 2 px en controles y figuras. Las cartas tienen esquinas rectas.
- Sin tarjetas de métricas: las cifras van en tablas o dentro de la frase que las explica.
- Sin sombras, sin degradados, sin animaciones.

## Copy
- Frases completas con el dato y su fuente. Sin dos puntos de revelación ni "no es X, es Y".
