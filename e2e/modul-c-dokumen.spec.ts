import { expect, test, type Page } from "@playwright/test";

/**
 * Skenario modul C. Yang paling penting dibuktikan: nomor benar-benar dibuat
 * sistem, versi lama tidak hilang, dan dokumen yang sudah disahkan tidak bisa
 * disunting diam-diam.
 */
const KATA_SANDI = "KawasanDemo2026!";

/**
 * Pembagian dokumen hasil seed, supaya skenario tidak saling merusak keadaan:
 * TK/DIR/001/2026    — hanya dibaca (bukti dokumen disahkan terkunci).
 * SOP-PLY/OPS/001/2026 — boleh diubah (revisi dan distribusi).
 * SOP-INF/LK3/001/2026 — hanya dibaca; ini yang jatuh tempo di dasbor, jadi
 *                        statusnya tidak boleh disentuh skenario lain.
 * Skenario yang butuh berkas unggahan sendiri membuat dokumen baru.
 */

async function masuk(page: Page, surel: string) {
  await page.goto("/masuk");
  await page.getByTestId("input-surel").fill(surel);
  await page.getByTestId("input-kata-sandi").fill(KATA_SANDI);
  await page.getByTestId("tombol-masuk").click();
  await expect(page).toHaveURL(/\/internal/);
}

const unik = () => Date.now().toString().slice(-6);

/** Membuat dokumen baru lalu mengembalikan nomor yang diberikan sistem. */
async function buatDokumen(page: Page, judul: string, kategori: string): Promise<string> {
  await page.goto("/internal/dokumen");
  await page.getByTestId("buka-form-tambah").click();
  await page.getByTestId("input-judul").fill(judul);
  await page.getByTestId("input-kategori").selectOption(kategori);
  await page.getByTestId("tombol-simpan").click();

  const baris = page.locator("tr", { hasText: judul }).first();
  await expect(baris).toBeVisible();
  return (await baris.locator("code").first().textContent())?.trim() ?? "";
}

test("daftar dokumen memuat hasil seed lintas kategori", async ({ page }) => {
  await masuk(page, "admin@contoh.test");
  await page.goto("/internal/dokumen");

  await expect(page.getByTestId("tabel-dokumen")).toContainText("TK/DIR/001/2026");
  await expect(page.getByTestId("tabel-dokumen")).toContainText("Kebijakan K3 Kawasan");
});

test("nomor dibuat sistem dan tidak dapat diketik", async ({ page }) => {
  await masuk(page, "admin@contoh.test");
  await page.goto("/internal/dokumen");
  await page.getByTestId("buka-form-tambah").click();

  // Tidak ada kolom nomor sama sekali pada formulir.
  await expect(page.locator('input[name="nomor"]')).toHaveCount(0);

  const nomor = await buatDokumen(page, `Uji Penomoran ${unik()}`, "k3");
  expect(nomor).toMatch(/^K3\/\d{3}\/\d{4}$|^K3\/[A-Z0-9-]+\/\d{3}\/\d{4}$/);
});

test("dua dokumen sekategori mendapat nomor urut berbeda", async ({ page }) => {
  await masuk(page, "admin@contoh.test");

  const tanda = unik();
  const pertama = await buatDokumen(page, `Urut A ${tanda}`, "pelaporan");
  const kedua = await buatDokumen(page, `Urut B ${tanda}`, "pelaporan");

  expect(pertama).not.toBe(kedua);

  const ambilUrut = (nomor: string) => Number(nomor.split("/").at(-2));
  expect(ambilUrut(kedua)).toBe(ambilUrut(pertama) + 1);
});

test("revisi menambah versi baru tanpa menghapus versi lama", async ({ page }) => {
  await masuk(page, "admin@contoh.test");
  const judul = `Uji Revisi ${unik()}`;
  await buatDokumen(page, judul, "tata-kelola");

  await page.locator("tr", { hasText: judul }).first().getByRole("link").click();
  await expect(page.getByTestId("judul-halaman")).toBeVisible();

  // Versi 1
  await page.getByTestId("input-berkas").setInputFiles({
    name: "revisi-satu.pdf",
    mimeType: "application/pdf",
    buffer: Buffer.from("%PDF-1.4 versi satu"),
  });
  await page.getByTestId("input-catatan").fill("Terbitan pertama");
  await page.getByTestId("tombol-unggah").click();
  await expect(page.getByTestId("tabel-versi")).toContainText("revisi-satu.pdf");

  // Versi 2
  await page.getByTestId("input-berkas").setInputFiles({
    name: "revisi-dua.pdf",
    mimeType: "application/pdf",
    buffer: Buffer.from("%PDF-1.4 versi dua"),
  });
  await page.getByTestId("input-catatan").fill("Penyesuaian pasal 4");
  await page.getByTestId("tombol-unggah").click();

  // Keduanya tetap ada dan sama-sama bisa diunduh.
  await expect(page.getByTestId("tabel-versi")).toContainText("revisi-satu.pdf");
  await expect(page.getByTestId("tabel-versi")).toContainText("revisi-dua.pdf");
  await expect(page.getByTestId("unduh-v1")).toBeVisible();
  await expect(page.getByTestId("unduh-v2")).toBeVisible();

  const respons = await page.request.get(
    (await page.getByTestId("unduh-v1").getAttribute("href")) ?? "",
  );
  expect(respons.status()).toBe(200);
});

test("dokumen hanya bisa disahkan setelah ditinjau dan punya berkas", async ({ page }) => {
  await masuk(page, "admin@contoh.test");
  const judul = `Uji Sahkan ${unik()}`;
  await buatDokumen(page, judul, "governance");
  await page.locator("tr", { hasText: judul }).first().getByRole("link").click();

  // Masih draf dan belum ada berkas.
  await page.getByTestId("tombol-sahkan").click();
  await expect(page.getByTestId("pesan-galat")).toBeVisible();

  // Unggah berkas — statusnya tetap draf.
  await page.getByTestId("input-berkas").setInputFiles({
    name: "pedoman.pdf",
    mimeType: "application/pdf",
    buffer: Buffer.from("%PDF-1.4 pedoman"),
  });
  await page.getByTestId("tombol-unggah").click();
  await expect(page.getByTestId("status-dokumen")).toHaveText(/Draf/i);

  // Masih ditolak karena belum ditinjau.
  await page.getByTestId("tombol-sahkan").click();
  await expect(page.getByTestId("pesan-galat")).toBeVisible();

  // Setelah ditinjau, pengesahan berhasil.
  await page.getByTestId("input-status").selectOption("ditinjau");
  await page.getByTestId("tombol-simpan").click();
  await expect(page.getByTestId("status-dokumen")).toHaveText(/Ditinjau/i);

  await page.getByTestId("tombol-sahkan").click();
  await expect(page.getByTestId("status-dokumen")).toHaveText(/Disahkan/i);
});

test("dokumen yang sudah disahkan tidak dapat disunting isinya", async ({ page }) => {
  await masuk(page, "admin@contoh.test");
  await page.goto("/internal/dokumen");

  // TK/DIR/001/2026 sudah berstatus disahkan dari seed.
  await page.locator("tr", { hasText: "TK/DIR/001/2026" }).first().getByRole("link").click();
  await expect(page.getByTestId("status-dokumen")).toHaveText(/Disahkan/i);

  await expect(page.getByTestId("peringatan-terkunci")).toBeVisible();
  await expect(page.getByTestId("input-judul")).toBeDisabled();
  await expect(page.getByTestId("tombol-simpan")).toBeDisabled();
});

test("revisi pada dokumen yang sudah disahkan mengembalikannya ke draf", async ({ page }) => {
  await masuk(page, "admin@contoh.test");
  await page.goto("/internal/dokumen");
  await page
    .locator("tr", { hasText: "SOP-PLY/OPS/001/2026" })
    .first()
    .getByRole("link")
    .click();
  await expect(page.getByTestId("status-dokumen")).toHaveText(/Disahkan/i);

  await page.getByTestId("input-berkas").setInputFiles({
    name: "pelayanan-revisi.pdf",
    mimeType: "application/pdf",
    buffer: Buffer.from("%PDF-1.4 pelayanan"),
  });
  await page.getByTestId("tombol-unggah").click();

  // Isinya berubah, jadi wajib ditinjau ulang sebelum berlaku lagi.
  await expect(page.getByTestId("status-dokumen")).toHaveText(/Draf/i);
  await expect(page.getByTestId("peringatan-terkunci")).toHaveCount(0);
});

test("staf boleh melihat dokumen tetapi tidak boleh mengesahkan", async ({ page }) => {
  await masuk(page, "staf@contoh.test");
  await page.goto("/internal/dokumen");

  await expect(page.getByTestId("tabel-dokumen")).toBeVisible();
  await expect(page.getByTestId("buka-form-tambah")).toHaveCount(0);

  await page.locator("tr", { hasText: "TK/DIR/001/2026" }).first().getByRole("link").click();
  await expect(page.getByTestId("tabel-versi")).toBeVisible();
  await expect(page.getByTestId("tombol-sahkan")).toHaveCount(0);
  await expect(page.getByTestId("form-revisi")).toHaveCount(0);
});

test("distribusi salinan terkendali tercatat beserta versinya", async ({ page }) => {
  await masuk(page, "admin@contoh.test");
  await page.goto("/internal/dokumen");
  await page
    .locator("tr", { hasText: "SOP-PLY/OPS/001/2026" })
    .first()
    .getByRole("link")
    .click();

  await page.getByTestId("input-unit-distribusi").selectOption({ index: 0 });
  await page.getByTestId("tombol-distribusi").click();

  await expect(page.getByTestId("tabel-distribusi")).toBeVisible();
  await expect(page.getByTestId("tabel-distribusi")).not.toContainText("Belum ada data");
});

test("dokumen yang jatuh tempo tinjau ulang muncul di dasbor", async ({ page }) => {
  await masuk(page, "admin@contoh.test");

  // Seed memuat satu dokumen yang sudah lewat tanggal tinjau ulang.
  await expect(page.getByTestId("kartu-jatuh-tempo")).toBeVisible();
  await expect(page.getByTestId("kartu-jatuh-tempo")).toContainText("SOP-INF/LK3/001/2026");

  // Tautannya menuju dokumen yang bersangkutan.
  await page.getByTestId("kartu-jatuh-tempo").getByRole("link").first().click();
  await expect(page.getByTestId("nomor-dokumen")).toBeVisible();
});

test("tenant tidak bisa mengunduh berkas dokumen internal", async ({ page, context }) => {
  await masuk(page, "admin@contoh.test");

  // Dokumen dibuat sendiri agar berkasnya pasti versi 1 dan tidak bergantung
  // pada skenario lain.
  const judul = `Uji Akses ${unik()}`;
  await buatDokumen(page, judul, "sop-keamanan");
  await page.locator("tr", { hasText: judul }).first().getByRole("link").click();

  await page.getByTestId("input-berkas").setInputFiles({
    name: "sop-internal.pdf",
    mimeType: "application/pdf",
    buffer: Buffer.from("%PDF-1.4 internal"),
  });
  await page.getByTestId("tombol-unggah").click();

  const alamat = await page.getByTestId("unduh-v1").getAttribute("href");
  expect(alamat).toBeTruthy();

  await context.clearCookies();
  await page.goto("/masuk");
  await page.getByTestId("input-surel").fill("tenant@contoh.test");
  await page.getByTestId("input-kata-sandi").fill(KATA_SANDI);
  await page.getByTestId("tombol-masuk").click();
  await expect(page).toHaveURL(/\/portal/);

  const respons = await page.request.get(alamat!);
  expect(respons.status()).toBe(404);
});
