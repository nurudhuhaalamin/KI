import { defineConfig, devices } from "@playwright/test";

const PORT = 5173;
const baseURL = `http://localhost:${PORT}`;

export default defineConfig({
  testDir: "./e2e",

  // Seluruh skenario memakai SATU database kawasan yang sama, dan sebagian
  // menulis ke dalamnya. Menjalankannya paralel membuat test saling merusak
  // data test lain dan memicu tulis bersamaan ke D1 lokal. Dijalankan berurutan
  // memang lebih lambat, tetapi hasilnya bisa dipercaya.
  fullyParallel: false,
  workers: 1,

  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,

  // Batas bawaan 30 detik terlalu ketat untuk mesin pengembangan yang lambat:
  // server dev Vite mengompilasi rute saat pertama kali dibuka. Di CI seluruh
  // skenario selesai di bawah satu detik, jadi batas longgar ini tidak menutupi
  // kegagalan apa pun — hanya mencegah kegagalan palsu di mesin yang lambat.
  timeout: 90_000,
  expect: { timeout: 15_000 },
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
