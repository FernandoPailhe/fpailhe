export interface LoadingStateProps {
  label?: string;
}

export function LoadingState({ label = "Cargando datos…" }: LoadingStateProps) {
  return (
    <div className="rounded-lg border border-line bg-surface px-6 py-10 text-center font-mono text-sm text-ink-dim">
      {label}
    </div>
  );
}
