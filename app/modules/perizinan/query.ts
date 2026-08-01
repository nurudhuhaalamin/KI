import { and, asc, desc, eq, inArray } from "drizzle-orm";

import type { Db } from "~/lib/db";
import { users } from "~/lib/db/schema/auth";
import { unitKerja } from "~/lib/db/schema/organisasi";
import {
  berkasPermohonan,
  jenisIzin,
  keputusanPermohonan,
  permohonan,
  tahapPersetujuan,
  type Keputusan,
  type PeranPemutus,
  type StatusPermohonan,
} from "~/lib/db/schema/perizinan";
import { pengaturan } from "~/lib/db/schema/sistem";
import { tenant } from "~/lib/db/schema/tenant";
import { POLA_BAWAAN, susunNomor, urutBerikutnya } from "~/lib/penomoran";

import { bacaHariLibur, hitungTenggat } from "./sla";

function buatId(awalan: string): string {
  return `${awalan}_${crypto.randomUUID().replaceAll("-", "").slice(0, 20)}`;
}

export const KUNCI_POLA_NOMOR = "perizinan.pola_nomor";
export const KUNCI_HARI_LIBUR = "perizinan.hari_libur";

/** Membaca dua pengaturan sekaligus supaya tidak dua kali jalan ke database. */
export async function bacaPengaturanPerizinan(
  db: Db,
): Promise<{ pola: string; hariLibur: string[] }> {
  const baris = await db
    .select()
    .from(pengaturan)
    .where(inArray(pengaturan.kunci, [KUNCI_POLA_NOMOR, KUNCI_HARI_LIBUR]));

  const cari = (kunci: string) => baris.find((b) => b.kunci === kunci)?.nilai;
  return {
    pola: cari(KUNCI_POLA_NOMOR)?.trim() || POLA_BAWAAN,
    hariLibur: bacaHariLibur(cari(KUNCI_HARI_LIBUR)),
  };
}

// ------------------------------------------------------------------ jenis izin

export function daftarJenisIzin(db: Db) {
  return db
    .select({
      id: jenisIzin.id,
      kode: jenisIzin.kode,
      nama: jenisIzin.nama,
      namaEn: jenisIzin.namaEn,
      slaHari: jenisIzin.slaHari,
      aktif: jenisIzin.aktif,
      definisiKolom: jenisIzin.definisiKolom,
      unitKerjaId: jenisIzin.unitKerjaId,
      kodeUnit: unitKerja.kode,
    })
    .from(jenisIzin)
    .leftJoin(unitKerja, eq(jenisIzin.unitKerjaId, unitKerja.id))
    .orderBy(asc(jenisIzin.urutan), asc(jenisIzin.kode));
}

/** Hanya jenis izin aktif yang boleh dipilih tenant saat mengajukan. */
export function jenisIzinAktif(db: Db) {
  return db
    .select({
      id: jenisIzin.id,
      kode: jenisIzin.kode,
      nama: jenisIzin.nama,
      namaEn: jenisIzin.namaEn,
      slaHari: jenisIzin.slaHari,
      definisiKolom: jenisIzin.definisiKolom,
    })
    .from(jenisIzin)
    .where(eq(jenisIzin.aktif, true))
    .orderBy(asc(jenisIzin.urutan), asc(jenisIzin.kode));
}

export async function ambilJenisIzin(db: Db, id: string) {
  const [baris] = await db.select().from(jenisIzin).where(eq(jenisIzin.id, id)).limit(1);
  return baris ?? null;
}

export async function buatJenisIzin(
  db: Db,
  data: {
    kode: string;
    nama: string;
    namaEn?: string;
    keterangan?: string;
    unitKerjaId?: string;
    slaHari: number;
    definisiKolom?: string;
  },
) {
  // Jenis baru ditaruh di urutan terakhir; tanpa ini urutan bawaannya nol dan
  // setiap jenis yang baru dibuat akan melompat ke atas daftar.
  const adaSekarang = await db.select({ urutan: jenisIzin.urutan }).from(jenisIzin);
  const urutan = adaSekarang.reduce((maks, j) => Math.max(maks, j.urutan), 0) + 1;

  const id = buatId("jzn");
  await db.insert(jenisIzin).values({
    id,
    urutan,
    kode: data.kode,
    nama: data.nama,
    namaEn: data.namaEn ?? null,
    keterangan: data.keterangan ?? null,
    unitKerjaId: data.unitKerjaId ?? null,
    slaHari: data.slaHari,
    definisiKolom: data.definisiKolom ?? "[]",
  });
  return id;
}

export async function ubahJenisIzin(
  db: Db,
  id: string,
  data: {
    nama: string;
    namaEn?: string;
    keterangan?: string;
    unitKerjaId?: string;
    slaHari: number;
    definisiKolom?: string;
    aktif: boolean;
  },
) {
  await db
    .update(jenisIzin)
    .set({
      nama: data.nama,
      namaEn: data.namaEn ?? null,
      keterangan: data.keterangan ?? null,
      unitKerjaId: data.unitKerjaId ?? null,
      slaHari: data.slaHari,
      definisiKolom: data.definisiKolom ?? "[]",
      aktif: data.aktif,
      updatedAt: new Date(),
    })
    .where(eq(jenisIzin.id, id));
}

// ----------------------------------------------------------------------- tahap

export function daftarTahap(db: Db, jenisIzinId: string) {
  return db
    .select({
      id: tahapPersetujuan.id,
      urutan: tahapPersetujuan.urutan,
      nama: tahapPersetujuan.nama,
      namaEn: tahapPersetujuan.namaEn,
      peranPemutus: tahapPersetujuan.peranPemutus,
      unitKerjaId: tahapPersetujuan.unitKerjaId,
    })
    .from(tahapPersetujuan)
    .where(eq(tahapPersetujuan.jenisIzinId, jenisIzinId))
    .orderBy(asc(tahapPersetujuan.urutan));
}

/** Tahap baru selalu ditambahkan di urutan terakhir. */
export async function tambahTahap(
  db: Db,
  jenisIzinId: string,
  data: { nama: string; namaEn?: string; peranPemutus: PeranPemutus; unitKerjaId?: string },
) {
  const adaSekarang = await daftarTahap(db, jenisIzinId);
  const urutan = adaSekarang.reduce((maks, t) => Math.max(maks, t.urutan), 0) + 1;

  const id = buatId("thp");
  await db.insert(tahapPersetujuan).values({
    id,
    jenisIzinId,
    urutan,
    nama: data.nama,
    namaEn: data.namaEn ?? null,
    peranPemutus: data.peranPemutus,
    unitKerjaId: data.unitKerjaId ?? null,
  });
  return id;
}

/**
 * Menghapus tahap lalu merapatkan urutan yang tersisa.
 *
 * Tanpa perapatan, alur akan berhenti di lubang urutan yang ditinggalkan:
 * permohonan menunggu tahap 2 yang sudah tidak ada dan tidak pernah berlanjut.
 */
export async function hapusTahap(db: Db, jenisIzinId: string, tahapId: string) {
  await db.delete(tahapPersetujuan).where(eq(tahapPersetujuan.id, tahapId));

  const tersisa = await daftarTahap(db, jenisIzinId);
  for (const [indeks, t] of tersisa.entries()) {
    const urutanBaru = indeks + 1;
    if (t.urutan !== urutanBaru) {
      await db
        .update(tahapPersetujuan)
        .set({ urutan: urutanBaru })
        .where(eq(tahapPersetujuan.id, t.id));
    }
  }
}

// ------------------------------------------------------------------ permohonan

const KOLOM_DAFTAR = {
  id: permohonan.id,
  nomor: permohonan.nomor,
  judul: permohonan.judul,
  status: permohonan.status,
  tahapAktif: permohonan.tahapAktif,
  tenggat: permohonan.tenggat,
  tanggalDiajukan: permohonan.tanggalDiajukan,
  tenantId: permohonan.tenantId,
  namaTenant: tenant.namaPerusahaan,
  jenisIzinId: permohonan.jenisIzinId,
  namaJenis: jenisIzin.nama,
  namaJenisEn: jenisIzin.namaEn,
};

export function daftarPermohonan(db: Db) {
  return db
    .select(KOLOM_DAFTAR)
    .from(permohonan)
    .innerJoin(jenisIzin, eq(permohonan.jenisIzinId, jenisIzin.id))
    .innerJoin(tenant, eq(permohonan.tenantId, tenant.id))
    .orderBy(desc(permohonan.createdAt));
}

/** Permohonan milik satu perusahaan saja — dipakai portal tenant. */
export function permohonanTenant(db: Db, tenantId: string) {
  return db
    .select(KOLOM_DAFTAR)
    .from(permohonan)
    .innerJoin(jenisIzin, eq(permohonan.jenisIzinId, jenisIzin.id))
    .innerJoin(tenant, eq(permohonan.tenantId, tenant.id))
    .where(eq(permohonan.tenantId, tenantId))
    .orderBy(desc(permohonan.createdAt));
}

export async function ambilPermohonan(db: Db, id: string) {
  const [baris] = await db
    .select({
      permohonan,
      namaJenis: jenisIzin.nama,
      namaJenisEn: jenisIzin.namaEn,
      kodeJenis: jenisIzin.kode,
      slaHari: jenisIzin.slaHari,
      definisiKolom: jenisIzin.definisiKolom,
      namaTenant: tenant.namaPerusahaan,
    })
    .from(permohonan)
    .innerJoin(jenisIzin, eq(permohonan.jenisIzinId, jenisIzin.id))
    .innerJoin(tenant, eq(permohonan.tenantId, tenant.id))
    .where(eq(permohonan.id, id))
    .limit(1);

  return baris ?? null;
}

/** Nomor urut yang sudah terpakai per jenis izin. */
function urutTerpakai(db: Db) {
  return db
    .select({ seri: permohonan.jenisIzinId, tahun: permohonan.tahun, urut: permohonan.urut })
    .from(permohonan);
}

/**
 * Membuat permohonan beserta nomornya.
 *
 * Nomor disusun di sini, tidak pernah diterima dari formulir. Batasan unik
 * (jenisIzinId, tahun, urut) di database menjadi lapis pengaman terakhir bila
 * dua tenant mengajukan pada saat yang nyaris bersamaan.
 */
export async function buatPermohonan(
  db: Db,
  data: {
    jenisIzinId: string;
    tenantId: string;
    diajukanOleh: string;
    judul: string;
    isian: Record<string, string>;
  },
  tahun: number = new Date().getUTCFullYear(),
) {
  const [{ pola }, terpakai, jenis] = await Promise.all([
    bacaPengaturanPerizinan(db),
    urutTerpakai(db),
    ambilJenisIzin(db, data.jenisIzinId),
  ]);
  if (!jenis) throw new Error("Jenis izin tidak ditemukan");

  const urut = urutBerikutnya(terpakai, data.jenisIzinId, tahun);

  let kodeUnit: string | null = null;
  if (jenis.unitKerjaId) {
    const [unit] = await db
      .select({ kode: unitKerja.kode })
      .from(unitKerja)
      .where(eq(unitKerja.id, jenis.unitKerjaId))
      .limit(1);
    kodeUnit = unit?.kode ?? null;
  }

  const nomor = susunNomor(pola, { seri: jenis.kode, kodeUnit, urut, tahun });
  const id = buatId("pmh");

  await db.insert(permohonan).values({
    id,
    nomor,
    urut,
    tahun,
    jenisIzinId: data.jenisIzinId,
    tenantId: data.tenantId,
    diajukanOleh: data.diajukanOleh,
    judul: data.judul,
    isian: JSON.stringify(data.isian),
  });

  return { id, nomor };
}

export async function ubahIsiPermohonan(
  db: Db,
  id: string,
  data: { judul: string; isian: Record<string, string> },
) {
  await db
    .update(permohonan)
    .set({ judul: data.judul, isian: JSON.stringify(data.isian), updatedAt: new Date() })
    .where(eq(permohonan.id, id));
}

/**
 * Mengajukan permohonan: tenggat dihitung dari saat ini, dan tahap kembali ke
 * satu. Pengajuan ulang setelah revisi memakai tenggat baru — pengelola memang
 * baru menerima isi yang sudah diperbaiki.
 */
export async function ajukanPermohonan(db: Db, id: string, slaHari: number) {
  const { hariLibur } = await bacaPengaturanPerizinan(db);
  const sekarang = new Date();

  await db
    .update(permohonan)
    .set({
      status: "diajukan",
      tahapAktif: 1,
      tanggalDiajukan: sekarang,
      tenggat: hitungTenggat(sekarang, slaHari, hariLibur),
      updatedAt: sekarang,
    })
    .where(eq(permohonan.id, id));
}

export async function ubahStatusPermohonan(
  db: Db,
  id: string,
  status: StatusPermohonan,
  tahapAktif: number,
  selesai: boolean,
) {
  await db
    .update(permohonan)
    .set({
      status,
      tahapAktif,
      tanggalSelesai: selesai ? new Date() : null,
      updatedAt: new Date(),
    })
    .where(eq(permohonan.id, id));
}

// ------------------------------------------------------------------- keputusan

export function daftarKeputusan(db: Db, permohonanId: string) {
  return db
    .select({
      id: keputusanPermohonan.id,
      urutanTahap: keputusanPermohonan.urutanTahap,
      keputusan: keputusanPermohonan.keputusan,
      catatan: keputusanPermohonan.catatan,
      createdAt: keputusanPermohonan.createdAt,
      namaPemutus: users.name,
    })
    .from(keputusanPermohonan)
    .leftJoin(users, eq(keputusanPermohonan.oleh, users.id))
    .where(eq(keputusanPermohonan.permohonanId, permohonanId))
    .orderBy(desc(keputusanPermohonan.createdAt));
}

export async function catatKeputusan(
  db: Db,
  data: {
    permohonanId: string;
    tahapId: string;
    urutanTahap: number;
    keputusan: Keputusan;
    oleh: string;
    catatan?: string;
  },
) {
  const id = buatId("kpt");
  await db.insert(keputusanPermohonan).values({
    id,
    permohonanId: data.permohonanId,
    tahapId: data.tahapId,
    urutanTahap: data.urutanTahap,
    keputusan: data.keputusan,
    oleh: data.oleh,
    catatan: data.catatan ?? null,
  });
  return id;
}

// --------------------------------------------------------------------- berkas

export function daftarBerkasPermohonan(db: Db, permohonanId: string) {
  return db
    .select({
      id: berkasPermohonan.id,
      namaBerkas: berkasPermohonan.namaBerkas,
      ukuran: berkasPermohonan.ukuran,
      createdAt: berkasPermohonan.createdAt,
    })
    .from(berkasPermohonan)
    .where(eq(berkasPermohonan.permohonanId, permohonanId))
    .orderBy(asc(berkasPermohonan.createdAt));
}

export async function tambahBerkasPermohonan(
  db: Db,
  permohonanId: string,
  data: {
    namaBerkas: string;
    kunciR2: string;
    ukuran: number;
    tipeMime: string;
    diunggahOleh: string;
  },
) {
  const id = buatId("bpm");
  await db.insert(berkasPermohonan).values({ id, permohonanId, ...data });
  return id;
}

/** Pengelola yang perlu diberi tahu saat permohonan masuk ke tahap tertentu. */
export function penggunaBerperan(db: Db, peran: PeranPemutus) {
  return db
    .select({ id: users.id })
    .from(users)
    .where(and(eq(users.peran, peran), eq(users.aktif, true)));
}
