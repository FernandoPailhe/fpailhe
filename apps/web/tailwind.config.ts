import type { Config } from "tailwindcss";
import {
  buildTailwindColors,
  buildTailwindFonts,
  buildTailwindRadius,
} from "@ferpa/ui/theme-tokens";

// El theme (colores, tipografías, radios) se deriva de `packages/ui/src/theme/tokens.ts`.
// Para recolorear o retipografiar el sitio, ese es el único archivo a tocar —
// este config y `ThemeProvider` en runtime leen la misma fuente.
export default {
  content: [
    "./index.html",
    "./src/**/*.{ts,tsx}",
    "./scripts/**/*.mjs",
    "../../packages/ui/src/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: buildTailwindColors(),
      fontFamily: buildTailwindFonts(),
      borderRadius: buildTailwindRadius(),
      screens: {
        mobile: { max: "680px" },
      },
    },
  },
  plugins: [],
} satisfies Config;
