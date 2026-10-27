---
name: universe-qa
description: >
  Control de calidad integral de un universo: valida estructura y texto (lint-content), guía de
  tensiones (check-tensions), contraste (check-contrast), continuidad con el canon, cobertura del
  plan y propiedad intelectual; produce qa-report.md con hallazgos accionables y cierra la fase.
  Usar antes de publicar o tras cambios: "revisá el universo X", "corré el QA", "¿está listo para publicar?".
argument-hint: "<slug> [--fix-safe] [--strict]"
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

# Universe QA

Combina **comprobaciones automáticas** (scripts) y **revisión editorial** (agentes). Nada se publica con errores abiertos.

## 1. Automáticas (siempre primero)

```bash
node .devin/skills/universe-qa/scripts/lint-content.mjs <slug> --json
node .devin/skills/universe-qa/scripts/check-tensions.mjs <slug> --json
node .devin/skills/design-universe-aesthetics/scripts/check-contrast.mjs <slug> --json
node .devin/skills/create-universe/scripts/status.mjs <slug> --json
```

Referencia de códigos:

| Código | Qué indica | Responsable de corregir |
| --- | --- | --- |
| `E-ID-*`, `E-GAME-MISMATCH`, `E-OPTIONS-COUNT`, `E-MULTI-BALANCE`, `E-DIFFICULTY`, `E-CARD-*` | Integridad del modelo | `card-writer` / `systems-designer` |
| `E-TEXT-EMPTY`, `W-TEXT-LONG`, `W-DOUBLE-SPACE`, `W-KEY-LEAK`, `E-PLACEHOLDER` | Texto | `card-writer` |
| `E-BLOCKED-TERM` | PI / límites de contenido | quien lo escribió; **bloquea publicación** |
| `W-LOCALE-MISSING` | Traducción incompleta | `localizer` |
| `E-PARAM-UNKNOWN`, `E-TIER-CAP`, `E-PARAMS-CAP` | Efectos fuera de modelo o de presupuesto | `card-writer` |
| `E-FREE-LUNCH`, `E-TRADEOFF`, `W-PUNISHING`, `W-DOMINATED`, `W-DUP-OPTIONS` | Calidad del dilema | `card-writer` |
| `E-BALANCE-*`, `W-BALANCE-UNGATED` | Opción de equilibrio | `card-writer` / `tension-designer` |
| `E-THREAT-UNKNOWN`, `W-THREAT-UNUSED` | Amenazas ↔ escudos | `systems-designer` |
| `W-BIAS`, `W-PAIR-COVERAGE`, `W-PURE-RATIO`, `W-QUOTA-*` | Balance global | `balance-auditor` (propone ajustes) |
| `SPEC-*` | Spec incoherente | `tension-designer` |

## 2. Revisión editorial (en paralelo)

- `continuity-editor`: canon (§9), glosario, voces de personajes, cronología, hechos reales vs. invenciones, duplicados temáticos entre cartas, cadenas `enqueue_card`/`card_seen` válidas, términos protegidos que escapan al filtro (descripciones demasiado cercanas a una obra concreta).
- `balance-auditor`: sesgo global por parámetro, pares sin cobertura, picos de dificultad, parámetros que nunca llegan a umbrales, cartas "tirano", simulación orientativa de una partida "sin pensar" (*tiempo de llegada ≈ (distancia/σ)²*; contrastar con la duración objetivo) y propuestas de ajuste.

Ambos escriben solo su sección del informe y devuelven hallazgos con **ubicación, gravedad, evidencia y arreglo propuesto**.

## 3. Informe `qa-report.md`

Estructura: veredicto (`APTO` / `APTO CON AVISOS` / `NO APTO`) · resumen cuantitativo (cartas, distribución, cobertura) · errores (lista) · avisos agrupados · hallazgos editoriales · balance (tabla de sesgos) · acciones recomendadas priorizadas · historial de corridas.

## 4. Arreglos

- Sin `--fix-safe`: solo informas.
- Con `--fix-safe`: aplica únicamente correcciones **mecánicas y sin cambio de significado** (espacios dobles, `order` de opciones, `whenUnavailable` faltante, ids mal formados con renumeración consistente). Cualquier cambio de texto, números o estructura narrativa vuelve al agente responsable.
- Máximo 3 ciclos informe → arreglo → verificación; si persisten errores, marca `qa` como `blocked` con la lista y para.

## 5. Cierre

`NO APTO` si hay cualquier error, `E-BLOCKED-TERM` o contenido sin revisar. Con veredicto `APTO`/`APTO CON AVISOS`: `set-phase.mjs <slug> qa done "<veredicto>"` y `status.mjs --write`. Los avisos aceptados se registran en el informe con motivo.

## Nota de plataforma
Estos scripts son hoy la verificación de referencia. Cuando el módulo `lab/universes` tenga su propio validador con el motor, debe iterar `apps/web/src/lab/universes/content/*/` y ejecutarse por carpeta (un universo roto no debe bloquear el build del sitio: validar solo los `published` en la build, y todos en CI/QA).
