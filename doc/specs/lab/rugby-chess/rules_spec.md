# Rugby Chess — Especificación de Reglas del Juego

> **Propósito de este documento**
>
> Esta es una especificación **completa, formal y agnóstica de tecnología** de las
> reglas de Rugby Chess. Describe el juego tal como está implementado (el código es
> la fuente de verdad) y, cuando la documentación histórica difiere del código, lo
> señala explícitamente en la sección 13.
>
> El objetivo es que un equipo pueda **re-implementar el juego desde cero** en
> cualquier lenguaje/plataforma sin leer el código original, y que la estructura
> propuesta (sección 14) haga trivial adaptar el juego a nuevas reglas, piezas,
> modos o plataformas.
>
> **Convención:** todo lo normativo se expresa en términos de *datos* (parámetros
> configurables) + *funciones puras* (reglas) + *máquina de estados* (flujo). Nada
> de lo normativo depende de UI, renderizado 3D, red ni persistencia.

---

## Tabla de contenidos

1. [Visión general del juego](#1-visión-general-del-juego)
2. [Modelo conceptual y glosario](#2-modelo-conceptual-y-glosario)
3. [Parámetros de configuración (las reglas como datos)](#3-parámetros-de-configuración-las-reglas-como-datos)
4. [El tablero y sus zonas](#4-el-tablero-y-sus-zonas)
5. [Sistema de movimiento: modelo general](#5-sistema-de-movimiento-modelo-general)
6. [Catálogo de piezas](#6-catálogo-de-piezas)
7. [Composición del ejército y la banca](#7-composición-del-ejército-y-la-banca)
8. [Ciclo de vida de la partida (máquina de fases)](#8-ciclo-de-vida-de-la-partida-máquina-de-fases)
9. [Dinámica del turno](#9-dinámica-del-turno)
10. [Anotación y fin de la partida](#10-anotación-y-fin-de-la-partida)
11. [Historial de movimientos](#11-historial-de-movimientos)
12. [Modo de juego y extensión futura (jugador automático)](#12-modo-de-juego-y-extensión-futura-jugador-automático)
13. [Casos borde, decisiones implementadas y discrepancias con la documentación previa](#13-casos-borde-decisiones-implementadas-y-discrepancias)
14. [Arquitectura recomendada para re-implementación](#14-arquitectura-recomendada-para-re-implementación)
15. [Apéndices](#15-apéndices)

---

## 1. Visión general del juego

Rugby Chess es un juego de estrategia por turnos para **2 jugadores** sobre un
tablero rectangular alargado (5 × 11), conceptualmente una "cancha" con una zona
de anotación en cada extremo — de ahí la analogía con el rugby.

- Cada jugador comanda un **ejército de 8 piezas** de 3 tipos (Bulwark, Vanguard,
  Apex), de las cuales **5 empiezan en el tablero** y **3 quedan en la banca**.
- Todas las piezas **solo avanzan** hacia el extremo rival; ninguna retrocede.
- Una pieza **anota 1 punto** al llegar a la fila de anotación rival y **se retira
  del tablero** (como un "try").
- **Gana el primero en llegar a 3 puntos.** Si ambos jugadores quedan sin
  movimientos legales, gana quien tenga más puntos; si empatan, es empate.
- Las capturas son posicionales (se ocupa la casilla de la pieza enemiga) y las
  piezas capturadas se **eliminan permanentemente** de la partida.
- La mecánica distintiva es el **bloqueo lateral del Bulwark**: ciertas piezas
  proyectan "zonas prohibidas" dinámicas que el rival no puede pisar, con
  excepciones por tipo de pieza.

---

## 2. Modelo conceptual y glosario

El dominio completo cabe en estos conceptos. Una re-implementación fiel solo
necesita modelarlos; no necesita más estado que este.

| Concepto | Definición |
|---|---|
| **Posición** | Par ordenado `(x, y)` de coordenadas enteras no negativas. `x` = columna, `y` = fila. |
| **Casilla (Tile)** | Unidad del tablero identificada por su posición. A nivel de reglas solo importa su **ocupación**; los estados visuales (seleccionada, resaltada) son presentación. |
| **Tablero (Board)** | Grilla de `ANCHO × ALTO` casillas. Contiene las piezas en juego. Responde: ¿posición válida?, ¿qué pieza hay en P?, ¿qué piezas existen? |
| **Pieza (Piece)** | Entidad con `id` único, `tipo`, `dueño` y `posición` (o "sin posición" si está en la banca). Las piezas **no cambian de tipo ni de dueño** jamás. |
| **Jugador (Player/Side)** | Dos lados: `BLANCAS` y `NEGRAS`. Determina el **sentido de avance** y la **fila de anotación**. |
| **Ejército (Squad)** | Las 8 piezas de un jugador: 5 desplegables + 3 de banca. Sujeto a restricciones de composición por tipo. |
| **Banca (Bench)** | Subconjunto del ejército sin posición en el tablero. Puede incorporarse durante la partida. |
| **Estado de jugador (PlayerState)** | Piezas seleccionadas/colocadas, contenido de la banca y **puntaje**. |
| **Fase (Phase)** | Etapa del ciclo de vida: `SETUP → BENCH_SELECTION → PLAYING → GAME_OVER`. |
| **Turno** | Quién puede actuar. En `PLAYING`, un turno = **un movimiento**; ciertas acciones son **gratuitas** (no consumen turno). |
| **Movimiento legal** | Destino alcanzable según el patrón de la pieza + ocupación + camino despejado + bloqueos dinámicos. |
| **Captura** | Entrar a una casilla ocupada por pieza enemiga cuando el patrón lo permite. La pieza enemiga se elimina. |
| **Bloqueo lateral** | Zona dinámica que proyecta un Bulwark sobre sus casillas vecinas laterales: el enemigo no puede entrar (con excepciones). |
| **Registro de movimiento** | Entrada del historial: quién, qué pieza, origen, destino, captura y snapshot del tablero. |

### Convención de notación

- Las posiciones se escriben `(columna, fila)`, ambas desde `0`.
- "Adelante" = hacia la fila de anotación rival: `+y` para BLANCAS, `−y` para
  NEGRAS. Se formaliza con el **multiplicador de dirección** `d ∈ {+1, −1}`.
- Los diagramas se dibujan **desde la perspectiva de BLANCAS** (avanzar = subir).
  Para NEGRAS, espejar verticalmente.

---

## 3. Parámetros de configuración (las reglas como datos)

**Principio rector del diseño:** las reglas viven en *datos*, no en código. El
motor interpreta estos parámetros; cambiar una regla = cambiar un valor.

### 3.1 Parámetros del tablero

| Parámetro | Valor | Significado |
|---|---|---|
| `BOARD_WIDTH` | `5` | Columnas (`x ∈ [0, 4]`) |
| `BOARD_HEIGHT` | `11` | Filas (`y ∈ [0, 10]`) |

### 3.2 Parámetros de reglas de partida

| Parámetro | Valor | Significado |
|---|---|---|
| `TOTAL_PIECES_PER_PLAYER` | `8` | Tamaño del ejército por jugador |
| `PIECES_TO_PLACE` | `5` | Piezas que cada jugador despliega en el tablero |
| `PIECES_IN_BENCH` | `3` | Piezas que quedan en la banca |
| `MIN_PIECES_PER_TYPE` | `2` | Mínimo de piezas de cada tipo en el ejército completo |
| `MAX_PIECES_PER_TYPE` | `4` | Máximo de piezas de cada tipo en el ejército completo |
| `PLACEMENT_ROWS_BLANCAS` | `[1, 2, 3]` | Filas donde BLANCAS puede colocar piezas |
| `PLACEMENT_ROWS_NEGRAS` | `[7, 8, 9]` | Filas donde NEGRAS puede colocar piezas |
| `MAX_PIECES_PER_ROW` | `2` | Máximo de piezas propias por fila al colocar |
| `SCORING_ROW_BLANCAS` | `10` | Fila donde BLANCAS anota |
| `SCORING_ROW_NEGRAS` | `0` | Fila donde NEGRAS anota |
| `POINTS_TO_WIN` | `3` | Puntos necesarios para ganar |
| `FORBIDDEN_ROW_BLANCAS` | `0` | Fila prohibida para BLANCAS *(definida, no forzada — ver §13)* |
| `FORBIDDEN_ROW_NEGRAS` | `10` | Fila prohibida para NEGRAS *(definida, no forzada — ver §13)* |

### 3.3 Enumeraciones del dominio

```
PieceType  = { BULWARK, VANGUARD, APEX } 
Player     = { BLANCAS, NEGRAS }
GamePhase  = { SETUP, BENCH_SELECTION, PLAYING, GAME_OVER }
GameMode   = { PVP }   // modos PVC_* reservados para Fase 2 (ver §12.2)
```

Bulkwark es muralla.png
Vanguard es ariete.png
Apex es explorador.png

### 3.4 Esquema de configuración de piezas

Cada tipo de pieza se describe con una estructura de datos declarativa:

```
PieceConfig = {
  movement:             MovementPattern        // patrón de movimiento principal
  alternativeMovement?: MovementPattern        // patrón adicional opcional
  capture?:             CapturePattern         // patrón de captura opcional
  blocksSides?:         boolean                // proyecta bloqueo lateral
  blockedSideOffsets?:  DirectionVector[]      // qué casillas bloquea
  canBypassBlocker?:    boolean                // puede ignorar bloqueos
  bypassMinDistance?:   number                 // condición del bypass
  maxTotalDistance?:    number                 // límite de casillas totales
}

MovementPattern = {
  directions:  DirectionVector[]   // vectores (dx, dy) relativos, dy = "adelante"
  minDistance: number              // distancia mínima en casillas
  maxDistance: number              // distancia máxima en casillas
  canCapture:  boolean             // ¿este patrón puede terminar en pieza enemiga?
}

CapturePattern = {
  directions:  DirectionVector[]
  minDistance: number
  maxDistance: number              // los destinos de captura SIEMPRE requieren
                                   // pieza enemiga en la casilla destino
}
```

> **Regla de extensibilidad clave:** un patrón de movimiento y un patrón de
> captura son listas independientes de vectores × rango de distancias. Casi
> cualquier regla de movimiento nueva se expresa agregando vectores o cambiando
> rangos, sin tocar el motor.

---

## 4. El tablero y sus zonas

### 4.1 Geometría

```
        x=0   x=1   x=2   x=3   x=4
y=10  [   ][   ][   ][   ][   ]   ← fila de ANOTACIÓN de BLANCAS / prohibida NEGRAS
y=9   [   ][   ][   ][   ][   ]  ┐
y=8   [   ][   ][   ][   ][   ]  ├─ zona de COLOCACIÓN de NEGRAS (filas 7-9)
y=7   [   ][   ][   ][   ][   ]  ┘
y=6   [   ][   ][   ][   ][   ]
y=5   [   ][   ][   ][   ][   ]   ← campo neutral central (filas 4-6)
y=4   [   ][   ][   ][   ][   ]
y=3   [   ][   ][   ][   ][   ]  ┐
y=2   [   ][   ][   ][   ][   ]  ├─ zona de COLOCACIÓN de BLANCAS (filas 1-3)
y=1   [   ][   ][   ][   ][   ]  ┘
y=0   [   ][   ][   ][   ][   ]   ← fila de ANOTACIÓN de NEGRAS / prohibida BLANCAS
```

### 4.2 Sentido de juego

| Jugador | Multiplicador `d` | "Adelante" | Su fila de anotación | Filas de colocación |
|---|---|---|---|---|
| BLANCAS | `+1` | `y` creciente | `y = 10` | `1, 2, 3` |
| NEGRAS | `−1` | `y` decreciente | `y = 0` | `7, 8, 9` |

### 4.3 Invariantes derivados de la geometría

- **Monotonicidad:** ningún patrón de movimiento tiene `dy ≤ 0`. Por tanto,
  `y` es monótona creciente para BLANCAS y decreciente para NEGRAS: **una pieza
  jamás puede volver hacia atrás ni quedarse en la misma fila**.
- Consecuencia 1: una pieza de BLANCAS **jamás puede alcanzar `y = 0`** ni una
  de NEGRAS alcanzar `y = 10`. Las "filas prohibidas" son inalcanzables de hecho,
  razón por la cual su validación no está implementada (ver §13).
- Consecuencia 2: ninguna pieza puede permanecer indefinidamente en el tablero
  sin avanzar — pero sí puede quedar **bloqueada** sin movimientos legales.
- Consecuencia 3: **no es posible capturar sobre la fila de anotación rival**:
  el rival nunca puede tener piezas ahí (no puede alcanzarla), y las piezas que
  anotan se retiran inmediatamente.

---

## 5. Sistema de movimiento: modelo general

Toda la legalidad de movimientos se deriva de **cinco filtros aplicados en orden**
sobre cada destino candidato generado por los patrones de la pieza:

```
candidato = posición + dirección × multiplicador × distancia
```

1. **Límites del tablero** — el destino debe ser una posición válida.
2. **Ocupación** —
   - casilla con pieza **propia** → destino ilegal, siempre;
   - casilla con pieza **enemiga** → legal solo si el patrón permite captura
     (o es un patrón de captura, que *exige* enemigo);
   - casilla **vacía** → legal si el patrón lo cubre.
3. **Camino despejado** — para patrones con `distancia > 1`, las casillas
   intermedias deben estar libres de piezas (no se puede saltar piezas).
4. **Bloqueo lateral de Bulwark** — el destino no puede estar en la zona de
   bloqueo de un Bulwark enemigo, salvo excepción de bypass (§5.3).
5. **Reglas especiales del tipo** — p.ej. la trayectoria en L del Apex
   (sección 6.3), que además verifica el bloqueo en **todas** las casillas del
   camino, no solo el destino.

### 5.1 Multiplicador de dirección

Toda componente `dy` de un vector se multiplica por `d` del dueño:

```
destino.x = origen.x + dx × distancia
destino.y = origen.y + dy × distancia × d       // d = +1 BLANCAS, −1 NEGRAS
```

`dx` no se altera: la lateralidad es simétrica.

### 5.2 Movimiento vs. captura: listas separadas

El sistema distingue dos catálogos por pieza:

- Los **patrones de movimiento** generan destinos que deben estar **vacíos**
  (en la configuración actual ningún patrón de movimiento tiene
  `canCapture: true`).
- El **patrón de captura** genera destinos que deben contener **pieza enemiga**.

Resultado: una pieza puede tener geometrías de mover y de capturar distintas
(p. ej. Bulwark avanza recto pero captura en diagonal; Vanguard hace lo inverso).

### 5.3 El bloqueo lateral del Bulwark (zona dinámica)

Mecánica central del juego. Un Bulwark proyecta una zona prohibida sobre las
casillas definidas por `blockedSideOffsets` relativas a su posición:

```
blockedSideOffsets = [ (−1, 0), (+1, 0) ]   // las dos casillas laterales
```

Formalmente, para una pieza `P` que quiere entrar a la casilla `T`:

```
bloqueada(P, T) ⇔ ∃ Bulwark B enemigo tal que
                  T ∈ { B.pos + offset | offset ∈ blockedSideOffsets }
                  y ¬puedeBypassar(P, B, T)
```

Propiedades:

- Solo afecta a piezas **enemigas** del Bulwark; los Bulwarks propios no bloquean.
- Se evalúa sobre el **estado actual del tablero**; es una zona dinámica que se
  mueve con el Bulwark.
- Si varios Bulwarks enemigos bloquean la misma casilla, hay que poder
  bypassear **a todos** para entrar.
- La zona de bloqueo impide **entrar** a la casilla, no estar en ella: una pieza
  que ya ocupa una casilla que luego queda bloqueada (porque un Bulwark se movió
  a su lado) **no es expulsada**; simplemente el bloqueo se aplicará a futuros
  movimientos que intenten entrar ahí.

**Excepciones de bypass implementadas:**

| Pieza que se mueve | ¿Puede entrar a casilla bloqueada? |
|---|---|
| BULWARK | **Solo si captura**: si la casilla bloqueada contiene una pieza enemiga, el Bulwark puede entrar capturándola (vía su patrón de captura diagonal). Si está vacía → bloqueado. |
| VANGUARD | **Nunca.** Ni para mover ni para capturar. Un Vanguard no puede capturar una pieza enemiga que esté junto a un Bulwark rival. |
| APEX | **Sí, condicionalmente**: puede entrar si el Bulwark bloqueante está a **2 o más filas de distancia hacia adelante** del Apex. Si el Bulwark está a 1 fila, en la misma fila o detrás → bloqueado. (Formalmente: `(B.y − P.y) × d ≥ 2`.) |

### 5.4 Matiz sobre casillas intermedias

- Para el **movimiento doble del Vanguard** (2 adelante): la casilla intermedia
  debe estar **libre de piezas**, pero **puede estar bloqueada** por un Bulwark —
  el Vanguard "pasa por encima" de la zona. Lo que no puede es *aterrizar* en
  casilla bloqueada.
- Para el **Apex**: todas las casillas de la trayectoria (incluidas las
  intermedias y la lateral) se verifican contra el bloqueo, además de contra
  piezas.

---

## 6. Catálogo de piezas

### 6.1 BULWARK — el muro defensivo

**Identidad:** pieza de contención. Avanza lento, captura en diagonal y proyecta
la zona de bloqueo lateral (§5.3).

| Patrón | Direcciones | Distancia | Destino válido |
|---|---|---|---|
| `movement` | `(0, +1)` | 1 | solo casilla **vacía** |
| `capture` | `(−1, +1)`, `(+1, +1)` | 1 | solo pieza **enemiga** |
| `blocksSides` | offsets `(−1, 0)`, `(+1, 0)` | — | bloquea al enemigo |

```
        col−1   col    col+1
fila+1    C      M       C
fila      ■     BUL      ■

M = movimiento (casilla vacía)      C = captura (pieza enemiga)
■ = casillas que el ENEMIGO no puede ocupar (zona de bloqueo)
```

**Reglas específicas:**

- No puede capturar hacia adelante recto ni moverse en diagonal a casilla vacía:
  mover y capturar son geometrías disjuntas (como un peón de ajedrez).
- Su captura diagonal **ignora el bloqueo lateral** de Bulwarks enemigos si el
  destino contiene pieza enemiga (única vía de un Bulwark para entrar en zona
  bloqueada).
- Su zona de bloqueo se proyecta incluso si el Bulwark no puede moverse
  (es una habilidad pasiva posicional, no un efecto de movimiento).

### 6.2 VANGUARD — la pieza ofensiva

**Identidad:** pieza de presión. Se despliega lateralmente sin capturar, captura
de frente y tiene un avance doble.

| Patrón | Direcciones | Distancia | Destino válido |
|---|---|---|---|
| `movement` | `(0, +1)`, `(−1, +1)`, `(+1, +1)` | 1 | solo casilla **vacía** |
| `alternativeMovement` | `(0, +1)` | exactamente 2 | casilla vacía **y camino libre** |
| `capture` | `(0, +1)` | 1 | solo pieza **enemiga** |

```
        col−1   col    col+1
fila+2    .      M2      .
fila+1    M      C       M
fila      .     VAN      .

M  = movimiento a casilla vacía (recto o diagonal)
M2 = avance doble: vacía + casilla intermedia sin piezas (puede estar bloqueada)
C  = captura frontal (pieza enemiga)
```

**Reglas específicas:**

- Geometría invertida respecto al Bulwark: **mueve en diagonal, captura recto**.
- El avance doble es estrictamente `distancia = 2` y recto; no puede capturar
  con él y la casilla intermedia no puede tener piezas (sí puede estar dentro de
  una zona de bloqueo — ver §5.4).
- No tiene ninguna capacidad de bypass: es la pieza más vulnerable al bloqueo
  lateral del Bulwark enemigo.

### 6.3 APEX — la pieza de ruptura

**Identidad:** pieza de movilidad. Es la única con trayectoria compuesta
("en L"): **primero avanza, luego opcionalmente un paso lateral**.

**Algoritmo de movimiento (específico, no puramente tabular):**

```
para f ∈ {1, 2, 3}:                       // f = casillas de avance
    si el camino de f pasos adelante está libre (sin piezas, sin bloqueo):
        destino legal: (x,     y + f·d)   // avance puro
        si f + 1 ≤ 3:                     // queda presupuesto para 1 lateral
            destino legal: (x − 1, y + f·d)  si está vacía y no bloqueada
            destino legal: (x + 1, y + f·d)  si está vacía y no bloqueada
```

Restricciones codificadas:

- `f ≥ 1` — **siempre debe avanzar al menos 1 fila**; no existe movimiento
  puramente lateral.
- lateral `≤ 1` — a lo sumo un paso lateral, y **solo después** de los pasos de
  avance (nunca lateral-primero).
- `f + lateral ≤ 3` (`maxTotalDistance`) — el total de casillas recorridas no
  supera 3.
- **El lateral se ejecuta desde la columna de origen** en la fila alcanzada:
  es `(x±1, y+f)`, no un zig-zag.
- **Todas** las casillas de la trayectoria deben estar libres de piezas y fuera
  de zonas de bloqueo (salvo bypass, §5.3).
- **No puede capturar** en la implementación actual: todo destino debe estar
  vacío (ver discrepancia en §13).

```
        col−1   col    col+1
fila+3    .      M       .
fila+2    L      M       L
fila+1    L      M       L
fila      .     APX      .

M = avance puro (f ∈ {1,2,3}, camino libre, casilla vacía)
L = L-shape: avanzar f filas + 1 lateral (f ∈ {1,2}; total ≤ 3)
→ 7 destinos máximos
```

**Reglas específicas:**

- Si la **primera casilla frontal** está ocupada o bloqueada, el Apex no tiene
  **ningún** movimiento legal (toda trayectoria comienza por ahí).
- Su bypass de bloqueo (§5.3) le permite romper el cerco de un Bulwark **lejano**
  (≥ 2 filas adelante) pero no el de uno adyacente — es el counter natural del
  Bulwark en carrera larga, no en cuerpo a cuerpo.

### 6.4 Tabla resumen

| Propiedad | BULWARK | VANGUARD | APEX |
|---|---|---|---|
| Avance recto | 1 | 1 o 2 | 1–3 |
| Movimiento diagonal (a vacía) | no | 1 | solo como L (tras avanzar) |
| Captura | diagonal 1 | frontal 1 | **ninguna** (implementado) |
| Puede saltar piezas | no | no (el doble exige camino libre) | no |
| Proyecta bloqueo | sí (laterales) | no | no |
| Bypassea bloqueo | solo capturando | nunca | si el Bulwark está ≥2 filas adelante |
| Retrocede | nunca | nunca | nunca |

---

## 7. Composición del ejército y la banca

### 7.1 Restricciones de composición

Cada jugador conforma un ejército de **exactamente 8 piezas**:

```
∀ tipo t ∈ {BULWARK, VANGUARD, APEX}:   2 ≤ cantidad(t) ≤ 4
Σ cantidad(t) = 8     (= 5 en tablero + 3 en banca)
```

Distribuciones válidas (permutaciones): **{4, 2, 2}** y **{3, 3, 2}**.

- El **máximo por tipo (4)** se aplica incrementalmente: durante el despliegue
  ya no se puede elegir un tipo que ya tiene 4.
- El **mínimo por tipo (2)** se garantiza en la fase de selección de banca
  mediante una **validación de alcanzabilidad**: no se permite elegir una pieza
  de banca si, tras esa elección, las plazas restantes de la banca no bastan
  para que algún otro tipo llegue a su mínimo.

  Formalmente, al evaluar elegir el tipo `t` con `r` plazas de banca restantes:

  ```
  para cada tipo u ≠ t:
      faltan(u) = max(0, MIN − (enTablero(u) + enBanca(u)))
      si faltan(u) > r − 1  →  elección de t ilegal
  ```

### 7.2 La banca durante la partida

- Las piezas de la banca **no tienen posición**; son invisibles como entidad de
  tablero (la visibilidad ante el rival es asunto de presentación).
- Una pieza de banca se incorpora mediante la **acción de colocación**
  (§9.3), bajo las mismas reglas de colocación que el despliegue inicial:
  filas propias `[1-3]` / `[7-9]`, casilla vacía, máx. 2 propias por fila.
- Requisito adicional: solo se puede incorporar banca si el jugador tiene
  **menos de 5 piezas en el tablero** (`PIECES_TO_PLACE`). La banca repone
  bajas y piezas que anotaron, manteniendo el techo de 5 en juego.
- **Las piezas capturadas NO vuelven a la banca**: se eliminan de la partida.
  La banca solo decrece.

---

## 8. Ciclo de vida de la partida (máquina de fases)

```
                    ┌────────────────────────────────────────────┐
                    │                                            │
   inicio ──► SETUP ──► BENCH_SELECTION ──► PLAYING ──► GAME_OVER
             (5+5      (3 banca por         (turnos     (puntos o
              piezas    jugador)             alternos)   bloqueo)
              alternas)                                  mutuo)
```

Transiciones irreversibles; no se puede volver a una fase anterior (salvo
`reset`, que reinicia todo).

### 8.1 Fase SETUP — despliegue inicial

- **Jugador inicial:** BLANCAS.
- **Estructura del turno:** los jugadores **alternan colocando UNA pieza por
  turno** hasta que cada uno colocó 5 (10 colocaciones en total).

  > ⚠️ La documentación antigua decía "J1 coloca sus 5 y luego J2 las suyas".
  > Lo implementado es alternancia pieza a pieza (ver §13).

- **Micro-flujo de cada colocación:**
  1. El jugador elige un **tipo** de pieza (queda "en la mano"); no puede
     elegir otro tipo hasta colocarla, ni un tipo que ya tenga 4 unidades.
  2. El sistema calcula y ofrece las **posiciones legales de colocación**:
     filas propias de colocación, casilla vacía, < 2 piezas propias en esa fila.
  3. El jugador elige la casilla → la pieza se crea y se coloca → turno del
     otro jugador.
- **Transición:** cuando se completan las 10 colocaciones → `BENCH_SELECTION`,
  turno a BLANCAS.

### 8.2 Fase BENCH_SELECTION — selección de banca

- **Estructura:** BLANCAS elige sus 3 piezas de banca consecutivamente; luego
  NEGRAS elige las suyas. Cada elección crea la pieza sin posición.
- **Restricciones por elección** (además del tope de 3):
  - total del tipo (tablero + banca) < `MAX_PIECES_PER_TYPE` (4);
  - la elección no puede hacer imposible alcanzar `MIN_PIECES_PER_TYPE` (2)
    en otro tipo (regla de alcanzabilidad de §7.1).
- **Transición:** al completar las 3 de NEGRAS → `PLAYING`, turno a BLANCAS.

### 8.3 Fase PLAYING — juego

- Turnos alternos empezando por **BLANCAS**.
- En su turno, un jugador puede:
  - **mover** una pieza propia a un destino legal (consume el turno);
  - **incorporar** piezas de banca (acción **gratuita**, no consume turno,
    repetible mientras cumpla los requisitos).
- No existe acción de "pasar" turno (ver §13): un jugador sin movimientos ni
  banca disponible no tiene forma de ceder.
- **Transición:** ver §10.

### 8.4 Fase GAME_OVER

- Terminal. El resultado se calcula por puntaje: mayor puntaje gana; igualdad =
  empate.

---

## 9. Dinámica del turno

### 9.1 Acciones del jugador en PLAYING

| Acción | Consume turno | Requisitos |
|---|---|---|
| Seleccionar pieza propia | no | que sea su turno y pieza en tablero |
| Mover a destino legal | **sí** | destino ∈ movimientos legales de la pieza |
| Incorporar pieza de banca | **no** | banca no vacía **y** < 5 piezas propias en tablero **y** destino de colocación válido |
| Re-seleccionar otra pieza propia | no | — |
| Deseleccionar | no | — |

### 9.2 Resolución de un movimiento (secuencia atómica)

Cuando el jugador confirma un destino legal `T` para la pieza seleccionada `P`:

```
1. registrar origen (x, y) de P
2. si T contiene pieza enemiga C → CAPTURA: C se elimina de la partida
3. P se mueve a T
4. registrar el movimiento en el historial (con snapshot post-movimiento)
5. CHEQUEO DE ANOTACIÓN: si T.y == fila de anotación del jugador actual:
       +1 punto al dueño de P
       P se retira del tablero
       chequear fin de partida
6. limpiar selección
7. pasar el turno al otro jugador
```

Notas:

- El chequeo de anotación se realiza **después de cada movimiento**, antes de
  ceder el turno.
- La pieza anotadora **desaparece del tablero** — el punto implica perder la
  pieza (decisión estratégica central del juego).
- Capturar y anotar en el mismo movimiento es teóricamente imposible (§4.3).

### 9.3 Colocación de banca (acción gratuita)

```
requisitos:  fase = PLAYING
             banca del jugador actual ≠ ∅
             piezas propias en tablero < 5
destino válido:  fila ∈ filas de colocación propias
                 casilla vacía
                 piezas propias en esa fila < 2
efecto:  la pieza sale de la banca y entra al tablero; el turno NO cambia
```

### 9.4 Semántica de selección (nivel de reglas, no de UI)

- Solo se puede seleccionar pieza **propia** y solo en turno propio.
- Seleccionar una pieza expone su conjunto de movimientos legales (y, para
  presentación, el de movimientos "bloqueados": destinos alcanzables por patrón
  pero ilegales por camino/bloqueo — útil para visualizar el efecto del
  Bulwark).
- Elegir un destino ilegal no produce efecto alguno; elegir otra pieza propia
  cambia la selección; elegir cualquier otra casilla deselecciona.

---

## 10. Anotación y fin de la partida

### 10.1 Anotación

```
anota(P) ⇔ P.y == fila_anotación(P.dueño)      // evaluado tras cada movimiento
efecto:    puntaje(P.dueño) += 1;  retirar P del tablero
```

### 10.2 Condiciones de fin de partida

Se evalúan tras cada movimiento, en este orden:

1. **Victoria por puntos:** `puntaje ≥ 3` para cualquier jugador → `GAME_OVER`.
   Gana quien alcanzó el umbral.
2. **Bloqueo mutuo:** si **ninguno** de los dos jugadores tiene pieza alguna en
   el tablero con al menos un movimiento legal → `GAME_OVER`.
   - Mayor puntaje gana; puntajes iguales = **empate**.

Propiedades y consecuencias:

- La condición de bloqueo evalúa **ambos** jugadores, no solo el que movió.
  Un jugador sin movimientos **no termina** la partida por sí solo — el juego
  continúa mientras el rival pueda mover.
- El chequeo solo considera piezas **en tablero**; la banca no cuenta como
  "tener movimientos". Caso borde: si ambos jugadores tienen todas sus piezas
  bloqueadas pero aún conservan banca por incorporar, la partida **igualmente
  termina** (ver §13).
- Un jugador sin piezas en tablero y sin banca no puede actuar; si el rival sí
  puede, el juego sigue hasta que el rival anote 3 o quede bloqueado.
- **No hay límite de turnos** ni otras condiciones de fin.

---

## 11. Historial de movimientos

Funcionalidad transversal (no afecta las reglas, pero forma parte del
comportamiento observable):

- Cada movimiento ejecutado genera un **registro**: número de jugada, jugador,
  pieza (id y tipo), origen, destino, pieza capturada (si hubo), marca temporal
  y **snapshot completo del tablero post-movimiento**.
- El historial soporta navegación **hacia atrás y adelante** restaurando
  snapshots — es un modo de **solo lectura** ("ver el pasado"), no un undo:
  retroceder no borra jugadas, pero **hacer un movimiento nuevo habiendo
  retrocedido trunca el futuro** (semántica de historial lineal, como en
  editores).
- Mientras se está "en el pasado" no deberían ejecutarse acciones de juego.

---

## 12. Modo de juego y extensión futura (jugador automático)

### 12.1 Modo actual

| Modo | Descripción |
|---|---|
| `PVP` | Humano vs. humano, mismo dispositivo |

El juego es actualmente **PVP únicamente**. No existe jugador automático en la
versión portada — la implementación histórica fue descartada.

### 12.2 Extensión planificada (Fase 2): jugador automático

Está previsto añadir un **oponente automático en una segunda etapa**. El
diseño de capas ya anticipa ese punto de extensión: un agente no es más que
otra implementación del puerto de decisión, usando los mismos puntos de
entrada de reglas que un humano — la única diferencia es *quién decide*.

Contrato planificado (no implementado aún):

```
interface IPlayerAgent:
    // fase PLAYING: devuelve el movimiento elegido o null si no hay (cede turno)
    selectMove(board, player) -> Move | null

    // fase SETUP: devuelve {tipo, posición} a colocar
    selectSetupPiece(board, player, availableByType) -> { type, position }

    // fase BENCH_SELECTION: devuelve el tipo elegido
    selectBenchPiece(board, player, availableTypes) -> PieceType
```

Notas de diseño para la Fase 2:

- Convención histórica: el agente juega **NEGRAS** y el humano **BLANCAS**;
  los modos se modelaban como `GameMode.PVC_{EASY,MEDIUM,HARD}` (reintroducir
  esos valores junto con un enum `Difficulty` al implementarla).
- El agente deberá **ceder el turno automáticamente** cuando no tenga
  movimientos legales — lo cual hoy es imposible para un humano (§13.1, caso
  7); considerar introducir la acción `pass` como regla general.
- La dificultad, las heurísticas y la personalidad son detalles internos del
  agente; **no forman parte de las reglas del juego**.

---

## 13. Casos borde, decisiones implementadas y discrepancias

Esta sección documenta **honestamente** qué hace el sistema real, incluyendo
diferencias con la documentación histórica del proyecto. Al re-implementar,
decidir conscientemente cada punto.

### 13.1 Comportamiento implementado (fuente de verdad)

| # | Regla implementada | Detalle |
|---|---|---|
| 1 | **El Apex NO captura** | No tiene patrón de captura y todos sus destinos exigen casilla vacía. El tutorial y `MOVEMENT_SYSTEM.md` afirman que "captura como el Vanguard (1 adelante)" — **no está implementado**. |
| 2 | **Bulwark solo avanza recto** | Docs antiguos: "1 adelante o diagonal". Real: el diagonal es solo captura; a casilla vacía diagonal no entra. |
| 3 | **SETUP alterna pieza a pieza** | No "J1 coloca 5, luego J2 coloca 5": cada colocación cambia el turno. |
| 4 | **Colocar banca es acción gratuita** | No consume turno ni termina la jugada; repetible hasta agotar requisitos. |
| 5 | **Capturadas se eliminan** | No vuelven a la banca ni al ejército. La banca solo decrece. |
| 6 | **Bloqueo mutuo termina la partida** | Solo si **ambos** jugadores carecen de movimientos legales (piezas en tablero). Un jugador solo bloqueado no termina nada. |
| 7 | **No existe acción de "pasar turno"** | Si un jugador no tiene movimientos ni banca disponible, no tiene acción que ceda el turno — situación potencialmente bloqueante si el rival tampoco puede mover (ver 6). Relevante para la Fase 2: un agente automático necesitaría ceder automáticamente. |
| 8 | **Vanguard "salta" zonas bloqueadas** | Su avance doble ignora el bloqueo en la casilla intermedia; solo el destino se valida contra bloqueo. |
| 9 | **Bloqueo verificado en el camino del Apex** | A diferencia del Vanguard, el Apex sí valida bloqueo en cada casilla de su trayectoria. |
| 10 | **El bypass del Apex mide al Bulwark, no al destino** | Se compara la fila del Bulwark bloqueante con la del Apex (`≥ 2` hacia adelante), no la distancia del movimiento. Docs antiguos decían "Apex a 1 casillero moviendo 3" — la regla real es otra. |
| 11 | **`FORBIDDEN_ROW_*` definido pero no forzado** | No hay validación; es innecesaria porque el movimiento estrictamente hacia adelante las hace inalcanzables (§4.3). |
| 12 | **Anotar solo tras mover** | El chequeo de puntaje ocurre post-movimiento; una pieza nunca "empieza" en fila de anotación (las filas de colocación están lejos). |
| 13 | **Piezas propias nunca bloquean ni se capturan** | Casilla con pieza propia = destino ilegal para cualquier patrón; los Bulwarks propios no proyectan bloqueo sobre uno mismo. |
| 14 | **Banca invisible en las reglas** | Nada en las reglas impide ver la banca rival; el ocultamiento es decisión de UI. |
| 15 | **Mínimos por tipo solo se fuerzan en la banca** | En SETUP solo se fuerza el máximo (4); la alcanzabilidad del mínimo (2) se garantiza al elegir banca. Combinación resultante: {4,2,2} o {3,3,2}. |
| 16 | **`MIN_PIECES_PER_TYPE` en el destino de colocación** | El tope de 2 piezas por fila se cuenta solo con piezas **propias** (el rival puede tener las suyas en la misma fila — aunque por zonas disjuntas no ocurre en la práctica). |
| 17 | **El historial guarda snapshot post-movimiento** | Retroceder reconstruye el tablero desde el snapshot, no deshaciendo efectos. |
| 18 | **El empate es posible** | Solo vía bloqueo mutuo con puntajes iguales (0-0, 1-1, 2-2). |

### 13.2 Decisiones pendientes que una re-implementación debe tomar

1. **¿Debe el Apex capturar?** La intención documentada dice que sí (frontal 1).
   Implementarlo = agregar `capture` a su configuración y permitir destino
   ocupado-por-enemigo cuando el destino es frontal y la trayectoria válida.
2. **¿Acción de "pasar turno"?** Cubre el caso humano-sin-movimientos.
   Recomendada: `pass` disponible solo si el jugador no tiene movimientos
   legales ni banca colocable.
3. **¿La banca debería contar para el bloqueo mutuo?** Actualmente no.
   Alternativa: no declarar fin si algún jugador puede incorporar banca.
4. **¿La banca rival es oculta?** Definirlo como regla de visibilidad
   (información incompleta) o dejarlo en presentación.

---

## 14. Arquitectura recomendada para re-implementación

El juego se presta naturalmente a una separación limpia porque **todo lo
normativo es puro**: las reglas no conocen UI, tiempo real, red ni persistencia.

### 14.1 Capas y responsabilidades

```
┌─────────────────────────────────────────────────────────────────┐
│ ADAPTERS (cambian con la plataforma)                            │
│   Renderer (2D/3D/terminal) · UI/Input · Persistence            │
│   (+ Agente IA — extensión planificada, Fase 2, ver §12.2)      │
├─────────────────────────────────────────────────────────────────┤
│ PORTS (contratos hacia afuera)                                  │
│   IRenderer · IGameView (suscripción a cambios)                 │
│   (+ IPlayerAgent — contrato planificado para Fase 2, §12.2)    │
├─────────────────────────────────────────────────────────────────┤
│ ORCHESTRATION (máquina de estados de la partida)                │
│   GameSession: fase actual, turno actual, selección, acciones:  │
│   chooseType · placePiece · chooseBenchType · selectPiece ·     │
│   move · placeBench · (pass) · reset                            │
│   → traduce acciones a llamadas del ENGINE y cambios de fase    │
├─────────────────────────────────────────────────────────────────┤
│ ENGINE (reglas puras, sin estado mutable propio)                │
│   MoveGenerator · BlockRule · PlacementRule · SquadRule ·       │
│   ScoringRule · EndConditionRule                                │
│   → funciones deterministas: (board, piece, rules) -> moves     │
├─────────────────────────────────────────────────────────────────┤
│ DOMAIN (modelo)                                                 │
│   Position · Piece · Board · Side · Squad/Bench · PlayerState · │
│   MoveRecord/MoveHistory · enums (Phase, Mode, PieceType)       │
├─────────────────────────────────────────────────────────────────┤
│ RULEBOOK (datos puros)                                          │
│   GameParameters · PieceCatalog (PIECE_MOVEMENT_CONFIG)         │
└─────────────────────────────────────────────────────────────────┘
```

### 14.2 Regla de dependencias

Las dependencias apuntan **siempre hacia abajo** (hacia el dominio y los datos):

- `RULEBOOK` y `DOMAIN` no dependen de nada.
- `ENGINE` depende de `DOMAIN` + `RULEBOOK`; es **sin estado** y **puro** —
  testeable con tablas de casos.
- `ORCHESTRATION` depende de `ENGINE` + `DOMAIN`; posee el estado de la partida
  (fase, turno, selección, historial) y garantiza que solo ocurran transiciones
  válidas.
- `PORTS`/`ADAPTERS` dependen de todo lo anterior; nunca al revés. El juego es
  jugable completo **sin renderer** (p.ej. en tests o por consola).

### 14.3 Contratos clave (pseudocódigo)

```
// ENGINE — las cinco preguntas del juego
MoveGenerator.legalMoves(piece, board, rulebook)        -> Position[]
MoveGenerator.blockedMoves(piece, board, rulebook)      -> Position[]   // para UI
BlockRule.canEnter(piece, position, board, rulebook)    -> boolean
PlacementRule.legalPlacements(player, board, rulebook)  -> Position[]
SquadRule.canPick(type, squadState, rulebook, phase)    -> boolean
ScoringRule.scored(piece, player, rulebook)             -> boolean
EndCondition.gameOver(board, scores, rulebook)          -> Result | null

// ORCHESTRATION — superficie mínima
session.phase / session.currentPlayer / session.scores
session.chooseTypeForSetup(type)
session.placeSetupPiece(position)
session.chooseBenchType(type)
session.selectPiece(position)
session.moveSelected(to)
session.placeBench(position)
session.reset()
session.subscribe(listener)      // push de cambios a adapters

// PORTS
IRenderer.updateBoard(board); onTileClick(cb); onTileHover(cb)
// IPlayerAgent (§12.2) — puerto reservado para el agente automático (Fase 2)
```

### 14.4 Guía de extensión (cookbook)

| Quiero… | Tocar… | Esfuerzo |
|---|---|---|
| Cambiar tamaño del tablero | `GameParameters` | datos |
| Cambiar filas de colocación/anotación, puntos para ganar | `GameParameters` | datos |
| Cambiar movimiento de una pieza | su entrada en `PieceCatalog` | datos |
| Agregar una dirección a una pieza | `directions` de su patrón | datos |
| Permitir captura al Apex | agregar `capture` + permitir destino enemigo en su algoritmo | datos + 1 rama en engine |
| **Nueva pieza** | enum `PieceType` + entrada en `PieceCatalog` + visual en adapter | datos + adapter |
| **Nueva habilidad** (p.ej. "salta piezas") | flag en `PieceConfig` + hook en `MoveGenerator` | engine acotado |
| Nueva condición de victoria | nuevo detector en `EndConditionRule` | engine acotado |
| Nueva fase (p.ej. draft) | enum `Phase` + rama en `GameSession` | orchestration acotado |
| Cambiar 3D → 2D → terminal | solo el adapter `IRenderer` | aislado |
| Multi-jugador en red | adapter de transporte que alimente `GameSession` | aislado (las reglas ya son deterministas) |

### 14.5 Checklist de conformidad para la re-implementación

- [ ] Tablero 5×11 con coordenadas `(x,y)`, `x∈[0,4]`, `y∈[0,10]`.
- [ ] BLANCAS avanza `+y` y anota en `y=10`; NEGRAS `−y` y anota en `y=0`.
- [ ] 3 tipos con los patrones exactos de §6 (incl. movimiento en L del Apex).
- [ ] Bloqueo lateral del Bulwark con las 3 reglas de bypass de §5.3.
- [ ] Ejército de 8 = 5 tablero + 3 banca, cada tipo ∈ [2,4].
- [ ] SETUP alternado pieza a pieza, BLANCAS primero; colocación en filas
      propias con máx. 2/fila; luego banca 3+3.
- [ ] En PLAYING: un movimiento por turno; incorporar banca es gratis con
      tope de 5 en tablero.
- [ ] Captura por reemplazo; capturadas eliminadas; anotar retira la pieza.
- [ ] Fin: 3 puntos o bloqueo mutuo (con desempate por puntaje → empate).
- [ ] Reglas expresadas como datos (tabla de §3) interpretadas por un motor puro.

---

## 15. Apéndices

### Apéndice A — Pseudocódigo completo del generador de movimientos

```
function legalMoves(piece, board, rulebook) -> Position[]:
    if piece.position == null: return []

    if piece.type == APEX:
        return apexMoves(piece, board, rulebook)          // §6.3

    result = []
    d = directionMultiplier(piece.owner)                  // +1 / −1
    cfg = rulebook.pieceCatalog[piece.type]

    for pattern in [cfg.movement, cfg.alternativeMovement?]:
        for dir in pattern.directions:
            for dist in pattern.minDistance .. pattern.maxDistance:
                dest = (piece.x + dir.dx·dist, piece.y + dir.dy·dist·d)
                if !board.isValid(dest):            continue
                occupant = board.pieceAt(dest)
                if occupant != null:
                    if !pattern.canCapture:         continue   // mover: solo vacías
                    if occupant.owner == piece.owner: continue
                if !canEnter(piece, dest, board):   continue   // bloqueo Bulwark
                if dist > 1 && !pathClear(piece, dest, board): continue
                result.push(dest)

    for dir in cfg.capture.directions:                        // captura: exige enemigo
        for dist in cfg.capture.minDistance .. cfg.capture.maxDistance:
            dest = (piece.x + dir.dx·dist, piece.y + dir.dy·dist·d)
            if !board.isValid(dest):                continue
            occupant = board.pieceAt(dest)
            if occupant == null || occupant.owner == piece.owner: continue
            if !canEnter(piece, dest, board):       continue
            result.push(dest)

    return unique(result)

function canEnter(piece, dest, board) -> boolean:             // §5.3
    for enemyBulwark in board.pieces where type == BULWARK and owner != piece.owner:
        if dest in enemyBulwark.blockedTiles():
            if !canBypass(piece, enemyBulwark, dest, board): return false
    return true

function canBypass(piece, blocker, dest, board) -> boolean:
    if piece.type == BULWARK:
        return board.pieceAt(dest)?.owner != piece.owner      // solo capturando
    if piece.type == APEX:
        return (blocker.y − piece.y) · d(piece.owner) ≥ 2
    return false                                              // VANGUARD: nunca
```

### Apéndice B — Pseudocódigo del flujo de una partida

```
state = { phase: SETUP, current: BLANCAS, scores: {0,0}, history: [] }

// SETUP: 10 colocaciones alternadas (BLANCAS, NEGRAS, BLANCAS, ...)
repeat until both players placed 5 pieces:
    type   = currentPlayer.chooseType()            // válido: tipo con < 4
    pos    = currentPlayer.choosePosition(legalPlacements(current))
    board.place(new Piece(type, current, pos))
    current = other(current)
phase = BENCH_SELECTION; current = BLANCAS

// BENCH_SELECTION: 3 elecciones seguidas por jugador
for player in [BLANCAS, NEGRAS]:
    repeat 3 times:
        type = player.chooseBenchType()            // válido: §7.1
        player.bench.add(new Piece(type, player, null))
phase = PLAYING; current = BLANCAS

// PLAYING
loop:
    if gameOver(board, scores): break
    // acciones gratuitas primero (banca), luego el movimiento del turno
    while currentPlayer.bench ≠ ∅ && ownPiecesOnBoard < 5 && playerWants:
        pos = currentPlayer.choosePosition(legalPlacements(current))
        board.place(currentPlayer.bench.pop(pos))
    move = currentPlayer.chooseMove()              // pieza + destino legal
    apply(move): capture? → remove enemy; piece → dest
    history.push(record(move, snapshot(board)))
    if dest.y == scoringRow(current):
        scores[current] += 1; board.remove(piece)
    current = other(current)

// GAME_OVER: gana mayor puntaje; igualdad = empate
```

### Apéndice C — Referencia rápida de todos los números

| Regla | Valor |
|---|---|
| Tablero | 5 × 11 |
| Ejército | 8 = 5 tablero + 3 banca |
| Por tipo | 2–4 |
| Colocación | filas 1-3 / 7-9, máx. 2 propias por fila |
| Bulwark | mueve (0,+1)·1; captura (±1,+1)·1; bloquea (±1,0) |
| Vanguard | mueve (0,+1),(±1,+1)·1; doble (0,+1)·2; captura (0,+1)·1 |
| Apex | avanza 1-3 + lateral ≤1, total ≤3; sin captura; bypass si Bulwark ≥2 filas |
| Anotación | fila opuesta: 10 / 0 |
| Victoria | 3 puntos, o más puntos ante bloqueo mutuo |
| Turno inicial | BLANCAS en todas las fases |

---

*Documento derivado del código fuente real del proyecto (`src/domain/`,
`src/application/rules/MovementRuleEngine.ts`, `src/application/GameState.ts`).
Ante cualquier duda entre este documento y el código, **el código manda** — y
este documento debería actualizarse.*
