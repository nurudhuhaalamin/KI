import { asc, eq } from "drizzle-orm";

import type { Db } from "~/lib/db";
import { kavling, type Peruntukan, type StatusKavling } from "~/lib/db/schema/kavling";
import { kontrak } from "~/lib/db/schema/kontrak";
import { hitungStatusKavling, type MasaKontrak } from "~/modules/kontrak/aturan";

function buatId(): string {
  return `kav_${crypto.randomUUID().replaceAll("-", "").slice(0, 20)}`;
}

export function daftarKavling(db: Db) {
  return db.select().from(kavling).orderBy(asc(kavling.blok), asc(kavling.nomor));
}

export async function ambilKavling(db: Db, id: string) {
  const [baris] = await db.select().from(kavling).where(eq(kavling.id, id)).limit(1);
  return baris ?? null;
}

export async function buatKavling(
  db: Db,
  data: {
    kode: string;
    blok: string;
    nomor: string;
    luasM2: number;
    peruntukan: Peruntukan;
    hargaDasar?: number;
    keterangan?: string;
  },
) {
  const id = buatId();
  await db.insert(kavling).values({
    id,
    kode: data.kode,
    blok: data.blok,
    nomor: data.nomor,
    luasM2: data.luasM2,
    peruntukan: data.peruntukan,
    hargaDasar: data.hargaDasar ?? null,
    keterangan: data.keterangan ?? null,
  });
  return id;
}

export async function ubahKavling(
  db: Db,
  id: string,
  data: {
    blok: string;
    nomor: string;
    luasM2: number;
    peruntukan: Peruntukan;
    hargaDasar?: number;
    keterangan?: string;
    aktif: boolean;
  },
) {
  await db
    .update(kavling)
    .set({
      blok: data.blok,
      nomor: data.nomor,
      luasM2: data.luasM2,
      peruntukan: data.peruntukan,
      hargaDasar: data.hargaDasar ?? null,
      keterangan: data.keterangan ?? null,
      aktif: data.aktif,
      updatedAt: new Date(),
    })
    .where(eq(kavling.id, id));
}

/**
 * Menyegarkan status kavling dari kontrak-kontraknya.
 *
 * Dipanggil setiap kali kontrak pada kavling tersebut dibuat atau diubah.
 * Status tidak pernah disunting langsung oleh pengguna.
 */
export async function segarkanStatusKavling(db: Db, kavlingId: string): Promise<StatusKavling> {
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

  const status = hitungStatusKavling(baris as MasaKontrak[]);
  await db
    .update(kavling)
    .set({ status, updatedAt: new Date() })
    .where(eq(kavling.id, kavlingId));

  return status;
}
