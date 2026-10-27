/** Estado de la partida según la ruta: `live` en /jugar, `ended` en /final. */
export type SessionStatus = "live" | "ended";

export function statusForPath(pathname: string): SessionStatus | null {
  if (pathname.endsWith("/jugar") || pathname.endsWith("/jugar/")) return "live";
  if (pathname.endsWith("/final") || pathname.endsWith("/final/")) return "ended";
  return null;
}
