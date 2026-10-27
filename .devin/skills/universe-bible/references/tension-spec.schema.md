# `tension-spec.json` — esquema y semántica

Archivo: `doc/universes/<slug>/tension-spec.json`. Lo consumen `check-tensions.mjs` y `lint-content.mjs`, y lo leen `tension-designer`, `card-writer` y `balance-auditor`. Es la versión **ejecutable** del §5 de la biblia: si difieren, se corrige la biblia o la spec **en la misma versión** (nunca quedan desalineadas).

Punto de partida: `tension-spec.example.json` (borrar los campos `_help`, reemplazar las claves `param_N`).

## Campos

| Campo | Tipo | Significado |
| --- | --- | --- |
| `version` | number | Versión de la spec (sube con la biblia) |
| `slug` | string | Slug del universo |
| `parameters[]` | `{key, weight, expectedBias}` | `key` = `key` en `parameters.json`. `weight` (>0) pondera el parámetro en el efecto neto. `expectedBias` = Δ medio esperado **por opción estándar** (negativo = el parámetro tiende a caer) |
| `tensionPairs[]` | `{a, b, intensity, note}` | Pares que deben chocar (claves de `parameters`). `intensity` 1–3. Una opción "ejercita" el par si mueve `a` y `b` en direcciones opuestas |
| `magnitude.tiers` | `{minor, medium, major, critical}` → `[min,max]` | Rango de \|delta\| por nivel. No deben solaparse |
| `difficultyRules[]` | `{difficulty, maxTier, maxParams, netMax}` | **Array**, una regla por dificultad 1–10. `maxTier`: nivel máximo de magnitud permitido; `maxParams`: máx. de parámetros que una opción puede tocar; `netMax`: tope del efecto neto ponderado (se avisa si el neto es muy negativo o si una opción gana más que el tope) |
| `options.requireTradeoff` | bool | Toda opción estándar debe ganar algo y perder algo (salvo cartas con `pureEffectTags`) |
| `options.pureEffectTags` | string[] | `themeTags` de cartas exentas del trade-off (recompensa, crisis…) |
| `options.maxPureRatio` | 0–1 | Proporción máxima de cartas "puras" |
| `options.balance` | `{maxAbsDelta, maxParams}` | Límites de la opción `kind: "balance"` |
| `bias.tolerance` | number | Desvío tolerado entre el Δ medio real y `expectedBias` |
| `coverage.pairMinOptions` | number | Mínimo de opciones que ejercitan cada par |
| `threatTags` | string[] | Amenazas válidas. Toda `threatTag` usada en opciones/umbrales debe estar acá |
| `quotas.total` | `{min}` | Mínimo de cartas del universo |
| `quotas.byStageOrder` | `{"1":{min}, …}` | Mínimo de cartas elegibles por etapa |
| `quotas.byOptionsCount` | `{"1":{maxRatio}, "2":{minRatio}, "3":{minRatio}}` | Proporción de cartas con 1, 2 y 3 opciones |
| `content` | `{requiredLocales, strictLocales, maxCardChars, maxLabelChars, maxOutcomeChars, blockedTerms}` | Reglas de texto. `strictLocales: true` convierte los avisos de traducción faltante en errores |

## Lineamientos al rellenar

- **Pesos:** 1 por defecto; 1.5–2 para parámetros "vida" (su caída termina la partida); 0.5 para accesorios.
- **Sesgos:** la suma de `expectedBias` debería ser levemente negativa (el mundo presiona): -0.05 a -0.2 en parámetros de presión, ≈ 0 en los de recuperación. Con `tolerance` 1.0 el chequeo es laxo; bájalo (0.5) cuando el universo madure.
- **Magnitudes:** base `minor [3,6] · medium [7,12] · major [13,20] · critical [21,30]` para parámetros 0–100; escalar si el rango es otro.
- **Dificultad:** crece suave (ver catálogo). `netMax` limita lo que *gana* una opción; el castigo desmedido se avisa aparte.
- **Cuotas:** son mínimos y proporciones, no totales exactos; el reparto exacto vive en `content-plan.json`.
- **Pares:** ≥ 2 pares con intensidad ≥ 2; cada parámetro debería estar en ≥ 1 par.

## Códigos de la validación estructural (`--spec-only`)

`SPEC-NO-RULES` · `SPEC-TIER-UNKNOWN` · `SPEC-TIER-OVERLAP` · `SPEC-DIFFICULTY-GAP` (falta una dificultad 1–10) · `SPEC-PAIR-UNKNOWN` · `SPEC-PARAM-NO-PAIR` (aviso) · `SPEC-PLACEHOLDER` (quedan `param_N`) · `SPEC-QUOTA-RATIO`. Con `parameters.json` presente: `SPEC-PARAM-MISSING` y `SPEC-PARAM-ORPHAN`.
