/**
 * Funciones de formateo puras.
 *
 * Las fechas del modelo son strings "YYYY-MM" (o `null` para "Present").
 * Estos helpers son la única forma de formatearlas — los componentes
 * nunca formatean fechas a mano, para que la web y el PDF no diverjan.
 */

import type { ProjectLink } from "./types";

const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
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

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const URL_RE = /^https?:\/\/\S+$/i;
const WWW_RE = /^www\.\S+$/i;
const DOMAIN_RE = /^[a-z0-9-]+(\.[a-z0-9-]+)*\.[a-z]{2,}(\/\S*)?$/i;

/**
 * Detecta si un string de los JSON es linkeable y devuelve el `href`
 * normalizado, o `null` si es texto plano.
 *
 * Cubre: URLs absolutas ("https://..."), "www.algo.com", dominios pelados
 * ("fpailhe.com" → "https://fpailhe.com") y emails ("a@b.com" → "mailto:...").
 * Así cualquier campo JSON que contenga un vínculo se vuelve hipervínculo
 * sin markup extra (ver `AutoLink` en apps/web).
 */
export function toHref(value: string): string | null {
  const v = value.trim();
  if (URL_RE.test(v)) return v;
  if (WWW_RE.test(v)) return `https://${v}`;
  if (EMAIL_RE.test(v)) return `mailto:${v}`;
  if (DOMAIN_RE.test(v)) return `https://${v}`;
  return null;
}

/** Label visible por tipo de link de proyecto. */
export function formatProjectLinkLabel(type: ProjectLink["type"]): string {
  const labels: Record<ProjectLink["type"], string> = {
    appStore: "App Store",
    playStore: "Play Store",
    github: "GitHub",
    website: "Website",
    youtube: "YouTube",
  };
  return labels[type];
}
