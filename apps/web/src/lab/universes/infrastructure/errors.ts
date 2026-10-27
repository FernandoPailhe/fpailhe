/** El slug pedido no existe (o no está publicado en producción). */
export class UnknownUniverseError extends Error {
  readonly slug: string;
  constructor(slug: string) {
    super(`Universo desconocido: ${slug}`);
    this.name = "UnknownUniverseError";
    this.slug = slug;
  }
}

/** El recurso existe pero no está disponible en este entorno. */
export class NotAvailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "NotAvailableError";
  }
}
