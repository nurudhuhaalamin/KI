import { expect, test, type Browser, type Page } from "@playwright/test";

/**
 * Skenario modul D. Yang paling penting dibuktikan: bentuk formulir benar-benar
 * ditentukan data, kolom wajib ditolak SERVER (bukan hanya browser), tahap
 * persetujuan berjalan berurutan sesuai wewenang, dan permohonan perusahaan lain
 * tidak bisa dilihat tenant mana pun.
 *
 * Pembagian data seed supaya skenario tidak saling merusak keadaan:
 * IK/001/2026  — sudah lewat tenggat; dipakai bukti kartu dasbor, tidak disentuh.
 * IB/001/2026  — sedang di tahap 2 (manajemen); dipakai bukti batas wewenang.
 * IAB/001/2026 — sudah terbit; hanya dibaca.
 * IK/002/2026  — masih draf milik tenant; dipakai bukti pengajuan dan lampiran.
 * Skenario alur penuh membuat jenis izin dan permohonannya sendiri.
 */
const KATA_SANDI = "KawasanDemo2026!";

async function masuk(page: Page, surel: string) {
  await page.goto("/masuk");
  await page.getByTestId("input-surel").fill(surel);
  await page.getByTestId("input-kata-sandi").fill(KATA_SANDI);
  await page.getByTestId("tombol-masuk").click();
  await expect(page).toHaveURL(/\/internal|\/portal/);
}

const unik = () => Date.now().toString().slice(-6);

/**
 * Halaman baru dengan sesi sendiri.
 *
 * Skenario yang berganti peran beberapa kali sebelumnya memakai clearCookies
 * pada halaman yang sama; itu berlomba dengan navigasi yang sedang berjalan dan
 * membuat pengisian formulir kadang menggantung. Konteks terpisah per peran
 * menghilangkan balapan itu sepenuhnya.
 */
async function halamanSebagai(browser: Browser, surel: string): Promise<Page> {
  const konteks = await browser.newContext();
  const halaman = await konteks.newPage();
  await masuk(halaman, surel);
  return halaman;
}

/** Memilih jenis izin menurut namanya, bukan mengandalkan pilihan bawaan. */
async function pilihJenis(halaman: Page, nama: string) {
  await halaman.getByTestId("input-jenis").selectOption({ label: nama });
  await expect(halaman.getByTestId("input-jenis")).toBeEnabled();
}

test("admin melihat jenis izin hasil seed beserta tahapnya", async ({ page }) => {
  await masuk(page, "admin@contoh.test");
  await page.goto("/internal/jenis-izin");

  await expect(page.getByTestId("tabel-jenis-izin")).toContainText("IK");
  await expect(page.getByTestId("tabel-jenis-izin")).toContainText("Izin Mendirikan Bangunan");

  await page
    .locator("tr", { hasText: "Izin Mendirikan Bangunan" })
    .first()
    .getByRole("link")
    .click();
  await expect(page.getByTestId("tabel-tahap")).toContainText("Verifikasi teknis");
  await expect(page.getByTestId("tabel-tahap")).toContainText("Persetujuan manajemen");
});

test("staf tidak boleh membuka pengaturan jenis izin", async ({ page }) => {
  await masuk(page, "staf@contoh.test");
  await page.goto("/internal/jenis-izin");

  // Menyembunyikan menu bukan pengamanan; yang berlaku pemeriksaan di server.
  await expect(page.getByTestId("judul-galat")).toBeVisible();
  await expect(page.getByTestId("tabel-jenis-izin")).toHaveCount(0);
});

test("formulir pengajuan mengikuti kolom milik jenis izin yang dipilih", async ({ page }) => {
  await masuk(page, "tenant@contoh.test");
  await page.goto("/portal/permohonan/baru");
  await pilihJenis(page, "Izin Kerja Harian");

  // Izin kerja menanyakan lokasi dan risiko.
  await expect(page.getByTestId("isian-lokasi_kerja")).toBeVisible();
  await expect(page.getByTestId("isian-risiko")).toBeVisible();
  await expect(page.getByTestId("isian-kontraktor")).toHaveCount(0);

  // Berganti jenis izin mengganti pertanyaannya.
  await page
    .getByTestId("input-jenis")
    .selectOption({ label: "Izin Mendirikan Bangunan Kavling" });
  await expect(page.getByTestId("isian-kontraktor")).toBeVisible();
  await expect(page.getByTestId("isian-lokasi_kerja")).toHaveCount(0);
});

test("kolom wajib yang kosong ditolak server, bukan hanya browser", async ({ page }) => {
  await masuk(page, "tenant@contoh.test");
  await page.goto("/portal/permohonan/baru");

  // Dikirim langsung tanpa lewat formulir, persis seperti permintaan yang dibuat
  // sendiri oleh pemohon yang mengakali tampilan.
  const respons = await page.request.post("/portal/permohonan/baru", {
    form: {
      jenisIzinId: "jzn-demo-kerja",
      judul: `Uji Validasi ${unik()}`,
      lokasi_kerja: "",
      jumlah_pekerja: "bukan angka",
      risiko: "sangat-tinggi",
    },
  });

  // Ditolak: tidak ada pengalihan ke halaman rincian.
  expect(respons.status()).toBe(200);
  expect(respons.headers()["location"]).toBeUndefined();
});

test("tenant mengajukan permohonan dan nomornya dibuat sistem", async ({ page }) => {
  await masuk(page, "tenant@contoh.test");
  await page.goto("/portal/permohonan/baru");
  await pilihJenis(page, "Izin Kerja Harian");

  const judul = `Pemasangan panel surya ${unik()}`;
  await page.getByTestId("input-judul").fill(judul);
  await page.getByTestId("isian-lokasi_kerja").fill("Atap gudang C");
  await page.getByTestId("isian-jumlah_pekerja").fill("4");
  await page.getByTestId("isian-tanggal_mulai").fill("2026-09-01");
  await page.getByTestId("isian-risiko").selectOption("sedang");
  await page.getByTestId("tombol-simpan").click();

  await expect(page.getByTestId("judul-halaman")).toHaveText(judul);
  await expect(page.getByTestId("nomor-permohonan")).toHaveText(/^IK\//);
  await expect(page.getByTestId("status-permohonan")).toHaveText(/Draf/i);

  // Diajukan: tenggat muncul dan statusnya berubah.
  await page.getByTestId("tombol-ajukan").click();
  await expect(page.getByTestId("status-permohonan")).toHaveText(/Diajukan/i);
});

test("permohonan yang sudah diajukan tidak dapat disunting tenant", async ({ page }) => {
  await masuk(page, "tenant@contoh.test");
  await page.goto("/portal/permohonan");

  await page.locator("tr", { hasText: "IB/001/2026" }).first().getByRole("link").click();
  await expect(page.getByTestId("status-permohonan")).toHaveText(/Diproses/i);

  await expect(page.getByTestId("peringatan-terkunci")).toBeVisible();
  await expect(page.getByTestId("input-judul")).toBeDisabled();
  await expect(page.getByTestId("form-lampiran")).toHaveCount(0);
});

test("antrean pengelola menampilkan sisa dan keterlambatan tenggat", async ({ page }) => {
  await masuk(page, "staf@contoh.test");
  await page.goto("/internal/permohonan");

  await expect(page.getByTestId("tabel-permohonan")).toContainText("IK/001/2026");
  // IK/001/2026 sudah lewat tenggat pada data seed.
  await expect(page.getByTestId("tenggat-pmh-demo-1")).toContainText(/terlambat/i);
  // IB/001/2026 masih punya sisa waktu.
  await expect(page.getByTestId("tenggat-pmh-demo-2")).toContainText(/sisa/i);
});

test("staf tidak dapat memutus tahap yang wewenangnya manajemen", async ({ page }) => {
  await masuk(page, "staf@contoh.test");
  await page.goto("/internal/permohonan");

  // IB/001/2026 sedang di tahap 2 milik manajemen.
  await page.locator("tr", { hasText: "IB/001/2026" }).first().getByRole("link").click();
  await expect(page.getByTestId("status-permohonan")).toHaveText(/Diproses/i);
  await expect(page.getByTestId("form-keputusan")).toHaveCount(0);

  // Dipaksa lewat permintaan langsung pun tetap ditolak.
  const respons = await page.request.post(page.url(), {
    form: { keputusan: "setuju", catatan: "dipaksa" },
  });
  expect(respons.status()).toBe(200);
  expect(respons.headers()["location"]).toBeUndefined();

  await page.reload();
  await expect(page.getByTestId("status-permohonan")).toHaveText(/Diproses/i);
});

test("alur dua tahap berjalan berurutan sampai izin terbit", async ({ browser }) => {
  // Skenario terpanjang di berkas ini: tiga sesi berbeda dan belasan navigasi,
  // dari membuat jenis izin sampai izinnya terbit. Anggaran waktu bawaan habis
  // bukan karena ada yang menggantung, melainkan karena langkahnya memang banyak.
  test.slow();

  const tanda = unik();
  const namaJenis = `Izin Uji Alur ${tanda}`;
  const judul = `Permohonan Alur ${tanda}`;

  // Admin menyiapkan jenis izin dengan dua tahap.
  const admin = await halamanSebagai(browser, "admin@contoh.test");
  await admin.goto("/internal/jenis-izin");
  await admin.getByTestId("buka-form-tambah").click();
  await admin.getByTestId("input-kode").fill(`UJI${tanda}`);
  await admin.getByTestId("input-nama").fill(namaJenis);
  await admin.getByTestId("input-sla").fill("5");
  await admin
    .getByTestId("input-definisi")
    .fill('[{"nama":"alasan","label":"Alasan","tipe":"teks","wajib":true}]');
  await admin.getByTestId("tombol-simpan").click();

  await admin.locator("tr", { hasText: namaJenis }).first().getByRole("link").click();
  await admin.getByTestId("input-nama-tahap").fill("Pemeriksaan staf");
  await admin.getByTestId("input-peran-tahap").selectOption("staf");
  await admin.getByTestId("tombol-tambah-tahap").click();
  await admin.getByTestId("input-nama-tahap").fill("Persetujuan manajemen");
  await admin.getByTestId("input-peran-tahap").selectOption("admin");
  await admin.getByTestId("tombol-tambah-tahap").click();
  await expect(admin.getByTestId("tabel-tahap")).toContainText("Pemeriksaan staf");
  await expect(admin.getByTestId("tabel-tahap")).toContainText("Persetujuan manajemen");

  // Tenant mengajukan.
  const tenant = await halamanSebagai(browser, "tenant@contoh.test");
  await tenant.goto("/portal/permohonan/baru");
  await pilihJenis(tenant, namaJenis);
  await tenant.getByTestId("input-judul").fill(judul);
  await tenant.getByTestId("isian-alasan").fill("Pengujian alur berjenjang");
  await tenant.getByTestId("tombol-simpan").click();
  await tenant.getByTestId("tombol-ajukan").click();
  await expect(tenant.getByTestId("status-permohonan")).toHaveText(/Diajukan/i);
  await expect(tenant.getByTestId("tahap-1")).toContainText("Berjalan");

  // Staf memutus tahap satu; tahap dua bukan wewenangnya.
  const staf = await halamanSebagai(browser, "staf@contoh.test");
  await staf.goto("/internal/permohonan");
  await staf.locator("tr", { hasText: judul }).first().getByRole("link").click();
  await staf.getByTestId("input-keputusan").selectOption("setuju");
  await staf.getByTestId("tombol-putuskan").click();
  await expect(staf.getByTestId("status-permohonan")).toHaveText(/Diproses/i);
  await expect(staf.getByTestId("tahap-2")).toContainText("Berjalan");
  await expect(staf.getByTestId("form-keputusan")).toHaveCount(0);

  // Setelah tahap dua disetujui, izin terbit.
  await admin.goto(staf.url());
  await admin.getByTestId("input-keputusan").selectOption("setuju");
  await admin.getByTestId("tombol-putuskan").click();
  await expect(admin.getByTestId("status-permohonan")).toHaveText(/Terbit/i);
  await expect(admin.getByTestId("tabel-keputusan")).toContainText("Disetujui");

  // Seluruh tahap tampil selesai bagi pemohon.
  await tenant.reload();
  await expect(tenant.getByTestId("status-permohonan")).toHaveText(/Terbit/i);
});

test("keputusan revisi mengembalikan permohonan kepada tenant", async ({ browser }) => {
  const judul = `Permohonan Revisi ${unik()}`;

  // Tenant mengajukan izin kerja (satu tahap, diputus staf).
  const tenant = await halamanSebagai(browser, "tenant@contoh.test");
  await tenant.goto("/portal/permohonan/baru");
  await pilihJenis(tenant, "Izin Kerja Harian");
  await tenant.getByTestId("input-judul").fill(judul);
  await tenant.getByTestId("isian-lokasi_kerja").fill("Area parkir");
  await tenant.getByTestId("isian-jumlah_pekerja").fill("2");
  await tenant.getByTestId("isian-tanggal_mulai").fill("2026-09-05");
  await tenant.getByTestId("isian-risiko").selectOption("rendah");
  await tenant.getByTestId("tombol-simpan").click();
  await tenant.getByTestId("tombol-ajukan").click();
  await expect(tenant.getByTestId("status-permohonan")).toHaveText(/Diajukan/i);

  // Staf meminta revisi.
  const staf = await halamanSebagai(browser, "staf@contoh.test");
  await staf.goto("/internal/permohonan");
  await staf.locator("tr", { hasText: judul }).first().getByRole("link").click();
  await staf.getByTestId("input-keputusan").selectOption("revisi");
  await staf.getByTestId("input-catatan").fill("Lampirkan denah lokasi.");
  await staf.getByTestId("tombol-putuskan").click();
  await expect(staf.getByTestId("status-permohonan")).toHaveText(/Perlu revisi/i);

  // Tenant bisa memperbaiki lalu mengajukan ulang.
  await tenant.reload();
  await expect(tenant.getByTestId("peringatan-revisi")).toBeVisible();
  await expect(tenant.getByTestId("input-judul")).toBeEnabled();

  await tenant.getByTestId("isian-jumlah_pekerja").fill("5");
  await tenant.getByTestId("tombol-simpan").click();
  await tenant.getByTestId("tombol-ajukan").click();
  await expect(tenant.getByTestId("status-permohonan")).toHaveText(/Diajukan/i);
  await expect(tenant.getByTestId("tahap-1")).toContainText("Berjalan");
});

test("lampiran permohonan dapat dibaca pemilik dan pemeriksanya", async ({ browser }) => {
  const tenant = await halamanSebagai(browser, "tenant@contoh.test");
  await tenant.goto("/portal/permohonan");

  // IK/002/2026 masih draf pada data seed sehingga lampiran masih boleh ditambah.
  await tenant.locator("tr", { hasText: "IK/002/2026" }).first().getByRole("link").click();
  await tenant.getByTestId("input-berkas").setInputFiles({
    name: "denah.pdf",
    mimeType: "application/pdf",
    buffer: Buffer.from("%PDF-1.4 denah"),
  });
  await tenant.getByTestId("tombol-unggah").click();
  await expect(tenant.getByTestId("tabel-lampiran")).toContainText("denah.pdf");

  const alamat = await tenant
    .getByTestId("tabel-lampiran")
    .getByRole("link")
    .first()
    .getAttribute("href");
  expect(alamat).toBeTruthy();

  // Pemilik boleh mengunduh.
  expect((await tenant.request.get(alamat!)).status()).toBe(200);

  // Staf pemeriksa juga boleh — memeriksa lampiran memang tugasnya.
  const staf = await halamanSebagai(browser, "staf@contoh.test");
  expect((await staf.request.get(alamat!)).status()).toBe(200);

  // Tetapi lampiran kontrak tetap tertutup bagi staf; kepekaannya berbeda.
  const admin = await halamanSebagai(browser, "admin@contoh.test");
  await admin.goto("/internal/kontrak");
  await admin.locator("tr").nth(1).getByRole("link").first().click();
  await admin.getByTestId("input-berkas").setInputFiles({
    name: "adendum.pdf",
    mimeType: "application/pdf",
    buffer: Buffer.from("%PDF-1.4 adendum"),
  });
  await admin.getByTestId("tombol-unggah").click();
  const alamatKontrak = await admin
    .getByTestId("tabel-lampiran")
    .getByRole("link")
    .first()
    .getAttribute("href");
  expect((await staf.request.get(alamatKontrak!)).status()).toBe(404);
});

test("permohonan lewat tenggat muncul di dasbor pengelola", async ({ page }) => {
  await masuk(page, "admin@contoh.test");

  await expect(page.getByTestId("kartu-mendesak")).toBeVisible();
  await expect(page.getByTestId("kartu-mendesak")).toContainText("IK/001/2026");

  await page.getByTestId("kartu-mendesak").getByRole("link").first().click();
  await expect(page.getByTestId("nomor-permohonan")).toBeVisible();
});
