/**
 * Yang khas permohonan izin. Hitungan hari kerjanya sendiri ada di
 * `~/lib/waktu-kerja` karena modul lain memakainya juga.
 */

import { statusSla } from "~/lib/waktu-kerja";

export type PermohonanTenggat = {
  id: string;
  nomor: string;
  judul: string;
  tenggat: Date | null;
  status: string;
};

/** Status yang masih menunggu tindakan pengelola. */
const MASIH_BERJALAN = ["diajukan", "diproses"];

/**
 * Permohonan yang perlu didahulukan: yang tenggatnya paling dekat di atas.
 * Permohonan yang sudah terbit, ditolak, atau batal tidak lagi dihitung —
 * mengingatkan tenggat sesuatu yang sudah selesai hanya menambah kebisingan.
 */
export function permohonanMendesak(
  daftar: readonly PermohonanTenggat[],
  sekarang: Date = new Date(),
  hariLibur: readonly string[] = [],
): PermohonanTenggat[] {
  return daftar
    .filter((p) => MASIH_BERJALAN.includes(p.status) && p.tenggat !== null)
    .filter((p) => statusSla(p.tenggat, sekarang, 1, hariLibur) !== "aman")
    .sort((a, b) => a.tenggat!.getTime() - b.tenggat!.getTime());
}
