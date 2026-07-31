import { defineConfig, devices } from "@playwright/test";

const PORT = 5173;
const baseURL = `http://localhost:${PORT}`;

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",

  use: {
    baseURL,
    // Jejak direkam saat percobaan pertama gagal, sehingga kegagalan di CI
    // bisa ditonton ulang langkah demi langkah tanpa menjalankan ulang.
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    locale: "id-ID",
  },

  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        // Biasanya kosong: Playwright memakai peramban yang diunduhnya sendiri
        // lewat `npx playwright install`. Isi PLAYWRIGHT_CHROMIUM_PATH hanya
        // bila lingkungan sudah menyediakan Chromium sendiri (mis. kontainer CI).
        launchOptions: { executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH || undefined },
      },
    },
  ],

  webServer: {
    command: `npm run dev -- --port ${PORT}`,
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    stdout: "pipe",
    stderr: "pipe",
  },
});
