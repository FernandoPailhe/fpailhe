---
name: universe-bible
description: >
  Redacta, revisa y congela la biblia del universo (universe-bible.md): el documento global y
  definitivo que sirve de referencia para crear situaciones, ayudantes, poderes, estética y
  que fija la guía de gestión de tensiones entre parámetros y resultados. Genera también el
  tension-spec.json legible por máquina. Usar tras la investigación: "armá la biblia del universo X",
  "aprobá la biblia", "cambiá el canon de Y".
argument-hint: "<slug> [--revise] [--approve]"
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

# Universe Bible

La biblia es la **fuente de verdad**. Todo lo que se escriba después (parámetros, personajes, poderes, cartas, arte) debe poder justificarse con una línea de ella. Una vez aprobada, solo cambia mediante control de cambios (§12).

Lee antes: `references/universe-bible.template.md`, `references/tension-spec.example.json`, `references/tension-spec.schema.md`, y `brief.md` + `research/` del universo.

## Entradas / salidas

- Entradas: `brief.md` (aprobado), `inputs/*` (documentos del usuario; lo marcado `canon: true` se vuelca al §9 sin alterarlo), `research/*` (cerrado), `blocked-terms.txt`.
- Salidas: `universe-bible.md` (desde la plantilla), `tension-spec.json` (copia del ejemplo, adaptada), actualización de `blocked-terms.txt`.

## Procedimiento

1. **Armar el esqueleto** copiando la plantilla; rellenar frontmatter (slug, nombre, locales, `version: 0`, `status: draft`).
2. **Delegar por secciones** (en paralelo si hay agentes; máx. 4):
   - `lorekeeper` → §1 Esencia, §2 Mundo, §3 Actores, §6 Guía de escritura, §8 Glosario, §9 Registro de canon.
   - `tension-designer` → §4 Sistema (parámetros, umbrales, etapas, ramas, finales) y **§5 Gestión de tensiones** + `tension-spec.json`. Usa el skill `design-tension-system`.
   - `systems-designer` → poderes/insignias/amenazas dentro de §4.4–§4.6 (ver `design-universe-entities`).
   - `aesthetic-director` → §7 Resumen estético (el detalle va en `aesthetic-notes.md`).
   Si no hay agentes, redáctalas tú en ese orden.
3. **Integrar y reconciliar:** los nombres de parámetros/amenazas/personajes usados en §3–§5 deben coincidir exactamente con el §4; el glosario debe cubrir los términos de las cartas ejemplo; el canon (C-xx) no debe contradecirse.
4. **Reglas de oro de §5** (verificarlas al integrar):
   - Cada parámetro tiene un **papel narrativo** y un **sesgo esperado** (`expectedBias`) justificados por el tema moral.
   - Cada par en tensión tiene intensidad y **al menos 2 arquetipos de dilema** que lo ejercitan.
   - Escala de magnitudes y presupuesto de dificultad cubren 1–10 sin saltos.
   - Existen reglas para la **opción de equilibrio**, los **escudos** (amenazas ↔ poderes) y la **recuperación**.
   - La **distribución objetivo** (cuotas) suma el total planificado.
   - Incluye 5+ **cartas ejemplo** anotadas ("por qué funciona") y la lista de **anti-patrones**.
5. **Validar la especificación:** `node .devin/skills/universe-qa/scripts/check-tensions.mjs <slug> --spec-only` debe pasar sin errores SPEC-*.
6. **Presentar al usuario** un resumen de 1 página: esencia, tema moral, parámetros y pares, escala de dificultad, 3 dilemas ejemplo, estética, canon clave, y los puntos donde hubo que **decidir sin consultar**. Preguntar: aprobar / ajustar (qué sección).
7. **Aprobación:** con el OK, subir `version: 1`, `status: approved`, fecha; `set-phase.mjs <slug> bible done --bible-version=1`. A partir de aquí solo el orquestador modifica la biblia aprobada.

## Control de cambios (§12)

Cambio posterior = fila en §12 con versión nueva, qué cambia, por qué y **impacto** (qué contenido ya escrito queda afectado). Cambios que alteran parámetros, umbrales o la spec obligan a re-ejecutar `check-tensions` sobre las cartas existentes y a reabrir las fases afectadas con `set-phase.mjs`.

## Criterios de aceptación

- Ninguna sección con `<!-- TODO -->` o `TBD`.
- Todo parámetro de §4 aparece en `tension-spec.json` y viceversa.
- Un redactor ajeno puede escribir una carta válida sin preguntar nada (probar: pedirle a un agente `card-writer` una carta de prueba usando solo la biblia).
- Datos reales vs. invenciones están diferenciados en §2 y §9.
- Sin términos de `blocked-terms.txt`.
