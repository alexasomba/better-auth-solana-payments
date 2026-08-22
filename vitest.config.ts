import { defineConfig, type UserConfig } from "vite-plus";

const config: UserConfig = defineConfig({
  test: {
    clearMocks: true,
    globals: true,
    exclude: ["**/*.d.ts", "**/dist/**", "**/node_modules/**"],
  },
});

export default config;
