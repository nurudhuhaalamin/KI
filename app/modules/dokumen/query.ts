import { asc, desc, eq } from "drizzle-orm";

import type { Db } from "~/lib/db";
import {
  distribusiDokumen,
  dokumen,
  pengesahanDokumen,
  versiDokumen,
  type KategoriDokumen,
  type StatusDokumen,
} from "~/lib/db/schema/dokumen";
import { unitKerja } from "~/lib/db/schema/organisasi";
import { pengaturan } from "~/lib/db/schema/sistem";
import { POLA_BAWAAN, susunNomor, urutBerikutnya } from "./penomoran";

function buatId(awalan: string): string {
  return `${awalan}_${crypto.randomUUID().replaceAll("-", "").slice(0, 20)}`;
}

export const KUNCI_POLA_NOMOR = "dokumen.pola_nomor";

export async function bacaPolaNomor(db: Db): Promise<string> {
  const [baris] = await db
    .select()
    .from(pengaturan)
    .where(eq(pengaturan.kunci, KUNCI_POLA_NOMOR))
    .limit(1);
  return baris?.nilai?.trim() || POLA_BAWAAN;
}

export function daftarDokumen(db: Db) {
  return db
    .select({
      id: dokumen.id,
      nomor: dokumen.nomor,
      judul: dokumen.judul,
      kategori: dokumen.kategori,
      status: dokumen.status,
      versiTerkini: dokumen.versiTerkini,
      tanggalTinjauUlang: dokumen.tanggalTinjauUlang,
      unitKerjaId: dokumen.unitKerjaId,
      kodeUnit: unitKerja.kode,
    })
    .from(dokumen)
    .leftJoin(unitKerja, eq(dokumen.unitKerjaId, unitKerja.id))
    .orderBy(asc(dokumen.kategori), desc(dokumen.tahun), asc(dokumen.urut));
}

export async function ambilDokumen(db: Db, id: string) {
  const [baris] = await db.select().from(dokumen).where(eq(dokumen.id, id)).limit(1);
  return baris ?? null;
}

/** Nomor yang sudah terpakai, dipakai menentukan urutan berikutnya. */
export function nomorTerpakai(db: Db) {
  return db
    .select({ kategori: dokumen.kategori, tahun: dokumen.tahun, urut: dokumen.urut })
    .from(dokumen);
}

/**
 * Membuat dokumen beserta nomornya.
 *
 * Nomor disusun di sini, bukan diterima dari formulir. Batasan unik
 * (kategori, tahun, urut) di database menjadi lapis pengaman terakhir bila dua
 * orang menyimpan pada saat yang nyaris bersamaan.
 */
export async function buatDokumen(
  db: Db,
  data: {
    judul: string;
    judulEn?: string;
    kategori: KategoriDokumen;
    unitKerjaId?: string;
    ringkasan?: string;
    tanggalTinjauUlang: Date | null;
  },
  tahun: number = new Date().getUTCFullYear(),
) {
  const [pola, terpakai] = await Promise.all([bacaPolaNomor(db), nomorTerpakai(db)]);
  const urut = urutBerikutnya(terpakai, data.kategori, tahun);

  let kodeUnit: string | null = null;
  if (data.unitKerjaId) {
    const [unit] = await db
      .select({ kode: unitKerja.kode })
      .from(unitKerja)
      .where(eq(unitKerja.id, data.unitKerjaId))
      .limit(1);
    kodeUnit = unit?.kode ?? null;
  }

  const nomor = susunNomor(pola, { kategori: data.kategori, kodeUnit, urut, tahun });
  const id = buatId("dok");

  await db.insert(dokumen).values({
    id,
    nomor,
    urut,
    tahun,
    judul: data.judul,
    judulEn: data.judulEn ?? null,
    kategori: data.kategori,
    unitKerjaId: data.unitKerjaId ?? null,
    ringkasan: data.ringkasan ?? null,
    tanggalTinjauUlang: data.tanggalTinjauUlang,
  });

  return { id, nomor };
}

export async function ubahDokumen(
  db: Db,
  id: string,
  data: {
    judul: string;
    judulEn?: string;
    unitKerjaId?: string;
    ringkasan?: string;
    status: StatusDokumen;
    tanggalTerbit: Date | null;
    tanggalTinjauUlang: Date | null;
  },
) {
  await db
    .update(dokumen)
    .set({
      judul: data.judul,
      judulEn: data.judulEn ?? null,
      unitKerjaId: data.unitKerjaId ?? null,
      ringkasan: data.ringkasan ?? null,
      status: data.status,
      tanggalTerbit: data.tanggalTerbit,
      tanggalTinjauUlang: data.tanggalTinjauUlang,
      updatedAt: new Date(),
    })
    .where(eq(dokumen.id, id));
}

/** Hanya status yang berubah — dipakai saat mengesahkan atau menarik dokumen. */
export async function ubahStatusDokumen(db: Db, id: string, status: StatusDokumen) {
  await db
    .update(dokumen)
    .set({
      status,
      tanggalTerbit: status === "disahkan" ? new Date() : undefined,
      updatedAt: new Date(),
    })
    .where(eq(dokumen.id, id));
}

// -------------------------------------------------------------------- versi

export function daftarVersi(db: Db, dokumenId: string) {
  return db
    .select({
      id: versiDokumen.id,
      versi: versiDokumen.versi,
      namaBerkas: versiDokumen.namaBerkas,
      ukuran: versiDokumen.ukuran,
      catatanRevisi: versiDokumen.catatanRevisi,
      createdAt: versiDokumen.createdAt,
    })
    .from(versiDokumen)
    .where(eq(versiDokumen.dokumenId, dokumenId))
    .orderBy(desc(versiDokumen.versi));
}

/**
 * Menyimpan revisi baru.
 *
 * Versi lama tidak disentuh sama sekali — itulah yang membuat riwayat dokumen
 * bisa ditelusuri saat audit. Dokumen yang direvisi kembali berstatus draf
 * karena isinya sudah berubah dan perlu ditinjau ulang.
 */
export async function tambahVersi(
  db: Db,
  dokumenId: string,
  versiBaru: number,
  data: {
    kunciR2: string;
    namaBerkas: string;
    ukuran: number;
    tipeMime: string;
    catatanRevisi?: string;
    diunggahOleh: string;
  },
) {
  const id = buatId("ver");
  await db.insert(versiDokumen).values({
    id,
    dokumenId,
    versi: versiBaru,
    kunciR2: data.kunciR2,
    namaBerkas: data.namaBerkas,
    ukuran: data.ukuran,
    tipeMime: data.tipeMime,
    catatanRevisi: data.catatanRevisi ?? null,
    diunggahOleh: data.diunggahOleh,
  });

  await db
    .update(dokumen)
    .set({ versiTerkini: versiBaru, status: "draf", updatedAt: new Date() })
    .where(eq(dokumen.id, dokumenId));

  return id;
}

// --------------------------------------------------------------- pengesahan

export function daftarPengesahan(db: Db, dokumenId: string) {
  return db
    .select()
    .from(pengesahanDokumen)
    .where(eq(pengesahanDokumen.dokumenId, dokumenId))
    .orderBy(desc(pengesahanDokumen.createdAt));
}

export async function catatPengesahan(
  db: Db,
  data: {
    dokumenId: string;
    versi: number;
    disahkanOleh: string;
    jabatanId?: string;
    catatan?: string;
  },
) {
  const id = buatId("sah");
  await db.insert(pengesahanDokumen).values({
    id,
    dokumenId: data.dokumenId,
    versi: data.versi,
    disahkanOleh: data.disahkanOleh,
    jabatanId: data.jabatanId ?? null,
    catatan: data.catatan ?? null,
  });
  return id;
}

// --------------------------------------------------------------- distribusi

export function daftarDistribusi(db: Db, dokumenId: string) {
  return db
    .select({
      id: distribusiDokumen.id,
      unitKerjaId: distribusiDokumen.unitKerjaId,
      kodeUnit: unitKerja.kode,
      namaUnit: unitKerja.nama,
      versi: distribusiDokumen.versi,
      createdAt: distribusiDokumen.createdAt,
    })
    .from(distribusiDokumen)
    .innerJoin(unitKerja, eq(distribusiDokumen.unitKerjaId, unitKerja.id))
    .where(eq(distribusiDokumen.dokumenId, dokumenId))
    .orderBy(asc(unitKerja.kode));
}

export async function catatDistribusi(
  db: Db,
  dokumenId: string,
  unitKerjaId: string,
  versi: number,
) {
  const id = buatId("dis");
  await db
    .insert(distribusiDokumen)
    .values({ id, dokumenId, unitKerjaId, versi })
    .onConflictDoUpdate({
      target: [distribusiDokumen.dokumenId, distribusiDokumen.unitKerjaId],
      set: { versi, createdAt: new Date() },
    });
  return id;
}
