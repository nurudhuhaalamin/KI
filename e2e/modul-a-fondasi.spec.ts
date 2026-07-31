import { expect, test, type Page } from "@playwright/test";

/**
 * Skenario modul A. Membuktikan tanpa membaca kode bahwa pengelolaan
 * organisasi, pengguna, hak akses, dan jejak audit benar-benar bekerja.
 *
 * Akun berasal dari `npm run db:seed`.
 */
const KATA_SANDI = "KawasanDemo2026!";

async function masuk(page: Page, surel: string) {
  await page.goto("/masuk");
  await page.getByTestId("input-surel").fill(surel);
  await page.getByTestId("input-kata-sandi").fill(KATA_SANDI);
  await page.getByTestId("tombol-masuk").click();
  await expect(page).toHaveURL(/\/internal/);
}

/** Kode unik per pengujian agar test yang berjalan berulang tidak bentrok. */
function kodeUnik(awalan: string) {
  return `${awalan}${Date.now().toString().slice(-6)}`;
}

test("dasbor menampilkan ringkasan organisasi", async ({ page }) => {
  await masuk(page, "admin@contoh.test");

  await expect(page.getByTestId("judul-dasbor")).toBeVisible();

  // Seed memuat 4 unit kerja dan 6 jabatan. Dibandingkan sebagai "minimal"
  // karena skenario lain di berkas ini ikut menambah data ke database yang sama.
  const unit = Number(await page.getByTestId("hitung-unit-kerja").textContent());
  const jabatan = Number(await page.getByTestId("hitung-jabatan").textContent());
  expect(unit).toBeGreaterThanOrEqual(4);
  expect(jabatan).toBeGreaterThanOrEqual(6);
});

test("menu samping menyesuaikan peran pengguna", async ({ page }) => {
  await masuk(page, "admin@contoh.test");
  await expect(page.getByTestId("menu-unitKerja")).toBeVisible();
  await expect(page.getByTestId("menu-pengguna")).toBeVisible();
  await expect(page.getByTestId("menu-jejakAudit")).toBeVisible();

  await page.getByTestId("tombol-keluar").click();
  await expect(page).toHaveURL("/");

  // Staf tidak berurusan dengan manajemen pengguna maupun jejak audit.
  await masuk(page, "staf@contoh.test");
  await expect(page.getByTestId("menu-unitKerja")).toBeVisible();
  await expect(page.getByTestId("menu-pengguna")).toHaveCount(0);
  await expect(page.getByTestId("menu-jejakAudit")).toHaveCount(0);
});

test("staf ditolak saat memaksa membuka halaman pengguna", async ({ page }) => {
  await masuk(page, "staf@contoh.test");

  // Menyembunyikan menu saja bukan pengamanan; alamatnya diketik langsung.
  await page.goto("/internal/pengguna");
  await expect(page.getByTestId("judul-galat")).toBeVisible();
  await expect(page.getByTestId("tabel-pengguna")).toHaveCount(0);
});

test("staf hanya bisa melihat unit kerja, tanpa formulir tambah", async ({ page }) => {
  await masuk(page, "staf@contoh.test");
  await page.goto("/internal/unit-kerja");

  await expect(page.getByTestId("tabel-unit-kerja")).toBeVisible();
  await expect(page.getByTestId("buka-form-tambah")).toHaveCount(0);
});

test("admin menambah unit kerja lalu jabatan di dalamnya", async ({ page }) => {
  const kodeUnit = kodeUnik("UJI");
  const kodeJabatan = kodeUnik("JUJI");

  await masuk(page, "admin@contoh.test");

  await page.goto("/internal/unit-kerja");
  await page.getByTestId("buka-form-tambah").click();
  await page.getByTestId("input-kode").fill(kodeUnit);
  await page.getByTestId("input-nama").fill("Unit Pengujian");
  await page.getByTestId("tombol-simpan").click();

  await expect(page.getByTestId("tabel-unit-kerja")).toContainText(kodeUnit);

  await page.goto("/internal/jabatan");
  await page.getByTestId("buka-form-tambah").click();
  await page.getByTestId("input-kode").fill(kodeJabatan);
  await page.getByTestId("input-nama").fill("Jabatan Pengujian");
  await page
    .getByTestId("input-unit-kerja")
    .selectOption({ label: `${kodeUnit} — Unit Pengujian` });
  await page.getByTestId("tombol-simpan").click();

  await expect(page.getByTestId("tabel-jabatan")).toContainText(kodeJabatan);
});

test("kode unit kerja tidak boleh kembar", async ({ page }) => {
  await masuk(page, "admin@contoh.test");
  await page.goto("/internal/unit-kerja");

  await page.getByTestId("buka-form-tambah").click();
  await page.getByTestId("input-kode").fill("DIR"); // sudah ada dari seed
  await page.getByTestId("input-nama").fill("Duplikat");
  await page.getByTestId("tombol-simpan").click();

  await expect(page.getByTestId("pesan-galat")).toBeVisible();
});

test("unit kerja tidak bisa dijadikan bawahan dirinya sendiri", async ({ page }) => {
  await masuk(page, "admin@contoh.test");
  await page.goto("/internal/unit-kerja");

  // DIR adalah induk dari OPS. Menjadikan OPS sebagai induk DIR akan menutup gelung.
  await page.getByTestId("ubah-DIR").click();
  await expect(page.getByTestId("judul-halaman")).toBeVisible();
  await page.getByTestId("input-induk").selectOption({ label: "OPS — Operasional Kawasan" });
  await page.getByTestId("tombol-simpan").click();

  await expect(page.getByTestId("pesan-galat")).toBeVisible();
});

test("admin membuat pengguna baru yang langsung bisa masuk", async ({ page }) => {
  const surel = `uji${Date.now().toString().slice(-8)}@contoh.test`;

  await masuk(page, "admin@contoh.test");
  await page.goto("/internal/pengguna");

  await page.getByTestId("buka-form-tambah").click();
  await page.getByTestId("input-nama").fill("Pengguna Uji");
  await page.getByTestId("input-surel").fill(surel);
  await page.getByTestId("input-kata-sandi").fill(KATA_SANDI);
  await page.getByTestId("input-peran").selectOption("staf");
  await page.getByTestId("tombol-simpan").click();

  await expect(page.getByTestId("tabel-pengguna")).toContainText(surel);

  await page.getByTestId("tombol-keluar").click();
  await masuk(page, surel);
  await expect(page.getByTestId("nama-pengguna")).toHaveText("Pengguna Uji");
});

test("administrator aktif terakhir tidak bisa diturunkan perannya", async ({ page }) => {
  await masuk(page, "admin@contoh.test");
  await page.goto("/internal/pengguna");

  await page.getByTestId("ubah-admin@contoh.test").click();
  await page.getByTestId("input-peran").selectOption("staf");
  await page.getByTestId("tombol-simpan").click();

  await expect(page.getByTestId("pesan-galat")).toBeVisible();
});

test("perubahan tercatat di jejak audit", async ({ page }) => {
  const kodeUnit = kodeUnik("AUD");

  await masuk(page, "admin@contoh.test");
  await page.goto("/internal/unit-kerja");
  await page.getByTestId("buka-form-tambah").click();
  await page.getByTestId("input-kode").fill(kodeUnit);
  await page.getByTestId("input-nama").fill("Unit Audit");
  await page.getByTestId("tombol-simpan").click();
  await expect(page.getByTestId("tabel-unit-kerja")).toContainText(kodeUnit);

  await page.goto("/internal/jejak-audit");
  await expect(page.getByTestId("tabel-jejak-audit")).toContainText(kodeUnit);
  await expect(page.getByTestId("tabel-jejak-audit")).toContainText("Administrator Demo");
});

test("profil kawasan bisa disunting dan tersimpan", async ({ page }) => {
  const namaBaru = `Kawasan Uji ${Date.now().toString().slice(-5)}`;

  await masuk(page, "admin@contoh.test");
  await page.goto("/internal/pengaturan");

  await page.getByTestId("input-nama-kawasan").fill(namaBaru);
  await page.getByTestId("tombol-simpan").click();

  await expect(page.getByTestId("pesan-berhasil")).toBeVisible();
  await expect(page.getByTestId("input-nama-kawasan")).toHaveValue(namaBaru);
});
