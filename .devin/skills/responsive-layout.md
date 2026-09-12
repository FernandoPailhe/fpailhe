---
skill: responsive-layout
---

# Responsive layout

Guía práctica para trabajar el layout responsive en este repo sin que los componentes terminen solapados o con espacios incorrectos.

## Contexto del proyecto

- Tailwind tiene un único breakpoint `mobile` custom: `@media (max-width: 680px)`.
- Eso significa `mobile:` sobrescribe solo para pantallas pequeñas; todo lo demás es desktop.
- Los tokens de espaciado, colores y radios viven en `packages/ui/src/theme/tokens.ts`.

## Principios

1. **Espacio por `gap`, no por `margin` mágico.**
   - Preferir `gap-2`, `gap-x-2.5`, `gap-y-2` y padding consistente (`px-4`, `py-3.5`).
   - Evitar medidas one-off tipo `ml-[7px]`.

2. **Los textos largos deben poder encoger.**
   - Contenedores: `min-w-0`.
   - Textos: `truncate` (sobre `overflow-hidden` implícito).
   - Si el componente es `flex`, asegurar que el padre tenga ancho definido.

3. **Filas tabla → tarjeta: preferir grid explícito.**
   - `flex-wrap` + `flex-1` (`flex-basis: 0%`) hace que las celdas se distribuyan mal porque el salto de línea se calcula sobre las bases iniciales, no sobre el tamaño final.
   - Si la tarjeta tiene varias filas, usa `display: grid` con `col-start` / `row-start`.

## Receta: tabla de n filas a tarjeta mobile

1. Romper la estructura de tabla para mobile:
   - `table` → `mobile:block`
   - `tbody` → `mobile:block`
   - `tr` → `mobile:grid mobile:grid-cols-<n>`
   - `td` → `mobile:block mobile:p-0` + `mobile:col-start-X mobile:row-start-Y`

2. Definir la grilla en columnas pares (2, 4, ...) para poder dividir pares de celdas 50/50.

3. Colocar cada celda con `col-start` y `row-start` explícito.

### Ejemplo: fila con 5 celdas distribuidas en 2 filas mobile

```tsx
<tr className="... mobile:grid mobile:grid-cols-4 mobile:gap-x-2.5 mobile:gap-y-2">
  <td className="... mobile:col-start-1 mobile:row-start-1 mobile:block mobile:p-0">
    Celda 1
  </td>
  <td className="... mobile:col-start-2 mobile:col-span-2 mobile:row-start-1 mobile:block mobile:min-w-0 mobile:p-0">
    Celda 2 (ancha)
  </td>
  <td className="... mobile:col-start-4 mobile:row-start-1 mobile:block mobile:p-0">
    Celda 3
  </td>
  <td className="... mobile:col-start-1 mobile:col-span-2 mobile:row-start-2 mobile:block mobile:p-0">
    Celda 4
  </td>
  <td className="... mobile:col-start-3 mobile:col-span-2 mobile:row-start-2 mobile:block mobile:p-0">
    Celda 5
  </td>
</tr>
```

## Patrones reutilizables

### Flex en una sola fila (sin wrap)

Sirve cuando todos los items caben en una sola línea y se reparte espacio.

```tsx
<div className="flex items-center gap-2.5 min-w-0">
  <span className="shrink-0">Izquierda</span>
  <span className="min-w-0 truncate flex-1">Contenido largo</span>
  <span className="shrink-0">Derecha</span>
</div>
```

### Dos columnas iguales (50/50)

```tsx
<div className="grid grid-cols-2 gap-2.5">
  <div>...</div>
  <div>...</div>
</div>
```

## Checklist antes de entregar

- [ ] Verificado en DevTools a 375×667 (o similar) y a 680px de ancho.
- [ ] Ningún texto se corta o solapa por no tener `min-w-0` + `truncate`.
- [ ] Si la celda anterior debe empujar a la siguiente hacia abajo, hay un layout explícito (grid o flex con bases fijas), no solo `order`.
- [ ] Los `gap` no dependen de `margin` arbitrarios.
- [ ] No se agregan colores o espaciados hardcodeados fuera de `tokens.ts` y `tailwind.config.ts`.
