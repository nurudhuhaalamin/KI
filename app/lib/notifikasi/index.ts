/**
 * Notifikasi di dalam aplikasi.
 *
 * Seluruh modul membuat notifikasi lewat satu fungsi di sini, bukan menulis ke
 * tabelnya masing-masing. Pengiriman surel belum dipasang — butuh akun dan
 * domain terverifikasi milik kawasan — dan ketika nanti dipasang, satu-satunya
 * berkas yang berubah adalah yang ini.
 */

import { and, desc, eq } from "drizzle-orm";

import type { Db } from "~/lib/db";
import { notifikasi } from "~/lib/db/schema/perizinan";

function buatId(): string {
  return `ntf_${crypto.randomUUID().replaceAll("-", "").slice(0, 20)}`;
}

export type IsiNotifikasi = {
  judul: string;
  pesan: string;
  tautan?: string;
};

/**
 * Mengirim notifikasi kepada beberapa penerima sekaligus.
 *
 * Penerima kembar dibuang, dan daftar kosong tidak menyentuh database sama
 * sekali. Kegagalan notifikasi tidak boleh menggagalkan tindakan yang memicunya:
 * izin yang sudah disetujui harus tetap tersimpan meski pemberitahuannya gagal.
 */
export async function kirimNotifikasi(
  db: Db,
  penerima: readonly string[],
  isi: IsiNotifikasi,
): Promise<void> {
  const unik = [...new Set(penerima.filter((id) => id.trim() !== ""))];
  if (unik.length === 0) return;

  try {
    await db.insert(notifikasi).values(
      unik.map((userId) => ({
        id: buatId(),
        userId,
        judul: isi.judul,
        pesan: isi.pesan,
        tautan: isi.tautan ?? null,
      })),
    );
  } catch (galat) {
    // Detail teknis hanya ke log server, tidak pernah ke pengguna.
    console.error("Gagal membuat notifikasi", galat);
  }
}

export function daftarNotifikasi(db: Db, userId: string, batas = 20) {
  return db
    .select()
    .from(notifikasi)
    .where(eq(notifikasi.userId, userId))
    .orderBy(desc(notifikasi.createdAt))
    .limit(batas);
}

export async function jumlahBelumDibaca(db: Db, userId: string): Promise<number> {
  const baris = await db
    .select({ id: notifikasi.id })
    .from(notifikasi)
    .where(and(eq(notifikasi.userId, userId), eq(notifikasi.dibaca, false)));
  return baris.length;
}

/** Menandai seluruh notifikasi milik pengguna sebagai sudah dibaca. */
export async function tandaiTerbaca(db: Db, userId: string): Promise<void> {
  await db
    .update(notifikasi)
    .set({ dibaca: true })
    .where(and(eq(notifikasi.userId, userId), eq(notifikasi.dibaca, false)));
}
