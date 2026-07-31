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
  { kunci: "kawasan.locale_bawaan", nilai: "id", keterangan: "Bahasa bawaan antarmuka" },
];

function kutip(nilai: string): string {
  return `'${nilai.replaceAll("'", "''")}'`;
}

async function main() {
  const sandi = await hashPassword(KATA_SANDI_DEMO);
  const sekarang = Math.floor(Date.now() / 1000);
  const baris: string[] = [];

  for (const akun of AKUN) {
    baris.push(
      `INSERT OR REPLACE INTO users (id, name, email, email_verified, peran, aktif, created_at, updated_at) VALUES (${kutip(akun.id)}, ${kutip(akun.nama)}, ${kutip(akun.surel)}, 1, ${kutip(akun.peran)}, 1, ${sekarang}, ${sekarang});`,
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
    `\nSelesai. ${AKUN.length} akun demo dan ${PENGATURAN.length} pengaturan dimuat.`,
  );
  console.log(`Kata sandi seluruh akun demo: ${KATA_SANDI_DEMO}`);
  for (const akun of AKUN) console.log(`  - ${akun.surel} (${akun.peran})`);
}

main().catch((galat: unknown) => {
  console.error(galat);
  process.exit(1);
});
