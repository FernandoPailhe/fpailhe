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
);
