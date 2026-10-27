---
name: localize-universe
description: >
  Traduce todo el contenido localizable de un universo (juego, etapas, ramas, parámetros,
  personajes, poderes, insignias, íconos, cartas y opciones) a los idiomas pedidos, respetando
  glosario, voz y límites de longitud. Rellena LocalizedText.translations[locale].
  Usar tras generar cartas: "traducí el universo X al inglés", "agregá portugués".
argument-hint: "<slug> --locales=en[,pt-BR,...] [--only=cards|entities]"
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

# Localize Universe

Cada `LocalizedText` es `{ default, translations?: { [locale]: string } }`. Traduces **adaptando**, no calcando: el objetivo es que una persona de ese idioma sienta la misma voz y entienda el mismo dilema.

## Antes de empezar
1. Confirma los idiomas (código BCP-47: `en`, `pt-BR`…). Si el usuario no los dio, usa `content.requiredLocales` de la spec o pregunta.
2. Lee de la biblia el §6 (voz), §8 (glosario, **con equivalentes por idioma**: si faltan para el idioma pedido, créalos primero y regístralos) y §6 sobre límites. Lee `blocked-terms.txt`.
3. Los textos fuente deben estar estables: la fase `cards` en `done`. Si hay cartas pendientes, avisa al orquestador (retraducir cuesta).

## Procedimiento
1. **Glosario por idioma.** Completa en la biblia §8 una columna por idioma (términos del mundo, nombres propios, títulos). Los nombres propios inventados **no se traducen** salvo que el glosario lo indique. Cambios en la biblia aprobada se registran en §12 como ajuste menor.
2. **Entidades** (`game, stages, branches, parameters, characters, powers, badges, icons`): traduce `title/name/description/title/label` en un solo pase por archivo.
3. **Cartas:** delega un `localizer` por idioma (o por tramo de cartas si son más de ~80) con rutas disjuntas. Cada carta: `text`, cada `label` y `outcomeText`.
4. **Reglas de traducción:**
   - Longitud ≤ 125 % del límite del idioma base (el lint avisa); preferir reformular a recortar sentido.
   - Mantener el **valor que protege cada opción**: la tensión no puede atenuarse ni exagerarse.
   - Registro y humor adaptados al idioma; sin calcos ni falsos amigos; sin notas del traductor dentro del texto.
   - Sin claves internas, ni números nuevos, ni términos bloqueados (también en el idioma meta: equivalentes de marcas/obras).
   - Género y concordancia coherentes con el personaje.
   - Variantes regionales: usar la del código pedido (`es-AR`, `pt-BR`) y mantenerla en todo el universo.
5. **Estructura:** solo escribes en `translations[locale]` y en `game.supportedLocales` (añade el idioma). No modificas `default`. Si encuentras un error en el original, repórtalo; no lo corrijas.
6. **Validación:**
   ```
   node .devin/skills/universe-qa/scripts/lint-content.mjs <slug>
   ```
   Con `content.requiredLocales` incluyendo el idioma, no debe quedar ningún `W-LOCALE-MISSING`. Para exigirlo, activar `strictLocales` en la spec (cambio de spec ⇒ nueva versión de la biblia).
7. **Muestreo de calidad:** relee 10 cartas al azar (las de mayor dificultad incluidas) comparando fuente y traducción; ajusta el glosario si detectas inconsistencias.
8. Reporta: idiomas completados, % cubierto por tipo, términos del glosario añadidos, dudas. `set-phase.mjs <slug> localization done` cuando todos los idiomas pedidos pasen.

## Preguntas para el usuario (si aplica)
Variante regional preferida · idiomas con escritura no latina (tipografía: avisar a estética) · nombres propios que quieras traducir.
