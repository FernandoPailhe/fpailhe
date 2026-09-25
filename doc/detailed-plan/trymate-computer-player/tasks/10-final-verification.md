# Task 10: Verificación final de integración

> Parte del plan: `../plan.md` — ver "Criterios de Aceptación Globales".

## Skill / Capa

Checklist pre-commit de `.devin/rules/rules.md` (sección 10) +
`.devin/skills/rugby-chess-code-review/SKILL.md` (aplicado a `lab/trymate`).

## Objetivo

Confirmar que fixes y bot funcionan juntos sin regresiones en PVP ni ONLINE.

## Depende De

- Tasks 01–09.

## Archivos a Crear/Editar

- `.devin/skills/rugby-chess-state/SKILL.md` — actualizar: `GameMode` ya no es solo PVP
  (mencionar ONLINE y VS_COMPUTER), `resolveStalledTurn`, `runBotTurn` y `botActing`.

## Detalles de Implementación

Correr en orden y corregir cualquier falla antes de seguir:

```bash
pnpm typecheck
pnpm lint
pnpm format:check
pnpm test
pnpm build
```

Pruebas manuales en `pnpm dev` → `/lab/trymate`:

1. PVP local: mover con banca disponible a casilla vacía (fix P2).
2. PVP local: armar posición donde un jugador queda sin movimientos → aviso de pase (fix P1).
3. Reglas: filas 2–4 / 8–10 (fix P3), EN y ES.
4. Vs computer ALTERNATING, HIDDEN y quick start: partida completa hasta GAME_OVER.
5. Vs computer: navegar historial durante el turno del bot → el bot espera; volver al presente → juega.
6. Vs computer: "Back to menu" en medio del turno del bot → no hay acciones tardías (timer cancelado).
7. Online (si hay credenciales Firebase): crear sala + unirse; confirmar que el pase se ve en ambos clientes.

## Fuera de Alcance

- Nuevas features. Solo arreglos necesarios para pasar la verificación.

## Verificación

- [ ] Los 5 comandos pasan.
- [ ] Los 7 chequeos manuales OK.
- [ ] Cero `any`; `EasyBot.ts` sin imports de React/Zustand.
- [ ] Skill `rugby-chess-state` actualizado.

## Handoff

- Produce: feature lista para commit/PR.
