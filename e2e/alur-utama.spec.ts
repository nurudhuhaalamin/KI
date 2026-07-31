import { expect, test } from "@playwright/test";

/**
 * Skenario ini menjalankan aplikasi sungguhan di peramban. Inilah bukti yang
 * bisa dinilai tanpa membaca kode: kalau berkas ini lulus, alur masuk,
 * proteksi halaman internal, dan pergantian bahasa benar-benar bekerja.
 *
 * Akun yang dipakai berasal dari `npm run db:seed`.
 */
const AKUN = {
  surel: "admin@contoh.test",
  kataSandi: "KawasanDemo2026!",
};

test("beranda tampil dan memuat tautan masuk", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByTestId("judul-beranda")).toBeVisible();
  await expect(page.getByRole("link", { name: /masuk/i }).first()).toBeVisible();
});

test("halaman internal menolak pengunjung yang belum masuk", async ({ page }) => {
  await page.goto("/internal");

  // Dialihkan ke halaman masuk, dengan tujuan semula dibawa di ?lanjut=
  await expect(page).toHaveURL(/\/masuk\?lanjut=%2Finternal/);
  await expect(page.getByTestId("judul-masuk")).toBeVisible();
});

test("kata sandi salah ditolak dengan pesan umum", async ({ page }) => {
  await page.goto("/masuk");

  await page.getByTestId("input-surel").fill(AKUN.surel);
  await page.getByTestId("input-kata-sandi").fill("kata-sandi-yang-salah");
  await page.getByTestId("tombol-masuk").click();

  await expect(page.getByTestId("galat-masuk")).toBeVisible();
  await expect(page).toHaveURL(/\/masuk/);
});

test("masuk berhasil, dasbor terbuka, lalu keluar", async ({ page }) => {
  await page.goto("/masuk");

  await page.getByTestId("input-surel").fill(AKUN.surel);
  await page.getByTestId("input-kata-sandi").fill(AKUN.kataSandi);
  await page.getByTestId("tombol-masuk").click();

  await expect(page).toHaveURL(/\/internal/);
  await expect(page.getByTestId("judul-dasbor")).toBeVisible();
  await expect(page.getByTestId("nama-pengguna")).toHaveText("Administrator Demo");
  await expect(page.getByTestId("peran-pengguna")).toHaveText("admin");

  await page.getByTestId("tombol-keluar").click();
  await expect(page).toHaveURL("/");

  // Sesi benar-benar berakhir: halaman internal kembali tertutup.
  await page.goto("/internal");
  await expect(page).toHaveURL(/\/masuk/);
});

test("pengguna bisa mengganti bahasa dan pilihannya bertahan", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByTestId("judul-beranda")).toHaveText(
    "Sistem Tata Kelola & Operasional Kawasan Industri",
  );

  await page.getByTestId("bahasa-en").click();
  await expect(page.getByTestId("judul-beranda")).toHaveText(
    "Industrial Estate Governance & Operations System",
  );
  await expect(page.locator("html")).toHaveAttribute("lang", "en");

  // Pilihan tersimpan di cookie: buka halaman lain tanpa ?lang=, tetap Inggris.
  await page.goto("/masuk");
  await expect(page.getByTestId("judul-masuk")).toHaveText("Sign in");
});
