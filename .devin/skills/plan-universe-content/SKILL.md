---
name: plan-universe-content
description: >
  Divide el contenido de un universo en rebanadas (slices) autónomas de cartas para generar en
  paralelo y sin solaparse: etapa, rama, personaje, dificultad, cantidad, rango de numeración,
  mezcla de opciones, pares de tensión y arquetipos. Produce content-plan.json y un resumen.
  Usar tras definir entidades: "planificá las cartas del universo X", "repartí el contenido en lotes".
argument-hint: "<slug> [--total=N] [--slice-size=N]"
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

# Plan Universe Content

El plan convierte las cuotas de la spec en **trabajo repartible**. Cada slice es una unidad que un agente `card-writer` puede producir de punta a punta sin coordinarse con otros. Plantilla: `references/content-plan.template.json`.

## Reglas

1. **Totales:** la suma de `count` de todas las slices ≥ `quotas.total.min` (apuntar al valor decidido en la biblia §10); por etapa ≥ `byStageOrder[n].min`; la mezcla agregada de `optionsMix` cumple las proporciones de `byOptionsCount`.
2. **Sin solapes de numeración:** cada slice ocupa `startIndex … startIndex+count-1` (los archivos serán `cards/NNN-slug.json`). Rangos contiguos o con huecos explícitos, nunca superpuestos.
3. **Tamaño:** 8–15 cartas por slice (menos para cartas complejas con ramas/`enqueue_card`). Más pequeño = mejor calidad y paralelismo.
4. **Cobertura:** cada par de tensión de intensidad ≥ 2 aparece en ≥ `coverage.pairMinOptions` opciones sumando las slices; cada personaje en ≥ 3 cartas; cada amenaza, en ≥ 2 cartas; cada poder, usado o desbloqueado en alguna.
5. **Dificultad:** cada slice declara `difficulty [min,max]` dentro del rango de su etapa; la curva global sube sin saltos mayores a 2.
6. **Dependencias:** cartas que encadenan (`enqueue_card`, `card_seen`) se agrupan en la **misma slice** o se declaran en `notes` con las ids exactas de las cartas enlazadas.
7. **Variedad:** mezclar arquetipos (§5.5) y temas; ninguna slice usa un único arquetipo salvo que sea una cadena intencional.
8. **Recurrencia:** cartas que pueden repetirse (`recurrence`) son pocas y justificadas.

## Procedimiento

1. Lee biblia §4, §5.8, §10 y `tension-spec.json`.
2. Calcula slices por etapa y rama. Asigna personajes, pares, arquetipos y temas (`themes`, tomados de `research/dilemma-seeds.md` por id).
3. Escribe `content-plan.json`. Genera un cuadro resumen en la biblia §10.
4. **Autocontrol numérico (por script, no a ojo):**
   `node -e` o un chequeo corto que sume `count`, verifique solapes y compare con las cuotas. Corrige hasta que cuadre.
5. Presenta al usuario un resumen (nº de slices, cartas por etapa/rama, personajes más usados) y la **estimación de esfuerzo** (slices × agentes en paralelo). Aprobar o ajustar.
6. `set-phase.mjs <slug> plan done`.

## Formato de slice (resumen)
`id` (`s01-…`), `label`, `stageOrder`, `branch`, `character`, `difficulty`, `count`, `startIndex`, `recurrence`, `optionsMix` (`{"1":n,"2":n,"3":n}`), `tensionPairs`, `archetypes`, `themes`, `notes`.
