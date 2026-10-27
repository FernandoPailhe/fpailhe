---
name: design-tension-system
description: >
  Diseña el sistema de tensiones de un universo: papel y peso de cada parámetro, matriz de pares
  en conflicto, escala de magnitudes, presupuesto por dificultad, arquetipos de dilema, economía
  de escudos/poderes/recuperación, opción de equilibrio y cuotas. Produce la sección 5 de la biblia
  y tension-spec.json. Usar al definir o recalibrar cómo chocan parámetros y resultados:
  "diseñá las tensiones del universo X", "está muy fácil/difícil", "recalibrá la dificultad".
argument-hint: "<slug> [--recalibrate]"
triggers:
  - user
  - model
allowed-tools:
  - read
  - edit
  - grep
  - glob
  - exec
---

# Design Tension System

Convierte el tema moral en **fricción medible**. Lee `references/tension-catalog.md` (arquetipos y patrones), `../universe-bible/references/tension-spec.schema.md` y el brief.

## Principio

Una buena carta no tiene respuesta correcta: cada opción **protege un valor y sacrifica otro**. El sistema de tensiones garantiza que eso se cumpla de forma sistemática y que la dificultad crezca de manera legible.

## Procedimiento

1. **Papel de cada parámetro.** Para cada uno: qué valor representa, qué lo sube/baja en el mundo, qué ocurre en 0 y en el máximo, peso y `expectedBias` (con justificación narrativa). Los parámetros deben nacer del tema moral, no ser genéricos.
2. **Matriz de tensión.** Tabla n×n con intensidad 0–3 por par. Reglas: ≥ 2 pares de intensidad 3; ningún parámetro huérfano; evitar pares triviales (A y B siempre suben juntos).
3. **Arquetipos de dilema (§5.5).** Elegir 6–10 del catálogo y adaptarlos al tema: cada uno con par de parámetros, situación-tipo, qué gana/pierde cada opción y qué detecta un jugador atento. Cada par de intensidad ≥ 2 necesita ≥ 2 arquetipos.
4. **Escala de magnitudes (§5.3).** Fijar rangos por nivel acordes al rango de los parámetros. Describir cuándo usar cada nivel (menor = fricción cotidiana; mayor = decisión de peso; crítico = crisis y puntos de no retorno).
5. **Presupuesto por dificultad (§5.4).** Tabla 1–10: nivel máximo, parámetros tocados, efecto neto máximo. Crecimiento suave; la dificultad sube por **más presión y menos margen**, no solo por números más grandes.
6. **Presión, amenaza y recuperación (§5.6).** Definir: qué eventos drenan, cómo se avisa (umbrales intermedios), qué escudos neutralizan qué `threatTags`, cuánto cuesta ganar un escudo, y cómo se recupera un parámetro (cartas de respiro, poderes). La economía debe permitir recuperarse **si el jugador anticipó**.
7. **Opción de equilibrio (§5.7).** Cuándo aparece (`kind: balance`), cómo se desbloquea (`unlockTag` ← poder/insignia), límites (`balance.maxAbsDelta`, `maxParams`) y por qué nunca debe dominar.
8. **Distribución objetivo (§5.8).** Cuotas por etapa y por cantidad de opciones, mezcla de arquetipos y de niveles de magnitud.
9. **Checklist de prueba de dilema (§5.9)** y **anti-patrones (§5.10)** — copiar del catálogo y adaptar.
10. **Escribir `tension-spec.json`** consistente con el §5. Ejecutar `node .devin/skills/universe-qa/scripts/check-tensions.mjs <slug> --spec-only`.
11. **Simulación de cordura (opcional y recomendada).** Con la fórmula orientativa *tiempo de llegada ≈ (distancia/σ)²*, estimar en cuántas cartas un parámetro llega al extremo con decisiones neutras; ajustar `expectedBias`/magnitudes para que una partida "sin pensar" termine entre el 40 % y el 70 % de la duración objetivo. Es una guía, no una promesa: se valida con la simulación del motor.

## `--recalibrate`

Con contenido ya escrito: ejecutar `check-tensions.mjs <slug> --json`, leer W-BIAS, W-PURE-RATIO, W-PAIR-COVERAGE y W-QUOTA-*; proponer ajustes a la spec **o** a cartas concretas (nunca ambos sin decirlo). Todo cambio de spec es una versión nueva de la biblia (§12) y reabre `cards`/`qa` si cambia umbrales.

## Entrega

- Sección 5 completa en `universe-bible.md` (si es draft) o propuesta de cambio (si aprobada).
- `tension-spec.json` validada.
- Lista corta de **riesgos de diseño** (pares débiles, parámetro dominante, picos de dificultad).
- Preguntas para el usuario si algo del tema moral queda ambiguo (p. ej. "¿perder X debe ser irreversible?").
