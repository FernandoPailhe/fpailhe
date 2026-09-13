import { Link } from "react-router-dom";

export function NotFoundPage() {
  return (
    <section className="mx-auto max-w-3xl px-4 py-20 text-center">
      <h1 className="mb-4 font-display text-4xl font-bold text-ink">404</h1>
      <p className="mb-6 text-ink-dim">The page you are looking for does not exist.</p>
      <Link to="/" className="font-ui text-sm font-semibold text-gold-bright hover:underline">
        Back to home
      </Link>
    </section>
  );
}
