export interface LevelDotsProps {
  /** Nivel alcanzado, 0..total. */
  level: number;
  /** Cantidad de segmentos; default 5. */
  total?: number;
}

/**
 * Indicador de nivel como barras finas (ej. idiomas del CV). Los segmentos
 * `i < level` van en `bg-ink`, el resto en `bg-line`.
 */
export function LevelDots({ level, total = 5 }: LevelDotsProps) {
  return (
    <span role="img" aria-label={`${level}/${total}`} className="inline-flex gap-1">
      {Array.from({ length: total }, (_, i) => (
        <span
          key={i}
          className={`h-[3px] w-6 ${i < level ? "bg-ink" : "bg-line"}`}
        />
      ))}
    </span>
  );
}
