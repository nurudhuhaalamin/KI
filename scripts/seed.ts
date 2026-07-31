/**
 * Mengisi database dengan data demo agar aplikasi bisa langsung dicoba
 * tanpa mengetik data manual.
 *
 * Pemakaian:
 *   npm run db:seed              # database lokal
 *   npm run db:seed -- --remote  # database Cloudflare (hati-hati!)
 *
 * Kata sandi di-hash memakai fungsi milik Better Auth, sehingga akun hasil
 * seed benar-benar bisa dipakai masuk lewat halaman /masuk.
 *
 * Skrip ini HANYA untuk data demo. Jangan pernah menaruh kredensial nyata
 * atau data pribadi tenant di sini — berkas ini ikut ter-commit.
 */
import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { hashPassword } from "better-auth/crypto";

const remote = process.argv.includes("--remote");
const KATA_SANDI_DEMO = "KawasanDemo2026!";

type AkunDemo = {
  id: string;
  nama: string;
  surel: string;
  peran: "admin" | "manajemen" | "staf" | "tenant";
};

// ID sengaja tetap (bukan acak) supaya seed bisa dijalankan berulang kali
// tanpa menumpuk baris ganda.
const AKUN: AkunDemo[] = [
  { id: "demo-admin", nama: "Administrator Demo", surel: "admin@contoh.test", peran: "admin" },
  { id: "demo-staf", nama: "Staf Perizinan Demo", surel: "staf@contoh.test", peran: "staf" },
  { id: "demo-tenant", nama: "PT Tenant Demo", surel: "tenant@contoh.test", peran: "tenant" },
];

const PENGATURAN: { kunci: string; nilai: string; keterangan: string }[] = [
  { kunci: "kawasan.nama", nilai: "Kawasan Industri Contoh", keterangan: "Nama kawasan" },
  {
    kunci: "kawasan.alamat",
    nilai: "Jalan Contoh No. 1",
    keterangan: "Alamat kantor pengelola",
  },
  { kunci: "kawasan.kontak_surel", nilai: "info@contoh.test", keterangan: "Surel kontak" },
  { kunci: "kawasan.kontak_telepon", nilai: "0401-000000", keterangan: "Telepon kontak" },
  { kunci: "kawasan.locale_bawaan", nilai: "id", keterangan: "Bahasa bawaan antarmuka" },
];

type UnitDemo = {
  id: string;
  kode: string;
  nama: string;
  namaEn: string;
  indukId: string | null;
  urutan: number;
};

// Struktur contoh mengikuti pembagian fungsi yang lazim pada pengelola kawasan
// industri: direksi membawahi operasional, lingkungan-K3, dan keuangan.
const UNIT_KERJA: UnitDemo[] = [
  {
    id: "unit-dir",
    kode: "DIR",
    nama: "Direksi",
    namaEn: "Board of Directors",
    indukId: null,
    urutan: 1,
  },
  {
    id: "unit-ops",
    kode: "OPS",
    nama: "Operasional Kawasan",
    namaEn: "Estate Operations",
    indukId: "unit-dir",
    urutan: 2,
  },
  {
    id: "unit-lk3",
    kode: "LK3",
    nama: "Lingkungan & K3",
    namaEn: "Environment & OHS",
    indukId: "unit-dir",
    urutan: 3,
  },
  {
    id: "unit-keu",
    kode: "KEU",
    nama: "Keuangan & Administrasi",
    namaEn: "Finance & Administration",
    indukId: "unit-dir",
    urutan: 4,
  },
];

type JabatanDemo = {
  id: string;
  kode: string;
  nama: string;
  namaEn: string;
  unitKerjaId: string;
  atasanId: string | null;
};

const JABATAN: JabatanDemo[] = [
  {
    id: "jab-dirut",
    kode: "DIRUT",
    nama: "Direktur Utama",
    namaEn: "President Director",
    unitKerjaId: "unit-dir",
    atasanId: null,
  },
  {
    id: "jab-mgr-ops",
    kode: "MGR-OPS",
    nama: "Manajer Operasional",
    namaEn: "Operations Manager",
    unitKerjaId: "unit-ops",
    atasanId: "jab-dirut",
  },
  {
    id: "jab-staf-izin",
    kode: "STF-IZIN",
    nama: "Staf Perizinan",
    namaEn: "Permit Officer",
    unitKerjaId: "unit-ops",
    atasanId: "jab-mgr-ops",
  },
  {
    id: "jab-mgr-lk3",
    kode: "MGR-LK3",
    nama: "Manajer Lingkungan & K3",
    namaEn: "Environment & OHS Manager",
    unitKerjaId: "unit-lk3",
    atasanId: "jab-dirut",
  },
  {
    id: "jab-staf-lh",
    kode: "STF-LH",
    nama: "Staf Pemantauan Lingkungan",
    namaEn: "Environmental Monitoring Officer",
    unitKerjaId: "unit-lk3",
    atasanId: "jab-mgr-lk3",
  },
  {
    id: "jab-mgr-keu",
    kode: "MGR-KEU",
    nama: "Manajer Keuangan",
    namaEn: "Finance Manager",
    unitKerjaId: "unit-keu",
    atasanId: "jab-dirut",
  },
];

/** Penempatan akun demo ke unit kerja dan jabatan. */
const PENEMPATAN: Record<string, { unitKerjaId: string; jabatanId: string }> = {
  "demo-admin": { unitKerjaId: "unit-dir", jabatanId: "jab-dirut" },
  "demo-staf": { unitKerjaId: "unit-ops", jabatanId: "jab-staf-izin" },
};

/** Akun tenant demo ditautkan ke perusahaan demo pertama. */
const PENAUTAN_TENANT: Record<string, string> = {
  "demo-tenant": "ten-demo-1",
};

type KavlingDemo = {
  id: string;
  kode: string;
  blok: string;
  nomor: string;
  luasM2: number;
  peruntukan: "industri" | "komersial" | "fasilitas" | "rth";
  status: "tersedia" | "dipesan" | "disewa" | "terjual";
  hargaDasar: number | null;
};

const KAVLING: KavlingDemo[] = [
  {
    id: "kav-a01",
    kode: "A-01",
    blok: "A",
    nomor: "01",
    luasM2: 10000,
    peruntukan: "industri",
    status: "disewa",
    hargaDasar: 2_500_000_000,
  },
  {
    id: "kav-a02",
    kode: "A-02",
    blok: "A",
    nomor: "02",
    luasM2: 12500,
    peruntukan: "industri",
    status: "terjual",
    hargaDasar: 3_100_000_000,
  },
  {
    id: "kav-a03",
    kode: "A-03",
    blok: "A",
    nomor: "03",
    luasM2: 8000,
    peruntukan: "industri",
    status: "dipesan",
    hargaDasar: 2_000_000_000,
  },
  {
    id: "kav-a04",
    kode: "A-04",
    blok: "A",
    nomor: "04",
    luasM2: 9500,
    peruntukan: "industri",
    status: "tersedia",
    hargaDasar: 2_375_000_000,
  },
  {
    id: "kav-b01",
    kode: "B-01",
    blok: "B",
    nomor: "01",
    luasM2: 15000,
    peruntukan: "industri",
    status: "tersedia",
    hargaDasar: 3_750_000_000,
  },
  {
    id: "kav-b02",
    kode: "B-02",
    blok: "B",
    nomor: "02",
    luasM2: 5000,
    peruntukan: "komersial",
    status: "tersedia",
    hargaDasar: 1_500_000_000,
  },
  {
    id: "kav-c01",
    kode: "C-01",
    blok: "C",
    nomor: "01",
    luasM2: 3000,
    peruntukan: "fasilitas",
    status: "tersedia",
    hargaDasar: null,
  },
  {
    id: "kav-c02",
    kode: "C-02",
    blok: "C",
    nomor: "02",
    luasM2: 20000,
    peruntukan: "rth",
    status: "tersedia",
    hargaDasar: null,
  },
];

type TenantDemo = {
  id: string;
  kode: string;
  nama: string;
  bentuk: string;
  bidang: string;
  status: "calon" | "aktif" | "berakhir";
};

// Data legalitas sengaja TIDAK diisi di seed: berkas ini ikut ter-commit,
// dan NPWP/NIB termasuk data yang tidak boleh ada di repo.
const TENANT: TenantDemo[] = [
  {
    id: "ten-demo-1",
    kode: "TNT-001",
    nama: "PT Baja Nusantara Sejahtera",
    bentuk: "PT",
    bidang: "Pengolahan logam",
    status: "aktif",
  },
  {
    id: "ten-demo-2",
    kode: "TNT-002",
    nama: "PT Kemasan Andalan Prima",
    bentuk: "PT",
    bidang: "Kemasan plastik",
    status: "aktif",
  },
  {
    id: "ten-demo-3",
    kode: "TNT-003",
    nama: "CV Mitra Logistik Kendari",
    bentuk: "CV",
    bidang: "Pergudangan",
    status: "calon",
  },
];

type KontrakDemo = {
  id: string;
  nomor: string;
  jenis: "jual" | "sewa";
  tenantId: string;
  kavlingId: string;
  mulai: string;
  berakhir: string | null;
  nilai: number;
  status: "draf" | "aktif" | "berakhir" | "batal";
};

const KONTRAK: KontrakDemo[] = [
  {
    id: "knt-demo-1",
    nomor: "SWA/2026/001",
    jenis: "sewa",
    tenantId: "ten-demo-1",
    kavlingId: "kav-a01",
    mulai: "2026-01-01",
    berakhir: "2030-12-31",
    nilai: 4_500_000_000,
    status: "aktif",
  },
  {
    id: "knt-demo-2",
    nomor: "JBL/2026/002",
    jenis: "jual",
    tenantId: "ten-demo-2",
    kavlingId: "kav-a02",
    mulai: "2026-03-01",
    berakhir: null,
    nilai: 3_100_000_000,
    status: "aktif",
  },
  {
    id: "knt-demo-3",
    nomor: "SWA/2026/003",
    jenis: "sewa",
    tenantId: "ten-demo-3",
    kavlingId: "kav-a03",
    mulai: "2026-09-01",
    berakhir: "2028-08-31",
    nilai: 1_800_000_000,
    status: "draf",
  },
];

const keDetik = (tanggal: string) =>
  Math.floor(new Date(`${tanggal}T00:00:00Z`).getTime() / 1000);

/** Tanggal relatif terhadap hari ini, dalam detik. Negatif berarti sudah lewat. */
const hariDariSekarang = (hari: number) => Math.floor(Date.now() / 1000) + hari * 24 * 60 * 60;

type DokumenDemo = {
  id: string;
  nomor: string;
  urut: number;
  tahun: number;
  judul: string;
  judulEn: string;
  kategori: string;
  unitKerjaId: string | null;
  status: "draf" | "ditinjau" | "disahkan" | "kedaluwarsa" | "ditarik";
  versiTerkini: number;
  tinjauUlangHari: number | null;
};

// Enam dokumen lintas kategori. Satu sudah lewat tanggal tinjau ulang dan satu
// mendekati, supaya peringatan di dasbor langsung terlihat setelah seed.
const DOKUMEN: DokumenDemo[] = [
  {
    id: "dok-demo-1",
    nomor: "TK/DIR/001/2026",
    urut: 1,
    tahun: 2026,
    judul: "Tata Tertib Kawasan Industri",
    judulEn: "Estate Code of Conduct",
    kategori: "tata-kelola",
    unitKerjaId: "unit-dir",
    status: "disahkan",
    versiTerkini: 1,
    tinjauUlangHari: 300,
  },
  {
    id: "dok-demo-2",
    nomor: "SOP-PLY/OPS/001/2026",
    urut: 1,
    tahun: 2026,
    judul: "SOP Pelayanan Perizinan Satu Pintu",
    judulEn: "One-Stop Permit Service SOP",
    kategori: "sop-pelayanan",
    unitKerjaId: "unit-ops",
    status: "disahkan",
    versiTerkini: 1,
    tinjauUlangHari: 14,
  },
  {
    id: "dok-demo-3",
    nomor: "SOP-PLY/OPS/002/2026",
    urut: 2,
    tahun: 2026,
    judul: "SOP Penerimaan & Onboarding Tenant Baru",
    judulEn: "New Tenant Onboarding SOP",
    kategori: "sop-pelayanan",
    unitKerjaId: "unit-ops",
    status: "ditinjau",
    versiTerkini: 1,
    tinjauUlangHari: null,
  },
  {
    id: "dok-demo-4",
    nomor: "SOP-INF/LK3/001/2026",
    urut: 1,
    tahun: 2026,
    judul: "SOP Pengoperasian & Pemeliharaan IPAL Kawasan",
    judulEn: "Estate Wastewater Plant Operation SOP",
    kategori: "sop-infrastruktur",
    unitKerjaId: "unit-lk3",
    status: "disahkan",
    versiTerkini: 1,
    tinjauUlangHari: -20,
  },
  {
    id: "dok-demo-5",
    nomor: "K3/LK3/001/2026",
    urut: 1,
    tahun: 2026,
    judul: "Kebijakan K3 Kawasan",
    judulEn: "Estate OHS Policy",
    kategori: "k3",
    unitKerjaId: "unit-lk3",
    status: "draf",
    versiTerkini: 0,
    tinjauUlangHari: null,
  },
  {
    id: "dok-demo-6",
    nomor: "GCG/DIR/001/2026",
    urut: 1,
    tahun: 2026,
    judul: "Pedoman Good Corporate Governance",
    judulEn: "Good Corporate Governance Guidelines",
    kategori: "governance",
    unitKerjaId: "unit-dir",
    status: "draf",
    versiTerkini: 0,
    tinjauUlangHari: null,
  },
];

/**
 * Berkas contoh untuk dokumen yang sudah punya versi.
 *
 * Tanpa ini, dokumen demo mengaku berversi 1 tetapi riwayat versinya kosong dan
 * tidak ada yang bisa diunduh — keadaan yang tidak mungkin terjadi lewat
 * aplikasi. Isinya PDF minimal, hanya agar ada objek nyata di R2.
 */
type VersiDemo = { id: string; dokumenId: string; kunci: string; nama: string };

const VERSI: VersiDemo[] = DOKUMEN.filter((d) => d.versiTerkini > 0).map((d, i) => ({
  id: `ver-demo-${i + 1}`,
  dokumenId: d.id,
  kunci: `dokumen/${d.id}/versi-1.pdf`,
  nama: `${d.nomor.replaceAll("/", "-")}-v1.pdf`,
}));

const isiPdfDemo = (dokumen: DokumenDemo) =>
  `%PDF-1.4\n% Berkas contoh untuk ${dokumen.nomor} — ${dokumen.judul}\n`;

function kutip(nilai: string): string {
  return `'${nilai.replaceAll("'", "''")}'`;
}

/**
 * Menyusun pernyataan upsert berdasarkan kolom `id`.
 *
 * Sengaja TIDAK memakai `INSERT OR REPLACE`: di SQLite, REPLACE berarti DELETE
 * lalu INSERT, sehingga menghapus baris induk dan memicu cascade ke tabel anak
 * — pada skema ini hal itu melanggar foreign key dan menggagalkan seluruh seed.
 * `ON CONFLICT DO UPDATE` memperbarui baris di tempat, tanpa menghapus apa pun.
 */
function upsert(
  tabel: string,
  nilai: Record<string, string | number | null>,
  kunci = "id",
): string {
  const kolom = Object.keys(nilai);
  const isi = kolom.map((k) => {
    const v = nilai[k];
    if (v === null || v === undefined) return "NULL";
    return typeof v === "number" ? String(v) : kutip(v);
  });
  const pembaruan = kolom
    .filter((k) => k !== kunci)
    .map((k) => `${k}=excluded.${k}`)
    .join(", ");

  return (
    `INSERT INTO ${tabel} (${kolom.join(", ")}) VALUES (${isi.join(", ")}) ` +
    `ON CONFLICT(${kunci}) DO UPDATE SET ${pembaruan};`
  );
}

async function main() {
  const sandi = await hashPassword(KATA_SANDI_DEMO);
  const sekarang = Math.floor(Date.now() / 1000);
  const baris: string[] = [];

  // Unit kerja lebih dulu: jabatan dan pengguna merujuk kepadanya.
  for (const unit of UNIT_KERJA) {
    baris.push(
      upsert("unit_kerja", {
        id: unit.id,
        kode: unit.kode,
        nama: unit.nama,
        nama_en: unit.namaEn,
        induk_id: unit.indukId,
        urutan: unit.urutan,
        aktif: 1,
        created_at: sekarang,
        updated_at: sekarang,
      }),
    );
  }

  for (const jab of JABATAN) {
    baris.push(
      upsert("jabatan", {
        id: jab.id,
        kode: jab.kode,
        nama: jab.nama,
        nama_en: jab.namaEn,
        unit_kerja_id: jab.unitKerjaId,
        atasan_id: jab.atasanId,
        aktif: 1,
        created_at: sekarang,
        updated_at: sekarang,
      }),
    );
  }

  // Tenant dan kavling lebih dulu: kontrak dan pengguna merujuk keduanya.
  for (const t of TENANT) {
    baris.push(
      upsert("tenant", {
        id: t.id,
        kode: t.kode,
        nama_perusahaan: t.nama,
        bentuk_badan_usaha: t.bentuk,
        bidang_usaha: t.bidang,
        status: t.status,
        aktif: 1,
        created_at: sekarang,
        updated_at: sekarang,
      }),
    );
  }

  for (const k of KAVLING) {
    baris.push(
      upsert("kavling", {
        id: k.id,
        kode: k.kode,
        blok: k.blok,
        nomor: k.nomor,
        luas_m2: k.luasM2,
        peruntukan: k.peruntukan,
        status: k.status,
        harga_dasar: k.hargaDasar,
        aktif: 1,
        created_at: sekarang,
        updated_at: sekarang,
      }),
    );
  }

  for (const k of KONTRAK) {
    baris.push(
      upsert("kontrak", {
        id: k.id,
        nomor: k.nomor,
        jenis: k.jenis,
        tenant_id: k.tenantId,
        kavling_id: k.kavlingId,
        tanggal_mulai: keDetik(k.mulai),
        tanggal_berakhir: k.berakhir ? keDetik(k.berakhir) : null,
        nilai: k.nilai,
        status: k.status,
        created_at: sekarang,
        updated_at: sekarang,
      }),
    );
  }

  // Dokumen merujuk unit kerja, jadi dimuat setelahnya.
  for (const d of DOKUMEN) {
    baris.push(
      upsert("dokumen", {
        id: d.id,
        nomor: d.nomor,
        urut: d.urut,
        tahun: d.tahun,
        judul: d.judul,
        judul_en: d.judulEn,
        kategori: d.kategori,
        unit_kerja_id: d.unitKerjaId,
        status: d.status,
        versi_terkini: d.versiTerkini,
        tanggal_tinjau_ulang:
          d.tinjauUlangHari === null ? null : hariDariSekarang(d.tinjauUlangHari),
        aktif: 1,
        created_at: sekarang,
        updated_at: sekarang,
      }),
    );
  }

  for (const akun of AKUN) {
    const tempat = PENEMPATAN[akun.id];
    const perusahaan = PENAUTAN_TENANT[akun.id];
    baris.push(
      upsert("users", {
        id: akun.id,
        name: akun.nama,
        email: akun.surel,
        email_verified: 1,
        peran: akun.peran,
        aktif: 1,
        unit_kerja_id: tempat?.unitKerjaId ?? null,
        jabatan_id: tempat?.jabatanId ?? null,
        tenant_id: perusahaan ?? null,
        created_at: sekarang,
        updated_at: sekarang,
      }),
    );
    baris.push(
      upsert("accounts", {
        id: `${akun.id}-credential`,
        account_id: akun.id,
        provider_id: "credential",
        user_id: akun.id,
        password: sandi,
        created_at: sekarang,
        updated_at: sekarang,
      }),
    );
  }

  // Versi dokumen merujuk akun pengunggah, jadi dimuat setelah tabel users.
  //
  // Riwayat versi dokumen demo dikembalikan ke keadaan awal lebih dulu. Tanpa
  // ini, revisi yang dibuat saat mencoba aplikasi akan menumpuk dan membuat
  // `versi_terkini` tidak lagi cocok dengan riwayatnya.
  baris.push(
    `DELETE FROM versi_dokumen WHERE dokumen_id IN (${DOKUMEN.map((d) => kutip(d.id)).join(", ")});`,
  );
  for (const v of VERSI) {
    const induk = DOKUMEN.find((d) => d.id === v.dokumenId)!;
    baris.push(
      upsert("versi_dokumen", {
        id: v.id,
        dokumen_id: v.dokumenId,
        versi: 1,
        kunci_r2: v.kunci,
        nama_berkas: v.nama,
        ukuran: Buffer.byteLength(isiPdfDemo(induk), "utf8"),
        tipe_mime: "application/pdf",
        catatan_revisi: "Terbitan pertama",
        diunggah_oleh: "demo-admin",
        created_at: sekarang,
      }),
    );
  }

  for (const item of PENGATURAN) {
    baris.push(
      upsert(
        "pengaturan",
        {
          kunci: item.kunci,
          nilai: item.nilai,
          keterangan: item.keterangan,
          updated_at: sekarang,
        },
        "kunci",
      ),
    );
  }

  const berkas = join(mkdtempSync(join(tmpdir(), "ki-seed-")), "seed.sql");
  writeFileSync(berkas, baris.join("\n"), "utf8");

  const argumen = [
    "wrangler",
    "d1",
    "execute",
    "ki-db",
    remote ? "--remote" : "--local",
    `--file=${berkas}`,
  ];
  if (remote) argumen.push("--yes");

  execFileSync("npx", argumen, { stdio: "inherit" });

  // Objek R2 untuk tiap versi dokumen demo, supaya tombol unduh benar-benar
  // menghasilkan berkas dan bukan galat "tidak ditemukan".
  const wadah = mkdtempSync(join(tmpdir(), "ki-seed-berkas-"));
  for (const v of VERSI) {
    const induk = DOKUMEN.find((d) => d.id === v.dokumenId)!;
    const jalur = join(wadah, v.nama);
    writeFileSync(jalur, isiPdfDemo(induk), "utf8");

    execFileSync(
      "npx",
      [
        "wrangler",
        "r2",
        "object",
        "put",
        `ki-berkas/${v.kunci}`,
        remote ? "--remote" : "--local",
        `--file=${jalur}`,
        "--content-type=application/pdf",
      ],
      { stdio: "inherit" },
    );
  }

  console.log(
    `\nSelesai. ${UNIT_KERJA.length} unit kerja, ${JABATAN.length} jabatan, ${KAVLING.length} kavling, ` +
      `${TENANT.length} tenant, ${KONTRAK.length} kontrak, ${DOKUMEN.length} dokumen ` +
      `(${VERSI.length} berkas versi), ${AKUN.length} akun demo, dan ` +
      `${PENGATURAN.length} pengaturan dimuat.`,
  );
  console.log(`Kata sandi seluruh akun demo: ${KATA_SANDI_DEMO}`);
  for (const akun of AKUN) console.log(`  - ${akun.surel} (${akun.peran})`);
}

main().catch((galat: unknown) => {
  console.error(galat);
  process.exit(1);
});
