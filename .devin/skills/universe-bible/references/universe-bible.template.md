---
slug: {{slug}}
name: {{name}}
version: 0
status: draft            # draft | approved  (approved = definitiva; los cambios van por el §12)
locales: [{{locales}}]
approvedAt: null
tensionSpec: doc/universes/{{slug}}/tension-spec.json
brief: doc/universes/{{slug}}/brief.md
research: doc/universes/{{slug}}/research/
---

# {{name}} — Biblia del universo

> Documento **canónico**. Toda situación, personaje, poder, parámetro o insignia del universo se escribe
> consultándolo. Si el contenido y la biblia se contradicen, gana la biblia (o se abre un cambio en el §12).
> Las instrucciones entre `<!-- -->` se reemplazan al completar; no dejar ninguna en la versión aprobada.

## 1. Esencia

- **Logline** (1 frase): <!-- quién es el jugador, qué debe sostener y qué lo amenaza -->
- **Fantasía del jugador**: <!-- qué rol ocupa y qué poder/carga siente -->
- **Premisa** (≤ 120 palabras): <!-- -->
- **Pilares** (3–5, cada uno con "esto significa que… / esto NO significa que…"):
  1. <!-- -->
- **Tono y voz**: <!-- registro, humor, grado de crudeza; persona gramatical (2ª/1ª/3ª) y tiempo verbal -->
- **Tema moral central**: <!-- la pregunta que el juego le hace al jugador una y otra vez -->
- **Lo que este universo NO es**: <!-- límites de género/tono/contenido -->
- **Duración objetivo de una partida**: <!-- turnos aproximados y minutos -->

## 2. El mundo

- **Lugar y época**: <!-- -->
- **Reglas del mundo** (lo que es siempre verdad; cada una con id `C-xx`, ver §9): <!-- -->
- **Cultura y vida cotidiana**: <!-- costumbres, economía, creencias, lenguaje -->
- **Tecnología / magia / límites de lo posible**: <!-- -->
- **Geografía y escenarios recurrentes** (los "sets" donde ocurren las situaciones): <!-- -->
- **Fuentes de investigación que sustentan este capítulo**: <!-- enlaces a research/NN-*.md -->

## 3. Actores

### 3.1 Facciones e instituciones
| Facción | Quiere | Teme | Relación con el jugador | Parámetros que toca |
| --- | --- | --- | --- | --- |
| <!-- --> | | | | |

### 3.2 Elenco (Character)
| key | Nombre / título | Función narrativa | Voz (3 rasgos) | themeTags | Desbloqueo | Visual canónico (1 frase) |
| --- | --- | --- | --- | --- | --- | --- |
| <!-- --> | | | | | `unlockedByDefault` / condición | |

Reglas del elenco: <!-- cuántos personajes por etapa, quién nunca habla junto, arcos permitidos -->

## 4. Sistema de juego (mapeo al modelo de datos)

### 4.1 Parámetros (Parameter)
| key | Qué representa | 0 significa… | 100 significa… | Inicio | Concepto de ícono | threatTags de sus extremos |
| --- | --- | --- | --- | --- | --- | --- |
| <!-- --> | | | | | | |

**Extremos** (un `ParameterThreshold` por fila que importe):
| Parámetro | Umbral | Consecuencia narrativa | Efecto en reglas (`end_game` / `award_badge` / `enter_branch`…) | `once` | threatTags |
| --- | --- | --- | --- | --- | --- |
| <!-- --> | | | | | |

### 4.2 Etapas (Stage)
| order | Nombre | minScore | Parámetros que activa | difficultyRange | Qué cambia en la historia |
| --- | --- | --- | --- | --- | --- |
| 1 | <!-- --> | 0 | | | |

### 4.3 Ramas (Branch)
| key | Nombre | exclusiveGroup | Cómo se entra / se sale | Qué cambia |
| --- | --- | --- | --- | --- |

### 4.4 Poderes (Power)
| key | kind | Diégesis (qué es en el mundo) | Cómo se obtiene | Cargas máx. | Qué amenaza/opción/efecto afecta |
| --- | --- | --- | --- | --- | --- |

### 4.5 Insignias (Badge) y finales
- **Insignias**: <!-- key · rareza · condición narrativa -->
- **Finales** (`endingKey` → título y tono): <!-- incluir derrota por cada parámetro crítico, victoria(s), y `no_cards` -->
- **Condición de victoria**: <!-- -->

## 5. Gestión de tensiones (guía vinculante)

> Esta sección es la **ley** para escribir y revisar cada situación. Su versión ejecutable es
> `tension-spec.json`; si se cambia una, se cambia la otra y se corre `check-tensions.mjs`.

### 5.1 Principios
1. Toda decisión cuesta algo: una opción que solo mejora parámetros es una excepción declarada, no la norma.
2. El jugador siempre debe poder defender cada opción con una razón del mundo (no hay opciones "tonta").
3. Ninguna opción domina a otra de la misma carta en todos los parámetros.
4. La tensión nace de **valores en conflicto** del tema moral (§1), no solo de números.
5. <!-- principios propios del universo -->

### 5.2 Matriz de tensiones (parámetro × parámetro)
Leer fila↔columna. `3` = choque estructural (casi todo dilema entre ambos es genuino), `2` = frecuente, `1` = ocasional, `·` = sin relación directa.
| | <!-- p1 --> | <!-- p2 --> | <!-- p3 --> | <!-- p4 --> |
| --- | --- | --- | --- | --- |
| **p1** | — | | | |
| **p2** | | — | | |

Pares estructurales (alimentan `tensionPairs` del spec): para cada par `3` y `2`, explicar **por qué chocan en este mundo** y dar 2 dilemas ejemplo.
| Par | Intensidad | Por qué chocan | Dilema ejemplo A | Dilema ejemplo B |
| --- | --- | --- | --- | --- |

### 5.3 Escala de magnitudes (cuánto duele / cuánto da)
| Tier | Rango |Δ| | Significa en la ficción | Ejemplo |
| --- | --- | --- | --- |
| minor | 3–6 | molestia o favor menor | |
| medium | 7–12 | decisión con peso | |
| major | 13–20 | giro serio | |
| critical | 21–30 | cambia el rumbo de la partida | |

Reglas: un parámetro solo cae a un extremo en una partida normal por acumulación de decisiones, no por **una** carta, salvo cartas críticas declaradas.

### 5.4 Presupuesto por dificultad (1–10)
| Dificultad | Tier máx. | Parámetros máx. por opción | Balance neto ponderado máx. | Notas de diseño |
| --- | --- | --- | --- | --- |
| 1–2 | minor | 2 | ±4–5 | tutorial implícito |
| … | | | | |

### 5.5 Arquetipos de dilema del universo
Catálogo de 8–12 moldes reutilizables. Cada uno: nombre, par de parámetros, "lo que se gana / lo que se pierde", ejemplo, cuándo evitarlo.
| Arquetipo | Par | Se gana | Se pierde | Ejemplo | Evitar cuando |
| --- | --- | --- | --- | --- | --- |

### 5.6 Presión, peligro y recuperación
- **Sesgo esperado por parámetro** (`expectedBias`): <!-- cuáles derivan hacia abajo por diseño y por qué -->
- **Ritmo de crisis**: <!-- cada cuántos turnos aparece una amenaza a un extremo -->
- **Rutas de recuperación**: <!-- qué cartas/poderes permiten volver de un extremo -->
- **Economía de escudos** (shield): <!-- cuántos por partida, cómo se ganan, qué `threatTags` cubren, qué los cuesta -->

### 5.7 Opción de equilibrio (balance) y poderes `option_unlock`
- Cuándo existe, qué la habilita, tope de |Δ| y de parámetros, y cómo se justifica en la ficción.

### 5.8 Distribución objetivo de cartas
| Eje | Objetivo |
| --- | --- |
| Total | |
| Por etapa | |
| Por rama | |
| Por personaje | |
| Por nº de opciones (1 / 2 / 3) | |
| `once` vs `repeatable` | |
| Cartas de memoria (`card_seen`) / cola forzada (`enqueue_card`) | |

### 5.9 Test del dilema (checklist de cada carta)
- [ ] ¿Cada opción protege un valor distinto?
- [ ] ¿Puedo defender la opción "peor" ante un personaje del mundo?
- [ ] ¿Cuesta algo proporcional a su tier?
- [ ] ¿El texto sugiere pero no revela los números?
- [ ] ¿Toca un par de la matriz (§5.2) y no solo un parámetro aislado?
- [ ] ¿Respeta tono, voz y canon (§1, §9)?

### 5.10 Anti-patrones
<!-- lista de errores típicos de este universo: opción obvia, falso dilema, castigo arbitrario, spam de un mismo par… -->

## 6. Guía de escritura de contenido

- **Carta**: longitud 180–420 caracteres; abre con la situación concreta (quién, qué pasa, qué urge); termina en la pregunta implícita.
- **Opciones**: verbo en imperativo o 1ª persona, ≤ 90 caracteres, sin revelar consecuencias numéricas.
- **outcomeText** (opcional): 1–2 frases, ≤ 260 caracteres, muestra la consecuencia en el mundo.
- **Nombrar**: ids `off_<tipo>_<key>`; keys en `snake_case`; sin claves internas en texto visible.
- **Vocabulario**: términos preferidos / prohibidos → §8.
- **Sensibilidad**: <!-- temas a tratar con cuidado y cómo -->
- **Localización**: idioma base `<!-- -->`; qué no se traduce (nombres propios); tono por idioma.

## 7. Dirección estética (resumen)

- **Sensación**: <!-- -->
- **Paleta (descripción)**: <!-- -->
- **Tipografías (roles)**: <!-- display / body / accent -->
- **Íconos**: <!-- estilo + lista de conceptos por parámetro/poder/insignia -->
- **Imágenes**: <!-- técnica, encuadre, qué evitar -->
- Detalle y prompts: `apps/web/src/lab/universes/content/{{slug}}/aesthetic.json` y `doc/universes/{{slug}}/aesthetic-notes.md`.

## 8. Glosario y registro de nombres
| Término | Definición | Uso | Evitar |
| --- | --- | --- | --- |

Nombres propios aprobados (personas, lugares, instituciones): <!-- lista cerrada. Todo nombre nuevo se agrega acá antes de usarse -->

## 9. Registro de canon
Hechos inmutables del mundo. Cada uno con id para poder citarlo desde el contenido y las revisiones.
| ID | Hecho | Fuente (research/ o decisión D-xx) |
| --- | --- | --- |
| C-01 | | |

## 10. Plan de contenido
Enlace a `content-plan.json` y resumen de cuotas (§5.8). Estado actual: ver `status.mjs`.

## 11. Decisiones y supuestos
Resumen de las decisiones clave de `brief.md` (IDs `D-xx`) y de los supuestos que se tomaron sin consultar (marcados **[supuesto]**), para que el usuario pueda revertirlos.

## 12. Control de cambios
| Versión | Fecha | Cambio | Quién lo pidió | Impacto en contenido |
| --- | --- | --- | --- | --- |
| 1 | {{date}} | Versión aprobada | | |
