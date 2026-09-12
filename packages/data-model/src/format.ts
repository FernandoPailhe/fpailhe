/**
 * Funciones de formateo puras.
 *
 * TEMPLATE: Agregá acá los formatters de tu dominio (fechas, moneda,
 * cantidades, etc.). Deben ser funciones puras, sin dependencias de React.
 */

const MESES = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
] as const;

/** Formatea una fecha ISO (YYYY-MM-DD) en formato largo en español, ej. "1 de septiembre de 2026". */
export function fmtFechaLarga(iso: string): string {
  const [year, month, day] = iso.split("-").map(Number);
  const mes = MESES[(month ?? 1) - 1] ?? MESES[0];
  return `${day} de ${mes} de ${year}`;
}
