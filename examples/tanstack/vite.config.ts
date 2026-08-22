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
});
