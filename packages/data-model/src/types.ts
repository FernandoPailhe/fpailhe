/**
 * Modelo de datos del proyecto.
 *
 * Estas interfaces son el contrato entre los JSON que hoy viven en
 * `apps/web/public/data/*.json` y el resto de la app. El día que haya un
 * servidor real, el contrato no cambia: solo cambia de dónde lo trae
 * `services/httpClient` (ver `apps/web/src/services`).
 *
 * TEMPLATE: Reemplazá estos tipos de ejemplo con los de tu dominio.
 */

/** Ejemplo: una entidad del dominio. */
export interface Item {
  id: string;
  /** Nombre a mostrar. */
  name: string;
  /** Descripción breve. */
  description: string;
}

/** Ejemplo: metadata global del proyecto/app. */
export interface AppMeta {
  title: string;
  version: string;
}
