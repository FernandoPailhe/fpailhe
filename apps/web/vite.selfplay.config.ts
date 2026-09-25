import { defineConfig } from "vite";

// Build SSR del runner selfplay: un bundle ESM por entrada (cli + worker),
// sin minificar, para correr con `node .selfplay-dist/cli.js`.
export default defineConfig({
  build: {
    ssr: true,
    target: "node20",
    outDir: ".selfplay-dist",
    emptyOutDir: true,
    minify: false,
    rollupOptions: {
      input: {
        cli: "src/lab/trymate/selfplay/node/cli.ts",
        worker: "src/lab/trymate/selfplay/node/worker.ts",
      },
      output: { format: "esm", entryFileNames: "[name].js" },
    },
  },
});
