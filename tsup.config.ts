import { defineConfig } from "tsup";
import { rename } from "fs/promises";
import { resolve } from "path";

export default defineConfig([
  {
    entry: {
      content: "src/content/index.ts",
      background: "src/background/index.ts",
      popup: "src/popup/index.ts",
      options: "src/options/index.ts",
      "ml-offscreen": "src/offscreen/index.ts",
    },
    format: "iife",
    outDir: "dist",
    splitting: false,
    sourcemap: false,
    clean: true,
    minify: false,
    async onSuccess() {
      // tsup adds .global.js suffix for IIFE — rename to .js
      const files = [
        "content",
        "background",
        "popup",
        "options",
        "ml-offscreen",
      ];
      for (const f of files) {
        await rename(
          resolve("dist", `${f}.global.js`),
          resolve("dist", `${f}.js`),
        );
      }
    },
  },
  {
    entry: {
      "ml-worker": "src/ml-worker/index.ts",
    },
    format: "esm",
    outDir: "dist",
    splitting: false,
    sourcemap: false,
    clean: false,
    minify: false,
    external: ["./transformers.min.js"],
  },
]);
