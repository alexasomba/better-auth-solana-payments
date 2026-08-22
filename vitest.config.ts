import { defineConfig, type UserConfig } from "vite-plus";

const config: UserConfig = defineConfig({
  test: {
    clearMocks: true,
    globals: true,
    include: ["src/**/*.{test,spec}.{ts,tsx}", "test/**/*.{test,spec}.{ts,tsx}"],
    exclude: ["**/*.d.ts", "**/dist/**", "**/node_modules/**"],
  },
});

export default config;
