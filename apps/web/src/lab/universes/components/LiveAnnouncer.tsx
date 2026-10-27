/**
 * Región `aria-live` única por pantalla: anuncia el resumen del turno a
 * tecnologías de asistencia. Visualmente oculta.
 */
export function LiveAnnouncer({ message }: { message: string }) {
  return (
    <div className="uv-sr-only" role="status" aria-live="polite">
      {message}
    </div>
  );
}
