/**
 * Funciones de formateo puras.
 *
 * Las fechas del modelo son strings "YYYY-MM" (o `null` para "Present").
 * Estos helpers son la única forma de formatearlas — los componentes
 * nunca formatean fechas a mano, para que la web y el PDF no diverjan.
 */

const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
] as const;

/** Formatea "2025-08" → "Aug 2025". */
export function formatMonthYear(date: string): string {
  const [year, month] = date.split("-");
  const monthIndex = parseInt(month ?? "1", 10) - 1;
  const monthName = MONTHS[monthIndex] ?? month;
  return `${monthName} ${year}`;
}

/** Formatea un rango: ("2025-08", null) → "Aug 2025 — Present". */
export function formatDateRange(start: string, end: string | null): string {
  const endText = end === null ? "Present" : formatMonthYear(end);
  return `${formatMonthYear(start)} — ${endText}`;
}
