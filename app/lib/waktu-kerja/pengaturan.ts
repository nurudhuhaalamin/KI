/**
 * Kalender hari libur milik kawasan.
 *
 * Dulu tersimpan sebagai `perizinan.hari_libur`, seolah libur nasional hanya
 * urusan modul perizinan. Sejak modul E memakainya juga untuk tenggat pemeriksaan
 * dokumen lingkungan, kuncinya naik menjadi `kawasan.hari_libur`.
 *
 * Kunci lama tetap dibaca sebagai cadangan supaya instans yang sudah menyimpan
 * nilainya tidak perlu disentuh; yang baru menang bila keduanya ada.
 */

import { inArray } from "drizzle-orm";

import type { Db } from "~/lib/db";
import { pengaturan } from "~/lib/db/schema/sistem";

import { bacaHariLibur } from "./index";

export const KUNCI_HARI_LIBUR = "kawasan.hari_libur";
const KUNCI_HARI_LIBUR_LAMA = "perizinan.hari_libur";

export async function bacaKalenderLibur(db: Db): Promise<string[]> {
  const baris = await db
    .select()
    .from(pengaturan)
    .where(inArray(pengaturan.kunci, [KUNCI_HARI_LIBUR, KUNCI_HARI_LIBUR_LAMA]));

  const cari = (kunci: string) => baris.find((b) => b.kunci === kunci)?.nilai;
  return bacaHariLibur(cari(KUNCI_HARI_LIBUR) ?? cari(KUNCI_HARI_LIBUR_LAMA));
}
