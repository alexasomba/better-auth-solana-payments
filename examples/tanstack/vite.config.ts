import { fileURLToPath, URL } from "node:url";

import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import { defineConfig } from "vite-plus";

export default defineConfig({
  root: fileURLToPath(new URL(".", import.meta.url)),
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  ssr: {
    noExternal: ["better-auth-solana-payments"],
  },
  plugins: [tanstackStart(), viteReact()],
  fmt: {
    printWidth: 100,
    semi: true,
    singleQuote: false,
    trailingComma: "all",
    ignorePatterns: ["src/routeTree.gen.ts"],
  },
  lint: {
    options: { typeAware: true, typeCheck: true },
    categories: { correctness: "error" },
  },
  test: {
    // Vitest v4 compatibility: preserve mock call history.
    // Remove after tests no longer rely on calls from setup or earlier tests.
    // https://viteplus.dev/guide/vitest-v5#remove-unneeded-compatibility-settings
    // https://vitest.dev/guide/migration/#clearmocks-is-enabled-by-default
    clearMocks: false,
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/__tests__/setup.ts"],
    include: ["src/**/*.{test,spec}.{ts,tsx}"],
  },
});
