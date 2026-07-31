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

function kutip(nilai: string): string {
  return `'${nilai.replaceAll("'", "''")}'`;
}

async function main() {
  const sandi = await hashPassword(KATA_SANDI_DEMO);
  const sekarang = Math.floor(Date.now() / 1000);
  const baris: string[] = [];

  // Unit kerja lebih dulu: jabatan dan pengguna merujuk kepadanya.
  for (const unit of UNIT_KERJA) {
    baris.push(
      `INSERT OR REPLACE INTO unit_kerja (id, kode, nama, nama_en, induk_id, urutan, aktif, created_at, updated_at) VALUES (${kutip(unit.id)}, ${kutip(unit.kode)}, ${kutip(unit.nama)}, ${kutip(unit.namaEn)}, ${unit.indukId ? kutip(unit.indukId) : "NULL"}, ${unit.urutan}, 1, ${sekarang}, ${sekarang});`,
    );
  }

  for (const jab of JABATAN) {
    baris.push(
      `INSERT OR REPLACE INTO jabatan (id, kode, nama, nama_en, unit_kerja_id, atasan_id, aktif, created_at, updated_at) VALUES (${kutip(jab.id)}, ${kutip(jab.kode)}, ${kutip(jab.nama)}, ${kutip(jab.namaEn)}, ${kutip(jab.unitKerjaId)}, ${jab.atasanId ? kutip(jab.atasanId) : "NULL"}, 1, ${sekarang}, ${sekarang});`,
    );
  }

  for (const akun of AKUN) {
    const tempat = PENEMPATAN[akun.id];
    baris.push(
      `INSERT OR REPLACE INTO users (id, name, email, email_verified, peran, aktif, unit_kerja_id, jabatan_id, created_at, updated_at) VALUES (${kutip(akun.id)}, ${kutip(akun.nama)}, ${kutip(akun.surel)}, 1, ${kutip(akun.peran)}, 1, ${tempat ? kutip(tempat.unitKerjaId) : "NULL"}, ${tempat ? kutip(tempat.jabatanId) : "NULL"}, ${sekarang}, ${sekarang});`,
    );
    baris.push(
      `INSERT OR REPLACE INTO accounts (id, account_id, provider_id, user_id, password, created_at, updated_at) VALUES (${kutip(`${akun.id}-credential`)}, ${kutip(akun.id)}, 'credential', ${kutip(akun.id)}, ${kutip(sandi)}, ${sekarang}, ${sekarang});`,
    );
  }

  for (const item of PENGATURAN) {
    baris.push(
      `INSERT OR REPLACE INTO pengaturan (kunci, nilai, keterangan, updated_at) VALUES (${kutip(item.kunci)}, ${kutip(item.nilai)}, ${kutip(item.keterangan)}, ${sekarang});`,
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

  console.log(
    `\nSelesai. ${UNIT_KERJA.length} unit kerja, ${JABATAN.length} jabatan, ${AKUN.length} akun demo, dan ${PENGATURAN.length} pengaturan dimuat.`,
  );
  console.log(`Kata sandi seluruh akun demo: ${KATA_SANDI_DEMO}`);
  for (const akun of AKUN) console.log(`  - ${akun.surel} (${akun.peran})`);
}

main().catch((galat: unknown) => {
  console.error(galat);
  process.exit(1);
});
