import { Link } from "react-router-dom";

export function NotFoundPage() {
  return (
    <section className="mx-auto max-w-3xl px-4 py-20 text-center">
      <h1 className="mb-4 font-display text-4xl font-bold text-ink">404</h1>
      <p className="mb-6 text-ink-dim">La página que buscás no existe.</p>
      <Link to="/" className="font-ui text-sm font-semibold text-gold-bright hover:underline">
        Volver al inicio
      </Link>
    </section>
  );
}
