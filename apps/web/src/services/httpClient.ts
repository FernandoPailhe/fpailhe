import axios from "axios";

/**
 * Cliente HTTP único de la app. Hoy `VITE_API_BASE_URL` apunta a
 * `/data` (los JSON estáticos en `public/data`); el día que haya un
 * servidor real, alcanza con cambiar esa variable de entorno (y las
 * rutas en `dataService.ts`) — nada más en la app depende de esto.
 */
export const http = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL ?? "/data",
});
