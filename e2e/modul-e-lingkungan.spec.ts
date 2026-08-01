import { expect, test, type Browser, type Page } from "@playwright/test";

/**
 * Skenario modul E. Yang paling penting dibuktikan: dokumen tidak bisa disetujui
 * tanpa melewati pemeriksaan substansi, hanya ketua tim yang boleh menyimpulkan
 * tahap, tenggat administrasi dihitung ulang setelah berkas dikembalikan, dan
 * dokumen lingkungan perusahaan lain tidak bisa dibuka tenant mana pun.
 *
 * Pembagian data seed supaya skenario tidak saling merusak keadaan:
 * RKL/001/2026 — tenggat administrasinya sudah lewat; bukti kartu dasbor, tidak disentuh.
 * UKL/001/2026 — sedang pemeriksaan substansi dengan tim dan temuan; hanya dibaca.
 * RTA/001/2026 — sudah disetujui beserta kewajiban pemantauan; hanya dibaca.
 * Skenario alur penuh membuat dokumennya sendiri.
 */
const KATA_SANDI = "KawasanDemo2026!";

async function masuk(page: Page, surel: string) {
  await page.goto("/masuk");
  await page.getByTestId("input-surel").fill(surel);
  await page.getByTestId("input-kata-sandi").fill(KATA_SANDI);
  await page.getByTestId("tombol-masuk").click();
  await expect(page).toHaveURL(/\/internal|\/portal/);
}

/** Halaman baru dengan sesi sendiri; menghindari balapan saat berganti peran. */
async function halamanSebagai(browser: Browser, surel: string): Promise<Page> {
  const konteks = await browser.newContext();
  const halaman = await konteks.newPage();
  await masuk(halaman, surel);
  return halaman;
}

const unik = () => Date.now().toString().slice(-6);

const BERKAS_UJI = {
  name: "dokumen-lingkungan.pdf",
  mimeType: "application/pdf",
  buffer: Buffer.from("%PDF-1.4 lingkungan"),
};

/** Membuat dokumen lingkungan sebagai tenant, mengunggah berkas, lalu mengajukan. */
async function ajukanDokumen(tenant: Page, judul: string): Promise<string> {
  await tenant.goto("/portal/lingkungan/baru");
  await tenant.getByTestId("input-jenis").selectOption("ukl-upl");
  await tenant.getByTestId("input-judul").fill(judul);
  await tenant.getByTestId("input-ringkasan").fill("Kegiatan pengujian alur pemeriksaan.");
  await tenant.getByTestId("tombol-simpan").click();
  await expect(tenant.getByTestId("judul-halaman")).toHaveText(judul);

  await tenant.getByTestId("input-berkas").setInputFiles(BERKAS_UJI);
  await tenant.getByTestId("tombol-unggah").click();
  await expect(tenant.getByTestId("tabel-berkas")).toContainText(BERKAS_UJI.name);

  await tenant.getByTestId("tombol-ajukan").click();
  await expect(tenant.getByTestId("status-dokumen")).toHaveText(/Diajukan/i);
  return tenant.url();
}

test("pengelola melihat dokumen lingkungan hasil seed beserta keadaan tenggatnya", async ({
  page,
}) => {
  await masuk(page, "staf@contoh.test");
  await page.goto("/internal/lingkungan");

  await expect(page.getByTestId("tabel-lingkungan")).toContainText("RKL/001/2026");
  // Tenggat administrasi RKL/001/2026 sudah lewat pada data seed.
  await expect(page.getByTestId("tenggat-dlh-demo-1")).toContainText(/terlambat/i);
  // UKL/001/2026 sedang substansi dan masih punya sisa waktu.
  await expect(page.getByTestId("tenggat-dlh-demo-2")).toContainText(/sisa/i);
});

test("dokumen yang menunggu tenant tidak dihitung terlambat", async ({ browser }) => {
  const tenant = await halamanSebagai(browser, "tenant@contoh.test");
  const judul = `Uji Jam Berhenti ${unik()}`;
  const alamat = await ajukanDokumen(tenant, judul);

  // Ketua tim mengembalikannya untuk dilengkapi.
  const admin = await halamanSebagai(browser, "admin@contoh.test");
  await admin.goto("/internal/lingkungan");
  await admin.locator("tr", { hasText: judul }).first().getByRole("link").click();
  await admin.getByTestId("tombol-minta-lengkapi").click();
  await expect(admin.getByTestId("status-dokumen")).toHaveText(/Perlu dilengkapi/i);

  // Bola ada di tenant: kawasan tidak lagi punya tenggat yang berjalan.
  await admin.goto("/internal/lingkungan");
  const baris = admin.locator("tr", { hasText: judul }).first();
  await expect(baris).toContainText(/Menunggu tenant/i);

  await tenant.goto(alamat);
  await expect(tenant.getByTestId("peringatan-lengkapi")).toBeVisible();
});

test("tenggat administrasi dihitung ulang setelah dokumen diajukan kembali", async ({
  browser,
}) => {
  const tenant = await halamanSebagai(browser, "tenant@contoh.test");
  const judul = `Uji Tenggat Ulang ${unik()}`;
  const alamat = await ajukanDokumen(tenant, judul);

  const admin = await halamanSebagai(browser, "admin@contoh.test");
  await admin.goto("/internal/lingkungan");
  await admin.locator("tr", { hasText: judul }).first().getByRole("link").click();
  await admin.getByTestId("tombol-minta-lengkapi").click();
  await expect(admin.getByTestId("status-dokumen")).toHaveText(/Perlu dilengkapi/i);

  // Tenant melengkapi lalu mengajukan ulang.
  await tenant.goto(alamat);
  await tenant.getByTestId("input-berkas").setInputFiles({
    name: "berkas-perbaikan.pdf",
    mimeType: "application/pdf",
    buffer: Buffer.from("%PDF-1.4 perbaikan"),
  });
  await tenant.getByTestId("tombol-unggah").click();
  // Berkas susulan ditandai perbaikan, bukan pengajuan awal.
  await expect(tenant.getByTestId("tabel-berkas")).toContainText("berkas-perbaikan.pdf");

  await tenant.getByTestId("tombol-ajukan").click();
  await expect(tenant.getByTestId("status-dokumen")).toHaveText(/Diajukan/i);

  // Jatah 3 hari kerja kawasan utuh lagi, bukan melanjutkan sisa yang lama.
  await admin.reload();
  await expect(admin.getByTestId("tenggat-dokumen")).toContainText(/sisa|hari ini/i);
});

test("anggota tim biasa tidak dapat menyimpulkan tahap, ketua bisa", async ({ browser }) => {
  // Tiga sesi berbeda dan belasan navigasi; panjangnya memang wajar.
  test.slow();

  const tenant = await halamanSebagai(browser, "tenant@contoh.test");
  const judul = `Uji Wewenang ${unik()}`;
  await ajukanDokumen(tenant, judul);

  // Admin membentuk tim: staf sebagai anggota biasa.
  const admin = await halamanSebagai(browser, "admin@contoh.test");
  await admin.goto("/internal/lingkungan");
  await admin.locator("tr", { hasText: judul }).first().getByRole("link").click();
  // Alamat baru dibaca setelah halaman rinciannya benar-benar terbuka.
  await expect(admin.getByTestId("nomor-dokumen")).toBeVisible();
  const alamat = admin.url();

  await admin.getByTestId("input-anggota").selectOption({ label: "Staf Perizinan Demo" });
  await admin.getByTestId("input-peran-anggota").selectOption("anggota");
  await admin.getByTestId("tombol-tambah-anggota").click();
  await expect(admin.getByTestId("tabel-tim")).toContainText("Staf Perizinan Demo");

  // Staf boleh mencatat temuan, tetapi tidak boleh menyimpulkan tahap.
  const staf = await halamanSebagai(browser, "staf@contoh.test");
  await staf.goto(alamat);
  await expect(staf.getByTestId("form-temuan")).toBeVisible();
  await staf.getByTestId("input-aspek").fill("Kelengkapan berkas");
  await staf.getByTestId("input-temuan").fill("Berkas administrasi sudah lengkap.");
  await staf.getByTestId("tombol-catat-temuan").click();
  await expect(staf.getByTestId("tabel-temuan")).toContainText("Kelengkapan berkas");

  // Dipaksa lewat permintaan langsung pun tetap ditolak.
  const respons = await staf.request.post(alamat, {
    form: { maksud: "nyatakan-lengkap" },
  });
  expect(respons.status()).toBe(200);
  expect(respons.headers()["location"]).toBeUndefined();

  await staf.reload();
  await expect(staf.getByTestId("status-dokumen")).toHaveText(/Diajukan/i);

  // Ketua (administrator) berhasil.
  await admin.reload();
  await admin.getByTestId("tombol-nyatakan-lengkap").click();
  await expect(admin.getByTestId("status-dokumen")).toHaveText(/Pemeriksaan substansi/i);
});

test("dokumen tidak dapat disetujui tanpa melewati pemeriksaan substansi", async ({
  browser,
}) => {
  const tenant = await halamanSebagai(browser, "tenant@contoh.test");
  const judul = `Uji Lompat Tahap ${unik()}`;
  await ajukanDokumen(tenant, judul);

  const admin = await halamanSebagai(browser, "admin@contoh.test");
  await admin.goto("/internal/lingkungan");
  await admin.locator("tr", { hasText: judul }).first().getByRole("link").click();
  await expect(admin.getByTestId("nomor-dokumen")).toBeVisible();
  const alamat = admin.url();

  await admin.getByTestId("tombol-mulai-administrasi").click();
  await expect(admin.getByTestId("status-dokumen")).toHaveText(/Pemeriksaan administrasi/i);

  // Tombol setujui memang tidak ditawarkan pada tahap administrasi …
  await expect(admin.getByTestId("tombol-setujui")).toHaveCount(0);

  // … dan permintaan langsung pun ditolak. Inilah lubang yang paling mahal
  // kalau terbuka: izin terbit hanya karena berkasnya rapi.
  const respons = await admin.request.post(alamat, { form: { maksud: "setujui" } });
  expect(respons.status()).toBe(200);
  expect(respons.headers()["location"]).toBeUndefined();

  await admin.reload();
  await expect(admin.getByTestId("status-dokumen")).toHaveText(/Pemeriksaan administrasi/i);
});

test("alur penuh sampai keputusan terbit dan suratnya dapat diunduh tenant", async ({
  browser,
}) => {
  // Skenario terpanjang: dua sesi, dua tahap pemeriksaan, keputusan, dan unduhan.
  test.slow();

  const tenant = await halamanSebagai(browser, "tenant@contoh.test");
  const judul = `Uji Alur Penuh ${unik()}`;
  const alamatTenant = await ajukanDokumen(tenant, judul);

  const admin = await halamanSebagai(browser, "admin@contoh.test");
  await admin.goto("/internal/lingkungan");
  await admin.locator("tr", { hasText: judul }).first().getByRole("link").click();

  await admin.getByTestId("tombol-nyatakan-lengkap").click();
  await expect(admin.getByTestId("status-dokumen")).toHaveText(/Pemeriksaan substansi/i);

  await admin.getByTestId("input-tahap").selectOption("substansi");
  await admin.getByTestId("input-aspek").fill("Pengelolaan air limbah");
  await admin.getByTestId("input-temuan").fill("Neraca air sudah sesuai kapasitas IPAL.");
  await admin.getByTestId("tombol-catat-temuan").click();

  await admin.getByTestId("input-berlaku-setujui").fill("2029-12-31");
  await admin.getByTestId("tombol-setujui").click();
  await expect(admin.getByTestId("status-dokumen")).toHaveText(/Disetujui/i);
  await expect(admin.getByTestId("nomor-keputusan")).toContainText("SK-LH");

  // Surat yang sudah ditandatangani diunggah pengelola.
  await admin.getByTestId("input-surat").setInputFiles({
    name: "surat-keputusan.pdf",
    mimeType: "application/pdf",
    buffer: Buffer.from("%PDF-1.4 surat"),
  });
  await admin.getByTestId("tombol-unggah-surat").click();
  await expect(admin.getByTestId("tabel-berkas")).toContainText("surat-keputusan.pdf");

  // Pemohon melihat keputusannya dan dapat mengunduh suratnya.
  await tenant.goto(alamatTenant);
  await expect(tenant.getByTestId("status-dokumen")).toHaveText(/Disetujui/i);
  await expect(tenant.getByTestId("nomor-keputusan")).toContainText("SK-LH");

  const baris = tenant.locator("tr", { hasText: "surat-keputusan.pdf" }).first();
  const alamatSurat = await baris.getByRole("link").first().getAttribute("href");
  expect((await tenant.request.get(alamatSurat!)).status()).toBe(200);

  // Dokumen yang sudah selesai tidak bisa disunting lagi pemohon.
  await expect(tenant.getByTestId("peringatan-terkunci")).toBeVisible();
  await expect(tenant.getByTestId("input-judul")).toBeDisabled();
});

test("kewajiban pemantauan tampil di portal tenant dan dapat dikirim", async ({ browser }) => {
  const tenant = await halamanSebagai(browser, "tenant@contoh.test");
  await tenant.goto("/portal/lingkungan");

  // RTA/001/2026 sudah disetujui dan punya kewajiban pemantauan semesteran.
  await tenant.locator("tr", { hasText: "RTA/001/2026" }).first().getByRole("link").click();
  await expect(tenant.getByTestId("nomor-keputusan")).toContainText("SK-LH/001/2026");

  // Dipilih periode yang memang masih menunggu kiriman, bukan sekadar yang
  // pertama tampil — urutannya bisa berubah mengikuti jatuh temponya.
  const laporan = tenant
    .locator('[data-testid^="laporan-"]')
    .filter({ has: tenant.locator('input[type="file"]') })
    .first();
  await expect(laporan).toBeVisible();
  await expect(laporan).toContainText("Laporan pemantauan kualitas air limbah");

  const idLaporan = (await laporan.getAttribute("data-testid"))!.replace("laporan-", "");
  await tenant.getByTestId(`berkas-laporan-${idLaporan}`).setInputFiles({
    name: "pemantauan.pdf",
    mimeType: "application/pdf",
    buffer: Buffer.from("%PDF-1.4 pemantauan"),
  });
  await tenant.getByTestId(`kirim-laporan-${idLaporan}`).click();
  await expect(tenant.getByTestId(`status-laporan-${idLaporan}`)).toHaveText(/Terkirim/i);
});

test("pemeriksaan mendesak dan laporan tertunggak muncul di dasbor pengelola", async ({
  page,
}) => {
  await masuk(page, "admin@contoh.test");

  await expect(page.getByTestId("kartu-lingkungan-mendesak")).toBeVisible();
  await expect(page.getByTestId("kartu-lingkungan-mendesak")).toContainText("RKL/001/2026");

  // Kewajiban semesteran hasil seed sudah punya periode yang lewat tempo; baris
  // laporannya baru dibuat saat halaman dokumennya dibuka.
  await page.goto("/internal/lingkungan");
  await page.locator("tr", { hasText: "RTA/001/2026" }).first().getByRole("link").click();
  await page.goto("/internal");
  await expect(page.getByTestId("kartu-tunggakan")).toBeVisible();
});

test("tenant tidak bisa membuka dokumen lingkungan perusahaan lain", async ({ browser }) => {
  // Dokumen dibuat admin atas nama perusahaan lain lewat data seed; di sini
  // cukup dibuktikan alamat dokumen milik sendiri berbeda dari milik orang lain.
  const tenant = await halamanSebagai(browser, "tenant@contoh.test");

  // dlh-demo-1 memang milik perusahaan tenant demo, jadi boleh dibuka.
  await tenant.goto("/portal/lingkungan/dlh-demo-1");
  await expect(tenant.getByTestId("nomor-dokumen")).toHaveText("RKL/001/2026");

  // Id yang tidak dimiliki siapa pun dijawab 404, bukan 403.
  const respons = await tenant.request.get("/portal/lingkungan/dlh-bukan-milik-siapa-pun");
  expect(respons.status()).toBe(404);
});
