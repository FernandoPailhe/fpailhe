import { uiCopy } from "../lib/copy";

/** Pantalla de carga: texto con `role="status"`, sin animación obligatoria. */
export function LoadingScreen() {
  return (
    <p className="uv-loading uv-text-dim" role="status">
      {uiCopy.loading.text}
    </p>
  );
}
