# Guía de escritura de cartas

La voz concreta, el registro y el vocabulario salen del §6 y el §8 de la biblia de cada universo. Esta guía es la técnica común.

## 1. Anatomía

| Parte | Función | Límite orientativo |
| --- | --- | --- |
| `text` | Plantea la situación: quién pide qué, qué hay en juego, qué apremia | ≤ `maxCardChars` (420); ideal 180–320 |
| `label` | Qué hace el jugador: verbo + objeto concreto | ≤ `maxLabelChars` (90); ideal 3–9 palabras |
| `outcomeText` | Qué pasa después, visible en el mundo | ≤ `maxOutcomeChars` (260); 1–2 oraciones |

## 2. Estructura del texto de la carta (3 golpes)
1. **Quién/dónde:** abre con la voz del personaje o el hecho (nunca "Eres el…" repetido).
2. **El problema con su costo:** qué se pierde si no se actúa.
3. **El empujón:** algo que obliga a decidir ahora (plazo, presencia, rumor).

## 3. Las opciones
- Cada opción es una **postura**, no una etiqueta moral. Evita "Aceptar / Rechazar" salvo que sean la verdadera disyuntiva.
- El costo debe poder *deducirse* del texto o del propio label ("Ceder el turno a cambio de su apoyo").
- No reveles números ni nombres de parámetros. Sí puedes aludir al valor: *la gente*, *el tesoro*, *la lealtad*.
- Diferencia las opciones por **valor protegido**, no por intensidad ("más/menos").
- Con 1 opción: es un evento obligatorio; el texto debe justificarlo y el `outcomeText` dar peso.
- Si el hecho de la situación **ya ocurrió**, las opciones son posturas o reacciones del protagonista; los pedidos de acción van en otra carta.
- Dos opciones es válido; no fuerces una tercera.
- Con 3 opciones: la tercera no es "término medio" por defecto; usa `balance` solo si el plan lo pide.

## 4. Efectos y números
- Elige el **nivel** de magnitud (minor/medium/major/critical) por la importancia narrativa y limita según la dificultad (tabla del §5.4).
- Un par en tensión se ejercita así: una opción **sube A y baja B**, la otra **sube B y baja A**.
- Evita deltas de ±1–2 (ruido) y deltas idénticos en todas las opciones.
- El neto de cada opción respeta `netMax`; no hay opciones que solo ganen (salvo cartas de recompensa con `pureEffectTags`).
- Costo oculto: una opción puede añadir `enqueue_card` (consecuencia futura) en vez de un golpe inmediato.
- Escudos: si la opción representa una amenaza, agrega `threatTags`; el jugador con el escudo adecuado la neutraliza.

## 5. Voz y estilo
- Segunda persona o la persona del §6; tiempo verbal consistente.
- Frases cortas; una imagen concreta por carta (un objeto, un gesto) en lugar de adjetivos.
- Humor y dramatismo según el tono del brief; nunca burlarse del jugador.
- Cada personaje tiene un tic o forma de hablar distinto; si tapas el nombre debería reconocerse.
- Nada de metalenguaje ("tus puntos", "esta opción afecta…").
- Sin moraleja: el resultado narrativo muestra, no juzga.

## 6. Variedad en un lote
- Rota arquetipos (§5.5), personajes, longitudes (cortas y largas), nº de opciones, tono (urgente/reflexivo/ligero).
- No repitas el mismo arranque en más de 2 cartas.
- Alterna cartas que castigan con cartas que dejan respirar (dentro de `maxPureRatio`).

## 7. Errores frecuentes
| Error | Corrección |
| --- | --- |
| Una opción es obviamente la mejor | Dale un costo real a esa opción o un beneficio oculto a la otra |
| Texto que explica los números | Mostrar consecuencias en el mundo |
| Pérdida enorme sin pista | Agregar señal en el texto o bajar el nivel |
| Todas las opciones tocan los mismos parámetros | Variar los pares |
| Personaje genérico | Reescribir con su voz/tic del §6 |
| Cierre moralizante | Cortar la última frase |
| Términos protegidos o claves internas | Reemplazar por el glosario (§8) |

## 8. Checklist final por carta
- [ ] Ids y rutas correctos, `gameId` y `characterId` válidos
- [ ] 1–3 opciones, `order` 1..n, `whenUnavailable` presente
- [ ] Texto dentro de los límites, sin claves ni números visibles
- [ ] Deltas dentro de la escala y el presupuesto de dificultad
- [ ] Trade-off real; ninguna opción dominada
- [ ] Voz y glosario del universo
- [ ] `lint-content` y `check-tensions` sin errores
