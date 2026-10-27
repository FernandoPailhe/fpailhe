import { useUniverses } from "../application";
import { localize } from "../domain/engine/localize";
import { isDevOrTest } from "../infrastructure/registry";
import { uiCopy } from "../lib/copy";
import { titleFor, useDocumentTitle } from "../lib/seo";
import { LoadingScreen, UniverseListItem } from "../components";

export function UniversesIndexPage() {
  const { data, isLoading, error } = useUniverses();
  useDocumentTitle(titleFor("index"));

  const locale = typeof navigator !== "undefined" ? navigator.language : "es";

  if (isLoading) return <LoadingScreen />;
  if (error) return <p className="uv-text-dim" role="alert">{uiCopy.list.error}</p>;

  const universes = data ?? [];
  return (
    <section>
      <p className="uv-eyebrow">{uiCopy.list.subtitle}</p>
      <h1 className="uv-title">{uiCopy.list.title}</h1>
      {universes.length === 0 ? (
        <p className="uv-text-dim">{uiCopy.list.empty}</p>
      ) : (
        <ul className="uv-list">
          {universes.map((u) => (
            <UniverseListItem
              key={u.slug}
              title={localize(u.game.title, locale)}
              description={localize(u.game.description, locale)}
              to={`/lab/universes/${u.slug}`}
              tag={u.game.status !== "published" && isDevOrTest() ? uiCopy.list.draft : undefined}
            />
          ))}
        </ul>
      )}
    </section>
  );
}
