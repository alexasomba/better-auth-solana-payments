import { defineConfig, type UserConfig } from "vite-plus";

const config: UserConfig = defineConfig({
  pack: {
    tsconfig: "./tsconfig.pack.json",
    dts: { build: true, incremental: true },
    format: ["esm"],
    entry: ["./src/index.ts", "./src/client.ts"],
    deps: {
      neverBundle: [
        /^better-auth($|\/)/,
        /^better-call($|\/)/,
        /^solana-payments($|\/)/,
        "defu",
        "zod",
      ],
      onlyBundle: false,
    },
    treeshake: true,
  },
  test: {
    clearMocks: true,
    globals: true,
    exclude: ["**/*.d.ts", "**/dist/**", "**/node_modules/**"],
  },
});

export default config;
