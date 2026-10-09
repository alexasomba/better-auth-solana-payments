import { defineConfig, type UserConfig } from "vite-plus";

const config: UserConfig = defineConfig({
  fmt: {
    // Release Please owns the changelog's generated Markdown.
    ignorePatterns: ["CHANGELOG.md", "**/routeTree.gen.ts"],
  },
  staged: {
    "*": "vp check --fix",
  },
  pack: {
    tsconfig: "./tsconfig.pack.json",
    dts: { build: true, incremental: true },
    format: ["esm"],
    entry: ["./src/index.ts", "./src/client.ts"],
    deps: {
      resolveDepSubpath: true,
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
  lint: {
    options: { typeAware: true, typeCheck: true },
    categories: { correctness: "error" },
  },
  test: {
    clearMocks: true,
    globals: true,
    include: ["src/**/*.{test,spec}.{ts,tsx}", "test/**/*.{test,spec}.{ts,tsx}"],
    exclude: ["**/*.d.ts", "**/dist/**", "**/node_modules/**"],
  },
});

export default config;
