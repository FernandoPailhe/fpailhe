import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import type { CardFeedback, GameSession, ID } from "../domain/models";
import { localize, resolveLocale } from "../domain/engine/localize";
import type { EngineContext } from "../domain/engine/types";
import { getUniverseRepositories } from "../infrastructure/repositories";
import { derivePhase } from "./derivePhase";
import { createRuntimeEngineContext } from "./engineContext";
import { universeKeys } from "./keys";
import { selectSlot, useSessionStore } from "./store/sessionStore";
import {
  abandonTransition,
  chooseTransition,
  nextTransition,
  startNewGameTransition,
} from "./transitions";
import type { NarrativeGame } from "./types";
import { useCurrentUser } from "./useCurrentUser";
import { useNarrativeContent } from "./useNarrativeContent";
import { useSavedSessionQuery } from "./useSavedSessionQuery";
import { useUniverseTheme } from "./useUniverseTheme";
import {
  buildCardView,
  buildEndView,
  buildIconViews,
  buildOutcomeView,
  buildParameterViews,
  buildPowerViews,
  buildStageView,
} from "./viewModels";

function navigatorLanguages(): string[] {
  try {
    if (typeof navigator !== "undefined") {
      if (navigator.languages?.length) return [...navigator.languages];
      if (navigator.language) return [navigator.language];
    }
  } catch {
    /* sin navigator */
  }
  return [];
}

/** Orquesta una partida completa de un universo: el único punto de entrada de la UI. */
export function useNarrativeGame(
  slug: string,
  options?: { autoStartTurn?: boolean },
): NarrativeGame {
  const queryClient = useQueryClient();
  const { content, isLoading, error, notFound } = useNarrativeContent(slug);
  const { userId } = useCurrentUser();
  const slot = useSessionStore(selectSlot(slug));
  const hydrate = useSessionStore((s) => s.hydrate);
  const setSession = useSessionStore((s) => s.setSession);
  const setResolution = useSessionStore((s) => s.setResolution);
  const saved = useSavedSessionQuery(userId, content?.game.id ?? "", {
    enabled: !!content,
  });

  const [engineError, setEngineError] = useState<Error | null>(null);
  const ecRef = useRef<EngineContext | null>(null);
  if (!ecRef.current) ecRef.current = createRuntimeEngineContext();
  const ec = ecRef.current;
  const shownAtRef = useRef<{ iso: string; ms: number } | null>(null);
  const autoStartRef = useRef<ID | null>(null);

  const session = slot.session;

  // Hidrata el store una sola vez con la partida guardada.
  useEffect(() => {
    if (!content || saved.isPending || slot.hydrated) return;
    hydrate(slug, saved.data ?? null);
  }, [content, saved.isPending, saved.data, slot.hydrated, hydrate, slug]);

  const resolvedLocale = useMemo(
    () =>
      session?.locale ??
      (content ? resolveLocale(content.game, navigatorLanguages()) : "es"),
    [session?.locale, content],
  );

  // Marca cuándo se mostró la carta actual (para responseTimeMs).
  useEffect(() => {
    if (session?.currentCardId) {
      shownAtRef.current = { iso: new Date().toISOString(), ms: Date.now() };
    }
  }, [session?.currentCardId]);

  const contentStatus = useMemo(
    () =>
      error || engineError
        ? ("error" as const)
        : isLoading || !content || saved.isPending
          ? ("loading" as const)
          : ("success" as const),
    [error, engineError, isLoading, content, saved.isPending],
  );

  const phase = derivePhase({
    contentStatus,
    hydrated: slot.hydrated,
    session,
    lastResolution: slot.lastResolution,
    hasCurrentCard: !!session?.currentCardId,
  });

  const persist = useCallback((s: GameSession) => {
    void getUniverseRepositories()
      .sessions.save(s)
      .catch(() => {});
  }, []);

  // autoStartTurn: partida activa sin carta ⇒ beginTurn automático (una vez por sesión).
  useEffect(() => {
    if (!options?.autoStartTurn || !content || !session || phase !== "between") return;
    if (autoStartRef.current === session.id) return;
    autoStartRef.current = session.id;
    try {
      const { session: next } = nextTransition(content, session, ec);
      setSession(slug, next);
      persist(next);
    } catch (e) {
      setEngineError(e as Error);
    }
  }, [options?.autoStartTurn, content, session, phase, slug, ec, setSession, persist]);

  const startNewGame = useCallback(() => {
    if (!content) return;
    try {
      const { session: s } = startNewGameTransition(
        content,
        { userId, locale: resolvedLocale },
        ec,
      );
      autoStartRef.current = s.id;
      setResolution(slug, null);
      setSession(slug, s);
      persist(s);
      setEngineError(null);
    } catch (e) {
      setEngineError(e as Error);
    }
  }, [content, userId, resolvedLocale, ec, slug, setResolution, setSession, persist]);

  const choose = useCallback(
    (optionId: ID) => {
      if (!content || !session || phase !== "card") return;
      try {
        const shownAt = shownAtRef.current;
        const result = chooseTransition(
          content,
          session,
          {
            optionId,
            shownAt: shownAt?.iso ?? ec.now(),
            responseTimeMs: shownAt ? Date.now() - shownAt.ms : undefined,
          },
          ec,
        );
        setResolution(slug, result.resolution);
        setSession(slug, result.session);
        persist(result.session);
        void getUniverseRepositories()
          .feedback.recordImpression(result.impression)
          .catch(() => {});
      } catch (e) {
        setEngineError(e as Error);
      }
    },
    [content, session, phase, ec, slug, setResolution, setSession, persist],
  );

  const next = useCallback(() => {
    if (!content || !session || phase !== "outcome") return;
    setResolution(slug, null);
    if (session.status === "active") {
      try {
        const { session: s } = nextTransition(content, session, ec);
        setSession(slug, s);
        persist(s);
      } catch (e) {
        setEngineError(e as Error);
      }
    }
  }, [content, session, phase, slug, ec, setResolution, setSession, persist]);

  const abandon = useCallback(() => {
    if (!session || session.status !== "active") return;
    const s = abandonTransition(session, ec);
    setResolution(slug, null);
    setSession(slug, s);
    persist(s);
  }, [session, ec, slug, setResolution, setSession, persist]);

  const sendFeedback = useCallback(
    (_value: CardFeedback["value"], _reason?: CardFeedback["reason"]) => {
      /* no-op: feedbackEnabled = false en este plan */
    },
    [],
  );

  const retry = useCallback(() => {
    setEngineError(null);
    void queryClient.invalidateQueries({ queryKey: universeKeys.content(slug) });
    void queryClient.invalidateQueries({ queryKey: universeKeys.list() });
  }, [queryClient, slug]);

  const { theme } = useUniverseTheme(slug);

  const parameters = useMemo(
    () =>
      content && session
        ? buildParameterViews(content, session, slot.lastResolution?.parametersBefore)
        : [],
    [content, session, slot.lastResolution],
  );
  const powers = useMemo(
    () => (content && session ? buildPowerViews(content, session, resolvedLocale) : []),
    [content, session, resolvedLocale],
  );
  const stage = useMemo(
    () => (content && session ? buildStageView(content, session, resolvedLocale) : undefined),
    [content, session, resolvedLocale],
  );
  const icons = useMemo(
    () => (content ? buildIconViews(content, resolvedLocale) : {}),
    [content, resolvedLocale],
  );
  const card = useMemo(() => {
    if (phase !== "card" || !content || !session?.currentCardId) return undefined;
    const c = content.cards.find((x) => x.id === session.currentCardId);
    return c ? buildCardView(c, content, session, resolvedLocale) : undefined;
  }, [phase, content, session, resolvedLocale]);

  const outcome = useMemo(() => {
    const r = slot.lastResolution;
    if (phase !== "outcome" || !content || !session || !r) return undefined;
    const c = content.cards.find((x) => x.id === r.cardId);
    return c ? buildOutcomeView(c, r.optionId, r.events, session, content, resolvedLocale) : undefined;
  }, [phase, content, session, slot.lastResolution, resolvedLocale]);

  const end = useMemo(
    () =>
      phase === "ended" && content && session
        ? buildEndView(content, session, resolvedLocale)
        : undefined,
    [phase, content, session, resolvedLocale],
  );

  return {
    slug,
    phase,
    notFound,
    title: content ? localize(content.game.title, resolvedLocale) : "",
    description: content ? localize(content.game.description, resolvedLocale) : "",
    locale: resolvedLocale,
    theme,
    icons,
    hasSavedSession: session?.status === "active",
    stage,
    turn: session?.turn ?? 0,
    score: session?.score ?? 0,
    parameters,
    powers,
    card,
    outcome,
    end,
    feedbackEnabled: false,
    feedbackSent: slot.lastResolution?.feedbackSent ?? false,
    startNewGame,
    choose,
    next,
    abandon,
    sendFeedback,
    retry,
  };
}
