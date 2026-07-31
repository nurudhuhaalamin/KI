import { fileURLToPath } from "node:url";

import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "~": fileURLToPath(new URL("./app", import.meta.url)),
    },
  },
  test: {
    // Test unit untuk logika murni. Alur yang menyentuh database dan sesi
    // diuji lewat Playwright di folder e2e/ dengan aplikasi sungguhan.
    include: ["app/**/*.test.ts", "app/**/*.test.tsx", "scripts/**/*.test.ts"],
    environment: "node",
    restoreMocks: true,
  },
});
