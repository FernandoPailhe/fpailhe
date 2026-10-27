# Banco de preguntas de la entrevista

Formato: **[Tier] Pregunta** — opciones típicas — *qué determina*. Reformular según el tema; las opciones son moldes, no listas cerradas. Siempre ofrecer "otra cosa".

## Ronda 0 · Semilla (solo si el pedido es vago)
- **[T1] ¿Qué tema o mundo?** y **¿qué querés que el jugador sienta al jugar?** — *premisa, tono*.
- **[T2] ¿Para quién es?** (público, edad aproximada, jugadores casuales vs. estratégicos) — *dureza, vocabulario, límites*.
- **[T2] ¿Idioma base y traducciones?** (es / es+en / otros) — *locales, longitudes de texto*.

## Ronda 1 · Narrativa
- **[T1] Rol del jugador.** Quién es y qué responsabilidad carga (gobernante, gestor, líder de una comunidad, sobreviviente, mediador…). — *voz en 2ª persona, tipo de decisiones, `Game.kind`*.
- **[T1] Fantasía de poder.** ¿Control, supervivencia, legado, astucia, cuidado? — *qué se premia, finales*.
- **[T1] Tono.** Serio/dramático · satírico/humor negro · melancólico · épico · cálido/costumbrista. — *registro de textos, estética*.
- **[T1] Tema moral central.** La pregunta que se repite (ej. ¿orden o libertad?, ¿eficacia o compasión?, ¿tradición o cambio?, ¿verdad o paz?, ¿individuo o comunidad?). Proponer 3–4 en base al tema. — *parámetros, arquetipos de dilema (§5.5 biblia)*.
- **[T1] Origen de la tensión.** ¿Escasez de recursos, conflicto entre facciones, presión del tiempo, secretos, dilemas éticos? — *tipos de amenaza, rondas de crisis*.
- **[T2] Realismo.** Realista · estilizado · fantástico · alegórico. — *reglas del mundo, investigación*.
- **[T2] Estructura.** ¿Hay victoria o solo "aguantar"? ¿Un final único, varios o por resultado? ¿La partida cierra con un clímax? — *condición de victoria, finales*.
- **[T2] Persona y tiempo verbal.** 2ª persona presente ("Te informan…"), 3ª, 1ª. — *guía de escritura (§6 biblia)*.
- **[T2] Humor.** ¿Ninguno, seco, absurdo, ácido? — *voz de personajes*.
- **[T3]** Longitud de cartas, nombres propios, calendarios del mundo.

## Ronda 2 · Sistema
- **[T1] ¿Qué está en juego?** Proponer 4–6 parámetros derivados del tema moral, cada uno con "0 = …, 100 = …". Pedir confirmar/cambiar. — *`Parameter`, extremos y finales por derrota*.
- **[T1] Pares en tensión.** ¿Cuáles de esos parámetros deberían chocar entre sí de forma natural? Mostrar la matriz propuesta. — *`tensionPairs`, matriz §5.2*.
- **[T1] ¿Cómo se gana y cómo se pierde?** Derrota por extremos (0, 100 o ambos), victoria por puntaje/etapa/condición, ausencia de victoria. — *`ParameterThreshold`, `end_game`*.
- **[T2] Dureza y curva.** Amable · equilibrada · dura. ¿Los errores perdonan o castigan? — *presupuesto por dificultad (§5.4)*.
- **[T2] Duración objetivo** (turnos/minutos) y **etapas** (2–5): qué cambia en cada una (nuevos parámetros, nuevo escenario, dificultad). — *`Stage`, cantidad de cartas*.
- **[T2] Ramas.** ¿Caminos exclusivos (ej. bando A/B)? ¿Cuáles y cómo se entra? — *`Branch.exclusiveGroup`, cartas por rama*.
- **[T2] Elenco.** Cantidad (4–10), funciones (aliado, rival, consejero, voz del pueblo…), ¿quiénes se desbloquean tarde? — *`Character`*.
- **[T2] Poderes.** ¿Escudos contra qué amenazas internas/externas? ¿Poderes que desbloquean la opción de equilibrio? ¿Modificadores? — *`Power`, `threatTags`, economía §5.6*.
- **[T2] Memoria.** ¿Las decisiones pasadas deben volver (consecuencias, cartas que dependen de elecciones previas)? — *`card_seen`, `enqueue_card`*.
- **[T3]** Insignias, umbrales intermedios, pesos, cuotas.

## Ronda 3 · Estética y límites
- **[T1] Sensación visual.** Mostrar 3 direcciones descriptivas (sin nombrar obras): ej. "grabado antiguo en tinta y sepia", "vectorial plano con colores saturados", "acuarela difusa con trazos de carbón". — *`ArtDirection.styleSummary`, mood*.
- **[T1] Paleta.** 2–3 propuestas en palabras + muestras hex aproximadas; oscura o clara por defecto. — *`ColorScheme`, `defaultScheme`*.
- **[T2] Tipografía.** Carácter: serif editorial · slab · humanista · geométrica · manuscrita; combinación display/body/accent. — *`Typography`*.
- **[T2] Íconos.** Línea · sólido · duotono · pixel · ilustrado; esquinas redondas o duras. — *`IconStyle`*.
- **[T2] Medios.** Solo ilustración, retratos de personajes, video/animación en momentos clave. Herramienta de generación prevista. — *`MediaAsset`, plantillas de prompt*.
- **[T2] Movimiento.** Transición de cartas: deslizar, desvanecer, voltear, apilar. — *`motion.cardTransition`*.
- **[T1] Límites de contenido.** Temas que se tratan con cuidado o están vetados (violencia, política real, religión, salud, etc.), y nivel de crudeza. — *§6 biblia, `blocked-terms`*.
- **[T1] Referencias que NO deben aparecer** (obras, marcas, artistas) — *`blocked-terms.txt`*.

## Preguntas de cierre
- ¿Falta algo que te importe y no preguntamos?
- ¿Revisamos los supuestos tomados antes de seguir? (listar los `supuesto`).
