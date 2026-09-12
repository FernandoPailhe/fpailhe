export interface ErrorStateProps {
  label?: string;
}

export function ErrorState({ label = "No se pudieron cargar los datos." }: ErrorStateProps) {
  return (
    <div className="rounded-lg border border-crimson bg-surface px-6 py-10 text-center font-mono text-sm text-crimson-bright">
      {label}
    </div>
  );
}
