import { desc, eq, and, type SQL } from "drizzle-orm";

import type { Db } from "../db";
import { jejakAudit } from "../db/schema/sistem";

export type AksiAudit = "buat" | "ubah" | "hapus" | "masuk" | "keluar";

export type MasukanAudit = {
  userId?: string | null;
  aksi: AksiAudit;
  entitas: string;
  entitasId?: string | null;
  ringkasan?: string | null;
  request?: Request;
};

/**
 * Mencatat satu perubahan ke jejak audit.
 *
 * Dipanggil dari setiap action yang mengubah data. Kegagalan pencatatan tidak
 * boleh menggagalkan aksi yang sudah berhasil — jejak audit adalah catatan
 * pendamping, bukan bagian dari transaksi bisnisnya.
 *
 * Keamanan: `ringkasan` tidak boleh memuat data pribadi tenant (NIK, NPWP,
 * nomor kontak, nilai kontrak). Cukup sebutkan field apa yang berubah.
 */
export async function catatAudit(db: Db, masukan: MasukanAudit): Promise<void> {
  try {
    await db.insert(jejakAudit).values({
      userId: masukan.userId ?? null,
      aksi: masukan.aksi,
      entitas: masukan.entitas,
      entitasId: masukan.entitasId ?? null,
      ringkasan: masukan.ringkasan ?? null,
      ipAddress: masukan.request ? ambilIp(masukan.request) : null,
    });
  } catch (galat) {
    console.error("Gagal mencatat jejak audit", galat);
  }
}

/** Alamat IP pengunjung menurut header yang dipasang Cloudflare. */
export function ambilIp(request: Request): string | null {
  return (
    request.headers.get("CF-Connecting-IP") ??
    request.headers.get("X-Forwarded-For")?.split(",")[0]?.trim() ??
    null
  );
}

/**
 * Menyusun ringkasan perubahan: hanya menyebut nama field yang berubah, tanpa
 * nilainya, supaya jejak audit tidak menjadi tempat bocornya data.
 */
export function ringkasPerubahan(
  sebelum: Record<string, unknown>,
  sesudah: Record<string, unknown>,
): string {
  const berubah: string[] = [];
  for (const kunci of Object.keys(sesudah)) {
    if (sebelum[kunci] !== sesudah[kunci]) berubah.push(kunci);
  }
  return berubah.length > 0 ? `Field berubah: ${berubah.join(", ")}` : "Tidak ada perubahan";
}

export type PenyaringAudit = {
  entitas?: string;
  aksi?: AksiAudit;
  batas?: number;
};

/** Membaca jejak audit terbaru, dengan penyaring opsional. */
export async function bacaJejakAudit(db: Db, penyaring: PenyaringAudit = {}) {
  const syarat: SQL[] = [];
  if (penyaring.entitas) syarat.push(eq(jejakAudit.entitas, penyaring.entitas));
  if (penyaring.aksi) syarat.push(eq(jejakAudit.aksi, penyaring.aksi));

  const kueri = db.select().from(jejakAudit).orderBy(desc(jejakAudit.createdAt));
  const disaring = syarat.length > 0 ? kueri.where(and(...syarat)) : kueri;

  return disaring.limit(Math.min(penyaring.batas ?? 100, 500));
}
