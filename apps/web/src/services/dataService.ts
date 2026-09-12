import type { Item, AppMeta } from "@ferpa/data-model";
import { http } from "./httpClient";

/**
 * TEMPLATE: Capa de servicios. Acá van las llamadas a APIs o archivos
 * estáticos. El día que haya un backend real, solo cambiás estos
 * fetchers — el resto de la app (queries, domain, components) no se
 * entera.
 */

export async function fetchItems(): Promise<Item[]> {
  const { data } = await http.get<Item[]>("/items.json");
  return data;
}

export async function fetchAppMeta(): Promise<AppMeta> {
  const { data } = await http.get<AppMeta>("/meta.json");
  return data;
}
