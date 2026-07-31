import { expect, test, type Page } from "@playwright/test";

/**
 * Skenario modul B. Fokus pembuktiannya ada di dua hal yang paling berisiko:
 * aturan tumpang tindih kontrak, dan pemisahan data antar perusahaan penyewa.
 *
 * Data awal berasal dari `npm run db:seed`.
 */
const KATA_SANDI = "KawasanDemo2026!";

async function masuk(page: Page, surel: string, tujuan: RegExp = /\/internal/) {
  await page.goto("/masuk");
  await page.getByTestId("input-surel").fill(surel);
  await page.getByTestId("input-kata-sandi").fill(KATA_SANDI);
  await page.getByTestId("tombol-masuk").click();
  await expect(page).toHaveURL(tujuan);
}

const unik = (awalan: string) => `${awalan}${Date.now().toString().slice(-6)}`;

/**
 * Memilih opsi berdasarkan awalan teksnya, bukan label persis. Label memuat
 * luas kavling yang terformat mengikuti bahasa, jadi mencocokkan teks penuh
 * akan rapuh terhadap perubahan format maupun pergantian bahasa.
 */
async function pilihOpsi(page: Page, testId: string, awalanTeks: string) {
  const opsi = page
    .getByTestId(testId)
    .locator("option")
    .filter({ hasText: awalanTeks })
    .first();
  const nilai = await opsi.getAttribute("value");
  expect(nilai, `opsi berawalan "${awalanTeks}" tidak ditemukan`).toBeTruthy();
  await page.getByTestId(testId).selectOption(nilai!);
}

test("admin melihat kavling, tenant, dan kontrak hasil seed", async ({ page }) => {
  await masuk(page, "admin@contoh.test");

  await page.goto("/internal/kavling");
  await expect(page.getByTestId("tabel-kavling")).toContainText("A-01");

  await page.goto("/internal/tenant");
  await expect(page.getByTestId("tabel-tenant")).toContainText("PT Baja Nusantara Sejahtera");

  await page.goto("/internal/kontrak");
  await expect(page.getByTestId("tabel-kontrak")).toContainText("SWA/2026/001");
});

test("status kavling mengikuti kontrak, bukan disunting manual", async ({ page }) => {
  await masuk(page, "admin@contoh.test");
  await page.goto("/internal/kavling");

  // A-01 disewa, A-02 terjual, A-03 baru dipesan (kontrak masih draf).
  await expect(page.getByTestId("status-A-01")).toHaveText(/Disewa/i);
  await expect(page.getByTestId("status-A-02")).toHaveText(/Terjual/i);
  await expect(page.getByTestId("status-A-03")).toHaveText(/Dipesan/i);

  // Halaman ubah kavling tidak menyediakan kolom status sama sekali.
  await page.getByTestId("ubah-A-04").click();
  await expect(page.getByTestId("judul-halaman")).toBeVisible();
  await expect(page.locator('select[name="status"]')).toHaveCount(0);
});

test("kontrak baru menautkan tenant dan kavling, lalu mengubah status kavling", async ({
  page,
}) => {
  const nomor = unik("UJI/2026/");
  const kodeKavling = unik("Z");

  await masuk(page, "admin@contoh.test");

  // Kavling baru selalu mulai dari status tersedia.
  await page.goto("/internal/kavling");
  await page.getByTestId("buka-form-tambah").click();
  await page.getByTestId("input-kode").fill(kodeKavling);
  await page.getByTestId("input-blok").fill("Z");
  await page.getByTestId("input-nomor").fill("99");
  await page.getByTestId("input-luas").fill("7000");
  await page.getByTestId("tombol-simpan").click();
  await expect(page.getByTestId(`status-${kodeKavling}`)).toHaveText(/Tersedia/i);

  // Kontrak sewa aktif pada kavling itu.
  await page.goto("/internal/kontrak");
  await page.getByTestId("buka-form-tambah").click();
  await page.getByTestId("input-nomor").fill(nomor);
  await page.getByTestId("input-jenis").selectOption("sewa");
  await pilihOpsi(page, "input-kavling", kodeKavling);
  await page.getByTestId("input-tanggal-mulai").fill("2026-01-01");
  await page.getByTestId("input-tanggal-berakhir").fill("2027-12-31");
  await page.getByTestId("tombol-simpan").click();
  await expect(page.getByTestId("tabel-kontrak")).toContainText(nomor);

  // Kontrak masih draf, jadi kavling berpindah ke "dipesan".
  await page.goto("/internal/kavling");
  await expect(page.getByTestId(`status-${kodeKavling}`)).toHaveText(/Dipesan/i);

  // Setelah kontraknya diaktifkan, kavling menjadi "disewa".
  await page.goto("/internal/kontrak");
  await page.getByTestId(`ubah-${nomor}`).click();
  await page.getByTestId("input-status").selectOption("aktif");
  await page.getByTestId("tombol-simpan").click();
  await expect(page.getByTestId("pesan-berhasil")).toBeVisible();

  await page.goto("/internal/kavling");
  await expect(page.getByTestId(`status-${kodeKavling}`)).toHaveText(/Disewa/i);
});

test("kontrak kedua pada kavling yang sama dengan masa tumpang tindih ditolak", async ({
  page,
}) => {
  await masuk(page, "admin@contoh.test");
  await page.goto("/internal/kontrak");

  // A-01 sudah tersewa sepanjang 2026–2030 oleh kontrak seed.
  await page.getByTestId("buka-form-tambah").click();
  await page.getByTestId("input-nomor").fill(unik("TABRAK/"));
  await page.getByTestId("input-jenis").selectOption("sewa");
  await pilihOpsi(page, "input-kavling", "A-01");
  await page.getByTestId("input-tanggal-mulai").fill("2027-01-01");
  await page.getByTestId("input-tanggal-berakhir").fill("2028-12-31");
  await page.getByTestId("tombol-simpan").click();

  await expect(page.getByTestId("pesan-galat")).toBeVisible();
});

test("kontrak sewa tanpa tanggal berakhir ditolak", async ({ page }) => {
  await masuk(page, "admin@contoh.test");
  await page.goto("/internal/kontrak");

  await page.getByTestId("buka-form-tambah").click();
  await page.getByTestId("input-nomor").fill(unik("TGL/"));
  await page.getByTestId("input-jenis").selectOption("sewa");
  await pilihOpsi(page, "input-kavling", "B-01");
  await page.getByTestId("input-tanggal-mulai").fill("2026-01-01");
  await page.getByTestId("tombol-simpan").click();

  await expect(page.getByTestId("pesan-galat")).toBeVisible();
});

test("lampiran PDF diterima, berkas selain daftar izin ditolak", async ({ page }) => {
  await masuk(page, "admin@contoh.test");
  await page.goto("/internal/kontrak");
  await page.getByTestId("ubah-SWA/2026/001").click();

  // Berkas terlarang ditolak di sisi server, bukan sekadar oleh atribut accept.
  await page.getByTestId("input-berkas").setInputFiles({
    name: "jahat.exe",
    mimeType: "application/x-msdownload",
    buffer: Buffer.from("MZ palsu"),
  });
  await page.getByTestId("tombol-unggah").click();
  await expect(page.getByTestId("pesan-galat")).toBeVisible();

  // PDF yang sah tersimpan dan muncul di daftar lampiran.
  await page.getByTestId("input-berkas").setInputFiles({
    name: "Kontrak Sewa A-01.pdf",
    mimeType: "application/pdf",
    buffer: Buffer.from("%PDF-1.4 berkas uji"),
  });
  await page.getByTestId("tombol-unggah").click();
  await expect(page.getByTestId("pesan-berhasil")).toBeVisible();
  await expect(page.getByTestId("tabel-lampiran")).toContainText("Kontrak Sewa A-01.pdf");
});

test("staf tidak boleh membuka halaman kontrak", async ({ page }) => {
  await masuk(page, "staf@contoh.test");

  await page.goto("/internal/kontrak");
  await expect(page.getByTestId("judul-galat")).toBeVisible();
  await expect(page.getByTestId("tabel-kontrak")).toHaveCount(0);
});

test("staf boleh melihat tenant tetapi tanpa data legalitas", async ({ page }) => {
  await masuk(page, "staf@contoh.test");
  await page.goto("/internal/tenant");

  await expect(page.getByTestId("tabel-tenant")).toBeVisible();
  // Tidak ada tautan ubah, sehingga NPWP/NIB/kontak tidak dapat dijangkau.
  await expect(page.getByTestId("ubah-TNT-001")).toHaveCount(0);
  await expect(page.getByTestId("buka-form-tambah")).toHaveCount(0);
});

test("portal tenant hanya menampilkan kontrak perusahaan sendiri", async ({ page }) => {
  await masuk(page, "tenant@contoh.test", /\/portal|\/internal/);
  await page.goto("/portal");

  await expect(page.getByTestId("judul-portal")).toBeVisible();
  await expect(page.getByTestId("nama-perusahaan")).toHaveText("PT Baja Nusantara Sejahtera");

  // Kontraknya sendiri tampil.
  await expect(page.getByTestId("tabel-kontrak-saya")).toContainText("SWA/2026/001");
  // Kontrak perusahaan lain tidak pernah muncul.
  await expect(page.getByTestId("tabel-kontrak-saya")).not.toContainText("JBL/2026/002");
  await expect(page.getByTestId("tabel-kontrak-saya")).not.toContainText("SWA/2026/003");
});

test("pengguna tenant ditolak membuka area internal", async ({ page }) => {
  await masuk(page, "tenant@contoh.test", /\/portal|\/internal/);

  await page.goto("/internal/kontrak");
  await expect(page.getByTestId("tabel-kontrak")).toHaveCount(0);

  await page.goto("/internal/tenant");
  await expect(page.getByTestId("tabel-tenant")).toHaveCount(0);
});

test("tenant tidak bisa mengunduh lampiran milik perusahaan lain", async ({
  page,
  context,
}) => {
  // Admin melampirkan berkas pada kontrak milik PT Kemasan (tenant lain).
  await masuk(page, "admin@contoh.test");
  await page.goto("/internal/kontrak");
  await page.getByTestId("ubah-JBL/2026/002").click();
  await page.getByTestId("input-berkas").setInputFiles({
    name: "rahasia-kemasan.pdf",
    mimeType: "application/pdf",
    buffer: Buffer.from("%PDF-1.4 rahasia"),
  });
  await page.getByTestId("tombol-unggah").click();
  await expect(page.getByTestId("tabel-lampiran")).toContainText("rahasia-kemasan.pdf");

  const tautan = page.locator('[data-testid^="unduh-"]').first();
  const alamatBerkas = await tautan.getAttribute("href");
  expect(alamatBerkas).toBeTruthy();

  // Sesi baru sebagai tenant lain, lalu menebak alamat berkas tadi.
  await context.clearCookies();
  await masuk(page, "tenant@contoh.test", /\/portal|\/internal/);

  const respons = await page.request.get(alamatBerkas!);
  expect(respons.status()).toBe(404);
});
