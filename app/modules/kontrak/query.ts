import { and, asc, desc, eq } from "drizzle-orm";

import type { Db } from "~/lib/db";
import { kavling } from "~/lib/db/schema/kavling";
import {
  kontrak,
  kontrakFasilitas,
  lampiranKontrak,
  type JenisFasilitas,
  type JenisKontrak,
  type StatusKontrak,
} from "~/lib/db/schema/kontrak";
import { tenant } from "~/lib/db/schema/tenant";
import type { MasaKontrak } from "./aturan";

function buatId(awalan: string): string {
  return `${awalan}_${crypto.randomUUID().replaceAll("-", "").slice(0, 20)}`;
}

/** Daftar kontrak beserta nama tenant dan kode kavling untuk ditampilkan. */
export function daftarKontrak(db: Db) {
  return db
    .select({
      id: kontrak.id,
      nomor: kontrak.nomor,
      jenis: kontrak.jenis,
      status: kontrak.status,
      tanggalMulai: kontrak.tanggalMulai,
      tanggalBerakhir: kontrak.tanggalBerakhir,
      nilai: kontrak.nilai,
      tenantId: kontrak.tenantId,
      namaTenant: tenant.namaPerusahaan,
      kavlingId: kontrak.kavlingId,
      kodeKavling: kavling.kode,
    })
    .from(kontrak)
    .innerJoin(tenant, eq(kontrak.tenantId, tenant.id))
    .innerJoin(kavling, eq(kontrak.kavlingId, kavling.id))
    .orderBy(desc(kontrak.tanggalMulai));
}

/**
 * Kontrak milik satu tenant.
 *
 * Portal tenant WAJIB memakai fungsi ini dengan tenantId dari sesi, bukan dari
 * parameter URL. Menyaring di database seperti ini membuat penebakan id kontrak
 * milik perusahaan lain tidak menghasilkan apa pun.
 */
export function daftarKontrakTenant(db: Db, tenantId: string) {
  return db
    .select({
      id: kontrak.id,
      nomor: kontrak.nomor,
      jenis: kontrak.jenis,
      status: kontrak.status,
      tanggalMulai: kontrak.tanggalMulai,
      tanggalBerakhir: kontrak.tanggalBerakhir,
      nilai: kontrak.nilai,
      kodeKavling: kavling.kode,
      luasKavling: kavling.luasM2,
    })
    .from(kontrak)
    .innerJoin(kavling, eq(kontrak.kavlingId, kavling.id))
    .where(eq(kontrak.tenantId, tenantId))
    .orderBy(desc(kontrak.tanggalMulai));
}

export async function ambilKontrak(db: Db, id: string) {
  const [baris] = await db.select().from(kontrak).where(eq(kontrak.id, id)).limit(1);
  return baris ?? null;
}

/** Mengambil kontrak hanya bila memang milik tenant tersebut. */
export async function ambilKontrakTenant(db: Db, id: string, tenantId: string) {
  const [baris] = await db
    .select()
    .from(kontrak)
    .where(and(eq(kontrak.id, id), eq(kontrak.tenantId, tenantId)))
    .limit(1);
  return baris ?? null;
}

/** Kontrak lain pada satu kavling, dipakai memeriksa tumpang tindih. */
export async function masaKontrakKavling(db: Db, kavlingId: string): Promise<MasaKontrak[]> {
  const baris = await db
    .select({
      id: kontrak.id,
      jenis: kontrak.jenis,
      status: kontrak.status,
      tanggalMulai: kontrak.tanggalMulai,
      tanggalBerakhir: kontrak.tanggalBerakhir,
    })
    .from(kontrak)
    .where(eq(kontrak.kavlingId, kavlingId));
  return baris as MasaKontrak[];
}

export async function nomorKontrakDipakai(db: Db, nomor: string): Promise<boolean> {
  const [baris] = await db
    .select({ id: kontrak.id })
    .from(kontrak)
    .where(eq(kontrak.nomor, nomor))
    .limit(1);
  return baris !== undefined;
}

export async function buatKontrak(
  db: Db,
  data: {
    nomor: string;
    jenis: JenisKontrak;
    tenantId: string;
    kavlingId: string;
    tanggalMulai: Date;
    tanggalBerakhir: Date | null;
    nilai: number;
    keterangan?: string;
  },
) {
  const id = buatId("knt");
  await db.insert(kontrak).values({
    id,
    nomor: data.nomor,
    jenis: data.jenis,
    tenantId: data.tenantId,
    kavlingId: data.kavlingId,
    tanggalMulai: data.tanggalMulai,
    tanggalBerakhir: data.tanggalBerakhir,
    nilai: data.nilai,
    keterangan: data.keterangan ?? null,
  });
  return id;
}

export async function ubahKontrak(
  db: Db,
  id: string,
  data: {
    jenis: JenisKontrak;
    tenantId: string;
    kavlingId: string;
    tanggalMulai: Date;
    tanggalBerakhir: Date | null;
    nilai: number;
    status: StatusKontrak;
    keterangan?: string;
  },
) {
  await db
    .update(kontrak)
    .set({
      jenis: data.jenis,
      tenantId: data.tenantId,
      kavlingId: data.kavlingId,
      tanggalMulai: data.tanggalMulai,
      tanggalBerakhir: data.tanggalBerakhir,
      nilai: data.nilai,
      status: data.status,
      keterangan: data.keterangan ?? null,
      updatedAt: new Date(),
    })
    .where(eq(kontrak.id, id));
}

// ------------------------------------------------------------------ fasilitas

export function daftarFasilitas(db: Db, kontrakId: string) {
  return db
    .select()
    .from(kontrakFasilitas)
    .where(eq(kontrakFasilitas.kontrakId, kontrakId))
    .orderBy(asc(kontrakFasilitas.jenis));
}

export async function tambahFasilitas(
  db: Db,
  kontrakId: string,
  data: { jenis: JenisFasilitas; kuotaBulanan?: number; satuan?: string; keterangan?: string },
) {
  const id = buatId("fas");
  await db.insert(kontrakFasilitas).values({
    id,
    kontrakId,
    jenis: data.jenis,
    kuotaBulanan: data.kuotaBulanan ?? null,
    satuan: data.satuan ?? null,
    keterangan: data.keterangan ?? null,
  });
  return id;
}

// ------------------------------------------------------------------- lampiran

export function daftarLampiran(db: Db, kontrakId: string) {
  return db
    .select({
      id: lampiranKontrak.id,
      namaBerkas: lampiranKontrak.namaBerkas,
      ukuran: lampiranKontrak.ukuran,
      tipeMime: lampiranKontrak.tipeMime,
      createdAt: lampiranKontrak.createdAt,
    })
    .from(lampiranKontrak)
    .where(eq(lampiranKontrak.kontrakId, kontrakId))
    .orderBy(desc(lampiranKontrak.createdAt));
}

export async function catatLampiran(
  db: Db,
  data: {
    kontrakId: string;
    namaBerkas: string;
    kunciR2: string;
    ukuran: number;
    tipeMime: string;
    diunggahOleh: string;
  },
) {
  const id = buatId("lam");
  await db.insert(lampiranKontrak).values({ id, ...data });
  return id;
}

/**
 * Mengambil satu lampiran beserta tenant pemilik kontraknya.
 *
 * Rute unduhan memakai ini untuk memeriksa hak akses SEBELUM menyalurkan isi
 * berkas. Kunci R2 tidak pernah dikirim ke klien.
 */
export async function ambilLampiran(db: Db, id: string) {
  const [baris] = await db
    .select({
      id: lampiranKontrak.id,
      namaBerkas: lampiranKontrak.namaBerkas,
      kunciR2: lampiranKontrak.kunciR2,
      tipeMime: lampiranKontrak.tipeMime,
      kontrakId: lampiranKontrak.kontrakId,
      tenantId: kontrak.tenantId,
    })
    .from(lampiranKontrak)
    .innerJoin(kontrak, eq(lampiranKontrak.kontrakId, kontrak.id))
    .where(eq(lampiranKontrak.id, id))
    .limit(1);
  return baris ?? null;
}
