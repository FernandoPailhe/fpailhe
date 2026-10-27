import js from "@eslint/js";
import globals from "globals";
import tseslint from "typescript-eslint";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";

export default tseslint.config(
  {
    ignores: [
      "**/dist/**",
      "**/node_modules/**",
      "**/.turbo/**",
      // Snapshots vendored de specs: documentación de referencia, no código propio.
      "doc/specs/**",
    ],
  },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    plugins: {
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      "react-refresh/only-export-components": ["warn", { allowConstantExport: true }],
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
    },
  },
  {
    // Los bots de trymate son agnósticos: no importan constantes ni layouts
    // concretos — reciben reglas y motor por BotContext.
    files: ["apps/web/src/lab/trymate/application/ai/**/*.ts"],
    ignores: [
      "apps/web/src/lab/trymate/application/ai/**/*.test.ts",
      "apps/web/src/lab/trymate/application/ai/testing/**",
      "apps/web/src/lab/trymate/application/ai/sim/**",
    ],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["**/constants/GameConstants"],
              importNames: ["GAME_CONFIG"],
              message: "El bot es agnóstico: usa ctx.rules en lugar de GAME_CONFIG.",
            },
            {
              group: ["**/constants/GameRules"],
              importNames: ["GAME_RULES"],
              message: "El bot es agnóstico: usa ctx.rules en lugar de GAME_RULES.",
            },
            {
              group: ["**/constants/PieceConstants"],
              importNames: ["PIECE_MOVEMENT_CONFIG"],
              message: "El bot es agnóstico: consulta ctx.engine en lugar de la config.",
            },
            {
              group: ["**/config/QuickStartLayout"],
              message: "El bot es agnóstico: no depende de layouts de quick start.",
            },
          ],
        },
      ],
      "no-restricted-syntax": [
        "error",
        {
          selector: "MemberExpression[object.name='PieceType']",
          message:
            "El bot es agnóstico: no puede referenciar PieceType.X concreto; usa ctx.rules.pieceTypes.",
        },
      ],
    },
  },
  {
    // El módulo universes es autónomo: no usa @ferpa/data-model (decisión #1 del plan).
    // Va antes del bloque de domain: para archivos de domain/ gana el bloque
    // siguiente, cuyas restricciones ya incluyen `@ferpa/*`.
    files: ["apps/web/src/lab/universes/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["@ferpa/data-model"],
              message: "El módulo universes es autónomo: no importa @ferpa/data-model.",
            },
          ],
        },
      ],
    },
  },
  {
    // El dominio de universes es puro: no importa React, la app ni otras capas.
    files: ["apps/web/src/lab/universes/domain/**/*.ts"],
    ignores: [
      "apps/web/src/lab/universes/domain/**/*.test.ts",
      "apps/web/src/lab/universes/domain/engine/testing.ts",
    ],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: [
                "react",
                "react-dom",
                "react-router-dom",
                "zustand",
                "@tanstack/*",
                "firebase",
                "firebase/*",
                "@ferpa/*",
                "**/application/**",
                "**/infrastructure/**",
                "**/components/**",
                "**/routes/**",
              ],
              message: "domain es puro: no importa React, la app ni otras capas.",
            },
          ],
        },
      ],
    },
  },
  {
    // El motor es puro: azar/reloj/ids entran por EngineContext.
    files: ["apps/web/src/lab/universes/domain/engine/**/*.ts"],
    ignores: [
      "apps/web/src/lab/universes/domain/engine/**/*.test.ts",
      "apps/web/src/lab/universes/domain/engine/testing.ts",
    ],
    rules: {
      "no-restricted-properties": [
        "error",
        { object: "Math", property: "random", message: "El motor es puro: azar/reloj/ids entran por EngineContext." },
        { object: "Date", property: "now", message: "El motor es puro: azar/reloj/ids entran por EngineContext." },
      ],
      "no-restricted-globals": [
        "error",
        { name: "window", message: "El motor es puro: azar/reloj/ids entran por EngineContext." },
        { name: "document", message: "El motor es puro: azar/reloj/ids entran por EngineContext." },
        { name: "localStorage", message: "El motor es puro: azar/reloj/ids entran por EngineContext." },
        { name: "navigator", message: "El motor es puro: azar/reloj/ids entran por EngineContext." },
        { name: "crypto", message: "El motor es puro: azar/reloj/ids entran por EngineContext." },
      ],
    },
  },
);
