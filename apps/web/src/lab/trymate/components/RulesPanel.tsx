import { PIECE_LABEL } from "../lib/gameDisplay";
import { MOVE_DIAGRAMS, RULES_CONTENT, RULES_LANGUAGES } from "../lib/rulesContent";
import { useUiPrefsStore } from "../application/uiPrefs";
import { MoveDiagram } from "./MoveDiagram";

/** Panel de reglas y ayuda, bilingüe ES/EN, con ejemplos de movimiento. */
export function RulesPanel() {
  const rulesLang = useUiPrefsStore((s) => s.rulesLang);
  const setRulesLang = useUiPrefsStore((s) => s.setRulesLang);
  const rules = RULES_CONTENT[rulesLang];

  return (
    <section
      aria-label={rules.title}
      className="w-full max-w-4xl rounded-2xl border border-line bg-canvas p-6 text-left"
    >
      <div className="mb-4 flex items-center justify-between">
        <h2 className="font-display text-xl text-ink">{rules.title}</h2>
        <div className="flex gap-1" role="group" aria-label="Language">
          {RULES_LANGUAGES.map((l) => (
            <button
              key={l.id}
              type="button"
              onClick={() => setRulesLang(l.id)}
              className={`rounded-md px-3 py-1 font-ui text-xs ${
                rulesLang === l.id ? "bg-gold text-canvas" : "bg-surface text-ink-dim"
              }`}
            >
              {l.label}
            </button>
          ))}
        </div>
      </div>

      <p className="mb-2 font-ui text-sm text-ink">{rules.objective}</p>
      <p className="mb-6 font-ui text-sm text-ink-dim">{rules.board}</p>

      <ol className="mb-6 grid gap-3 sm:grid-cols-2">
        {rules.flow.map((section) => (
          <li key={section.title} className="rounded-lg bg-surface p-3">
            <h3 className="font-display text-sm text-gold">{section.title}</h3>
            <p className="font-ui text-xs text-ink-dim">{section.body}</p>
          </li>
        ))}
      </ol>

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        {rules.pieces.map((piece) => (
          <article key={piece.type} className="rounded-lg bg-surface p-3">
            <h3 className="mb-2 font-display text-sm text-ink">{PIECE_LABEL[piece.type]}</h3>
            <MoveDiagram
              spec={MOVE_DIAGRAMS[piece.type]}
              pieceType={piece.type}
              legend={rules.diagramLegend}
            />
            <dl className="mt-3 space-y-1.5 font-ui text-xs">
              <div>
                <dt className="inline font-semibold text-gold">{rules.labels.move}: </dt>
                <dd className="inline text-ink-dim">{piece.move}</dd>
              </div>
              <div>
                <dt className="inline font-semibold text-gold">{rules.labels.capture}: </dt>
                <dd className="inline text-ink-dim">{piece.capture}</dd>
              </div>
              <div>
                <dt className="inline font-semibold text-gold">{rules.labels.special}: </dt>
                <dd className="inline text-ink-dim">{piece.special}</dd>
              </div>
            </dl>
          </article>
        ))}
      </div>

      <p className="font-ui text-xs text-ink-dim">{rules.online}</p>
    </section>
  );
}
