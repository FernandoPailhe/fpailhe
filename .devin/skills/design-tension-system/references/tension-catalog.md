# Catálogo de tensiones

## 1. Arquetipos de dilema (moldes a adaptar al tema)

| Arquetipo | Esquema | Par típico | Qué evalúa |
| --- | --- | --- | --- |
| **Corto vs. largo plazo** | Beneficio inmediato que erosiona algo futuro | recurso ↔ estabilidad | Paciencia |
| **Eficacia vs. justicia** | Lo rápido hiere a alguien; lo justo cuesta | resultado ↔ legitimidad | Valores |
| **Orden vs. libertad** | Control que protege pero oprime | seguridad ↔ apoyo/libertad | Ideología |
| **Verdad vs. paz** | Revelar desestabiliza; ocultar corroe | confianza ↔ calma | Honestidad |
| **Lealtad vs. deber** | Un aliado pide algo que perjudica al conjunto | aliado ↔ comunidad | Prioridades |
| **Tradición vs. cambio** | Innovar rompe lazos; no innovar estanca | cohesión ↔ progreso | Apertura |
| **Escasez repartida** | No alcanza para todos; elegir quién recibe | grupo A ↔ grupo B | Equidad |
| **Riesgo vs. seguridad** | Apuesta con cola de cola pesada | ganancia ↔ reserva | Tolerancia |
| **Reputación vs. necesidad** | Una acción útil mancha la imagen | recurso ↔ prestigio | Cálculo |
| **Mal menor** | Todas las opciones duelen; elegir cuál | cualquiera | Responsabilidad |
| **Delegar vs. controlar** | Confiar en un ayudante o hacerlo uno mismo | tiempo ↔ control | Confianza |
| **Preparar vs. reaccionar** | Invertir antes de la crisis o esperar | reserva ↔ margen | Anticipación |

Para cada arquetipo del universo documentar: situación-tipo, valor protegido por A, valor protegido por B, costo visible, costo oculto, y 2 variantes por etapa.

## 2. Escala de magnitud (referencia, rango 0–100)

| Nivel | |Δ| | Uso | Señal narrativa |
| --- | --- | --- | --- |
| minor | 3–6 | Fricción cotidiana, ajustes | "Un contratiempo" |
| medium | 7–12 | Decisión relevante | "Una decisión que se nota" |
| major | 13–20 | Giro importante | "Esto cambia el rumbo" |
| critical | 21–30 | Crisis, no retorno, clímax | "Esto puede terminar la partida" |

Una opción con `critical` debe anunciarse narrativamente (el jugador entiende la gravedad) y rara vez aparece antes de la mitad.

## 3. Presupuesto por dificultad (plantilla)

| d | maxTier | maxParams | netMax |
| --- | --- | --- | --- |
| 1 | minor | 2 | 4 |
| 2 | minor | 2 | 5 |
| 3 | medium | 2 | 6 |
| 4 | medium | 3 | 7 |
| 5 | medium | 3 | 8 |
| 6 | major | 3 | 9 |
| 7 | major | 3 | 10 |
| 8 | major | 4 | 11 |
| 9 | critical | 4 | 12 |
| 10 | critical | 4 | 14 |

La dificultad también sube con: menos cartas de respiro, amenazas sin escudo disponible, opciones de equilibrio condicionadas, cadenas de consecuencias (`enqueue_card`).

## 4. Patrones de opción

- **Trade-off limpio:** +A −B (par en tensión).
- **Costo oculto:** +A hoy, `enqueue_card` con −B mañana.
- **Mal menor:** −A y −B de distinto peso, uno reversible.
- **Apuesta:** efectos mayores con una consecuencia posterior dependiente de la elección.
- **Equilibrio:** pequeños ajustes que acercan parámetros al centro; requiere desbloqueo.
- **Escudo:** la opción es ignorada si el jugador tiene el poder que neutraliza la amenaza (`threatTags`).

## 5. Economía de escudos y recuperación

- Cada amenaza debe tener ≥ 1 escudo posible y ≥ 1 forma de verse venir.
- Los poderes se otorgan con `grant_power` (decisiones previas, umbrales, insignias); su costo debe ser una oportunidad perdida.
- Las cartas de respiro (recompensa, alivio) están limitadas por `pureEffectTags` y `maxPureRatio`.
- Recuperar un parámetro cuesta ≈ 1.5× lo que costó perderlo (el mundo presiona).

## 6. Checklist de prueba de dilema (§5.9)
1. ¿Hay al menos dos opciones razonables para jugadores distintos?
2. ¿Cada opción protege un valor identificable?
3. ¿El costo es visible o deducible, no una trampa arbitraria?
4. ¿La opción "obvia" cambia si el jugador mira otro parámetro?
5. ¿Es coherente con la etapa y la dificultad?
6. ¿Algún parámetro mencionado en el texto no se mueve (o al revés)?
7. ¿El resultado narrativo coincide con los números?

## 7. Anti-patrones (§5.10)
- **Almuerzo gratis:** una opción gana sin perder.
- **Opción dominada:** una opción es peor en todo.
- **Castigo arbitrario:** pérdida grande sin pista en el texto.
- **Falsa elección:** todas las opciones llevan al mismo resultado.
- **Ruido numérico:** deltas de ±1–2 sin significado.
- **Parámetro tirano:** un parámetro decide todas las cartas.
- **Moralina:** el texto señala la opción "correcta".
- **Equilibrio gratuito:** la opción de equilibrio siempre es la mejor y sin costo.
- **Crisis sin aviso:** golpe crítico sin umbral previo ni escudo.
