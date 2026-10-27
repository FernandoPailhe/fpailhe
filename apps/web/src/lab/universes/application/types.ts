import type { AestheticProfile, CardFeedback, ID, ThemeOverride } from "../domain/models";

export interface ParameterView {
  id: ID; key: string; name: string;      // name ya localizado
  iconId?: ID;
  value: number; min: number; max: number; ratio: number;   // ratio = (value-min)/(max-min), 0..1
  delta: number | null;                   // cambio del último turno resuelto; null si no hubo
  risk: "low" | "high" | null;            // de getThresholdRisk
}
export interface PowerView { id: ID; name: string; kind: "shield" | "option_unlock" | "modifier" | "custom"; charges: number; maxCharges?: number; iconId?: ID }
export interface OptionView {
  id: ID; order: number; label: string; kind: "standard" | "balance";
  state: "available" | "locked"; lockedReason?: string;   // p. ej. "Requiere: Consejo sabio"
}
export interface SpeakerView { name: string; title?: string; portraitUrl?: string; portraitAlt?: string }
export interface MediaView { type: "image" | "video" | "animation"; url: string; posterUrl?: string; alt: string }
export interface CardView { id: ID; text: string; difficulty: number; media?: MediaView; speaker?: SpeakerView; options: OptionView[] }
export interface EventView { type: string; tone: "gain" | "loss" | "neutral"; text: string; parameterId?: ID; delta?: number }
export interface OutcomeView { chosenLabel: string; outcomeText?: string; events: EventView[]; ended: boolean; result?: "victory" | "defeat" }
export interface StageView { id: ID; order: number; name: string; total: number }
export interface EndView {
  result: "victory" | "defeat" | "abandoned"; title: string; text: string;
  turns: number; score: number; stageName: string;
  badges: { id: ID; name: string; iconId?: ID }[]; parameters: ParameterView[];
}
export interface IconView { svg?: string; label: string; semanticTags: string[] }   // label ya localizado
/** Estética lista para convertir en CSS (la conversión es del plan universes-ui). */
export interface ThemeInput { aesthetic?: AestheticProfile; activeOverrides: ThemeOverride[] }

export type NarrativePhase =
  | "loading" | "error"
  | "no_session"   // no hay partida guardada
  | "between"      // partida activa sin carta mostrada (solo se ve si NO se pidió `autoStartTurn`)
  | "card" | "outcome" | "ended";

export interface NarrativeGame {
  slug: string;
  phase: NarrativePhase;
  notFound: boolean;                        // phase === "error" porque el slug no existe o no está publicado
  title: string; description: string;       // del Game, localizados
  locale: string;                           // locale resuelto de la sesión (para <html lang> en la UI)
  theme: ThemeInput;
  icons: Record<ID, IconView>;              // iconId → ícono del universo (para parámetros, poderes e insignias)
  hasSavedSession: boolean;                 // hay partida activa guardada
  stage?: StageView; turn: number; score: number;
  parameters: ParameterView[];              // solo activos, en orden de `content.parameters`
  powers: PowerView[];
  card?: CardView;                          // phase === "card"
  outcome?: OutcomeView;                    // phase === "outcome"
  end?: EndView;                            // phase === "ended" (también tras abandonar)
  feedbackEnabled: boolean;                 // siempre false en este plan
  feedbackSent: boolean;
  startNewGame(): void;                     // reemplaza la guardada; deja phase "card"
  choose(optionId: ID): void;               // phase "card" → "outcome"
  next(): void;                             // "outcome" → "card" (o "ended" si terminó)
  abandon(): void;                          // marca 'abandoned' → "ended"
  sendFeedback(value: CardFeedback["value"], reason?: CardFeedback["reason"]): void; // no-op mientras feedbackEnabled=false
  retry(): void;                            // invalida las queries del universo (phase "error")
}
