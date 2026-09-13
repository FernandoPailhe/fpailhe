import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  test: {
    projects: [
      {
        test: {
          name: "data-model",
          root: "./packages/data-model",
          environment: "node",
          include: ["src/**/*.test.ts"],
        },
      },
      {
        plugins: [react()],
        test: {
          name: "web",
          root: "./apps/web",
          environment: "jsdom",
          include: ["src/**/*.test.{ts,tsx}"],
          globals: true,
          env: { NODE_ENV: "test" },
          setupFiles: ["./src/test/setup.ts"],
        },
      },
    ],
  },
});
