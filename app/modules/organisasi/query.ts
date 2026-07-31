import { hashPassword } from "better-auth/crypto";
import { asc, eq } from "drizzle-orm";

import type { Db } from "~/lib/db";
import { accounts, users, type Peran } from "~/lib/db/schema/auth";
import { jabatan, unitKerja } from "~/lib/db/schema/organisasi";
import { pengaturan } from "~/lib/db/schema/sistem";

/** Id ringkas yang mudah dibaca di URL dan log. */
function buatId(awalan: string): string {
  return `${awalan}_${crypto.randomUUID().replaceAll("-", "").slice(0, 20)}`;
}

// ---------------------------------------------------------------- unit kerja

export function daftarUnitKerja(db: Db) {
  return db.select().from(unitKerja).orderBy(asc(unitKerja.urutan), asc(unitKerja.nama));
}

export async function ambilUnitKerja(db: Db, id: string) {
  const [baris] = await db.select().from(unitKerja).where(eq(unitKerja.id, id)).limit(1);
  return baris ?? null;
}

export async function buatUnitKerja(
  db: Db,
  data: {
    kode: string;
    nama: string;
    namaEn?: string;
    fungsi?: string;
    indukId?: string;
    urutan: number;
  },
) {
  const id = buatId("unit");
  await db.insert(unitKerja).values({
    id,
    kode: data.kode,
    nama: data.nama,
    namaEn: data.namaEn ?? null,
    fungsi: data.fungsi ?? null,
    indukId: data.indukId ?? null,
    urutan: data.urutan,
  });
  return id;
}

export async function ubahUnitKerja(
  db: Db,
  id: string,
  data: {
    nama: string;
    namaEn?: string;
    fungsi?: string;
    indukId?: string;
    urutan: number;
    aktif: boolean;
  },
) {
  await db
    .update(unitKerja)
    .set({
      nama: data.nama,
      namaEn: data.namaEn ?? null,
      fungsi: data.fungsi ?? null,
      indukId: data.indukId ?? null,
      urutan: data.urutan,
      aktif: data.aktif,
      updatedAt: new Date(),
    })
    .where(eq(unitKerja.id, id));
}

// ------------------------------------------------------------------ jabatan

export function daftarJabatan(db: Db) {
  return db.select().from(jabatan).orderBy(asc(jabatan.nama));
}

export async function ambilJabatan(db: Db, id: string) {
  const [baris] = await db.select().from(jabatan).where(eq(jabatan.id, id)).limit(1);
  return baris ?? null;
}

export async function buatJabatan(
  db: Db,
  data: {
    kode: string;
    nama: string;
    namaEn?: string;
    unitKerjaId: string;
    atasanId?: string;
    ringkasanTugas?: string;
  },
) {
  const id = buatId("jab");
  await db.insert(jabatan).values({
    id,
    kode: data.kode,
    nama: data.nama,
    namaEn: data.namaEn ?? null,
    unitKerjaId: data.unitKerjaId,
    atasanId: data.atasanId ?? null,
    ringkasanTugas: data.ringkasanTugas ?? null,
  });
  return id;
}

export async function ubahJabatan(
  db: Db,
  id: string,
  data: {
    nama: string;
    namaEn?: string;
    unitKerjaId: string;
    atasanId?: string;
    ringkasanTugas?: string;
    aktif: boolean;
  },
) {
  await db
    .update(jabatan)
    .set({
      nama: data.nama,
      namaEn: data.namaEn ?? null,
      unitKerjaId: data.unitKerjaId,
      atasanId: data.atasanId ?? null,
      ringkasanTugas: data.ringkasanTugas ?? null,
      aktif: data.aktif,
      updatedAt: new Date(),
    })
    .where(eq(jabatan.id, id));
}

// ----------------------------------------------------------------- pengguna

export function daftarPengguna(db: Db) {
  return db
    .select({
      id: users.id,
      nama: users.name,
      surel: users.email,
      peran: users.peran,
      aktif: users.aktif,
      unitKerjaId: users.unitKerjaId,
      jabatanId: users.jabatanId,
      createdAt: users.createdAt,
    })
    .from(users)
    .orderBy(asc(users.name));
}

export async function ambilPengguna(db: Db, id: string) {
  const [baris] = await db.select().from(users).where(eq(users.id, id)).limit(1);
  return baris ?? null;
}

export async function surelSudahDipakai(db: Db, surel: string): Promise<boolean> {
  const [baris] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, surel))
    .limit(1);
  return baris !== undefined;
}

/**
 * Membuat pengguna beserta kredensialnya.
 *
 * Kata sandi di-hash memakai fungsi milik Better Auth agar akun yang dibuat di
 * sini benar-benar bisa dipakai masuk lewat halaman /masuk.
 */
export async function buatPengguna(
  db: Db,
  data: {
    nama: string;
    surel: string;
    kataSandi: string;
    peran: Peran;
    unitKerjaId?: string;
    jabatanId?: string;
  },
) {
  const id = buatId("usr");
  const sandi = await hashPassword(data.kataSandi);

  await db.insert(users).values({
    id,
    name: data.nama,
    email: data.surel,
    emailVerified: true,
    peran: data.peran,
    aktif: true,
    unitKerjaId: data.unitKerjaId ?? null,
    jabatanId: data.jabatanId ?? null,
  });

  await db.insert(accounts).values({
    id: `${id}-credential`,
    accountId: id,
    providerId: "credential",
    userId: id,
    password: sandi,
  });

  return id;
}

export async function ubahPengguna(
  db: Db,
  id: string,
  data: {
    nama: string;
    peran: Peran;
    aktif: boolean;
    unitKerjaId?: string;
    jabatanId?: string;
  },
) {
  await db
    .update(users)
    .set({
      name: data.nama,
      peran: data.peran,
      aktif: data.aktif,
      unitKerjaId: data.unitKerjaId ?? null,
      jabatanId: data.jabatanId ?? null,
      updatedAt: new Date(),
    })
    .where(eq(users.id, id));
}

export async function gantiKataSandi(db: Db, userId: string, kataSandiBaru: string) {
  const sandi = await hashPassword(kataSandiBaru);
  await db
    .update(accounts)
    .set({ password: sandi, updatedAt: new Date() })
    .where(eq(accounts.userId, userId));
}

// --------------------------------------------------------------- pengaturan

export const KUNCI_PENGATURAN = {
  nama: "kawasan.nama",
  alamat: "kawasan.alamat",
  kontakSurel: "kawasan.kontak_surel",
  kontakTelepon: "kawasan.kontak_telepon",
  localeBawaan: "kawasan.locale_bawaan",
} as const;

export async function bacaPengaturan(db: Db): Promise<Record<string, string>> {
  const baris = await db.select().from(pengaturan);
  return Object.fromEntries(baris.map((b) => [b.kunci, b.nilai]));
}

export async function simpanPengaturan(db: Db, nilai: Record<string, string>) {
  for (const [kunci, isi] of Object.entries(nilai)) {
    await db
      .insert(pengaturan)
      .values({ kunci, nilai: isi, updatedAt: new Date() })
      .onConflictDoUpdate({
        target: pengaturan.kunci,
        set: { nilai: isi, updatedAt: new Date() },
      });
  }
}
