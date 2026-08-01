/**
 * Alur persetujuan berjenjang.
 *
 * Yang ditegakkan di sini adalah dua hal yang paling sering salah kalau ditulis
 * langsung di halaman: siapa yang berhak memutus tahap tertentu, dan ke mana
 * permohonan berpindah setelah diputus. Keduanya fungsi murni supaya bisa diuji
 * tanpa database, sesi, maupun tampilan.
 */

import type { Keputusan, PeranPemutus, StatusPermohonan } from "~/lib/db/schema/perizinan";

export type Tahap = {
  id: string;
  urutan: number;
  nama: string;
  namaEn?: string | null;
  peranPemutus: PeranPemutus;
  unitKerjaId: string | null;
};

/** Isi permohonan hanya boleh diubah selagi belum masuk meja pengelola. */
export function bolehSuntingPermohonan(status: StatusPermohonan): boolean {
  return status === "draf" || status === "perlu-revisi";
}

/** Permohonan hanya bisa diajukan dari draf atau setelah diminta revisi. */
export function bolehDiajukan(status: StatusPermohonan): boolean {
  return status === "draf" || status === "perlu-revisi";
}

/** Pembatalan oleh pemohon hanya masuk akal selama belum diputus final. */
export function bolehDibatalkan(status: StatusPermohonan): boolean {
  return status === "draf" || status === "diajukan" || status === "perlu-revisi";
}

export type PenggunaPemutus = {
  peran: string;
  unitKerjaId?: string | null;
};

/**
 * Apakah pengguna ini berhak memutus tahap tersebut.
 *
 * Administrator boleh memutus tahap apa pun — kalau tidak, permohonan bisa macet
 * permanen saat pemegang peran yang seharusnya sedang tidak ada. Selain itu
 * perannya harus persis sama dengan yang diminta tahap: manajemen TIDAK otomatis
 * boleh memutus tahap staf, karena tahap staf biasanya berisi pemeriksaan teknis
 * yang memang bukan wewenang manajemen.
 */
export function bolehMemutus(pengguna: PenggunaPemutus, tahap: Tahap): boolean {
  if (pengguna.peran === "admin") return true;
  if (pengguna.peran !== tahap.peranPemutus) return false;

  // Bila tahap dibatasi pada satu unit kerja, pemutusnya harus dari unit itu.
  if (tahap.unitKerjaId && pengguna.unitKerjaId !== tahap.unitKerjaId) return false;
  return true;
}

export type HasilKeputusan = {
  status: StatusPermohonan;
  tahapAktif: number;
  selesai: boolean;
};

/**
 * Ke mana permohonan berpindah setelah satu tahap diputus.
 *
 * `tolak` menghentikan seluruhnya — penolakan tidak boleh diam-diam berlanjut ke
 * tahap berikutnya. `revisi` mengembalikannya kepada pemohon dan mengulang dari
 * tahap satu setelah diajukan lagi, karena isinya sudah berubah dan pemeriksa
 * sebelumnya menilai isi yang lama.
 */
export function terapkanKeputusan(
  keputusan: Keputusan,
  urutanTahap: number,
  jumlahTahap: number,
): HasilKeputusan {
  if (keputusan === "tolak") {
    return { status: "ditolak", tahapAktif: urutanTahap, selesai: true };
  }

  if (keputusan === "revisi") {
    return { status: "perlu-revisi", tahapAktif: 0, selesai: false };
  }

  const berikutnya = urutanTahap + 1;
  if (berikutnya > jumlahTahap) {
    return { status: "terbit", tahapAktif: jumlahTahap, selesai: true };
  }

  return { status: "diproses", tahapAktif: berikutnya, selesai: false };
}

export type GalatAlur =
  "statusTidakBoleh" | "bukanWewenang" | "tahapTidakDitemukan" | "tanpaTahap";

/**
 * Pemeriksaan lengkap sebelum satu keputusan dicatat.
 *
 * Mengembalikan tahap yang sedang berjalan bila boleh, atau alasan penolakan.
 * Halaman cukup memanggil ini; tidak ada cabang izin yang ditulis ulang di sana.
 */
export function periksaKeputusan(
  status: StatusPermohonan,
  tahapAktif: number,
  tahap: readonly Tahap[],
  pengguna: PenggunaPemutus,
): { boleh: true; tahap: Tahap } | { boleh: false; galat: GalatAlur } {
  if (status !== "diajukan" && status !== "diproses") {
    return { boleh: false, galat: "statusTidakBoleh" };
  }
  if (tahap.length === 0) return { boleh: false, galat: "tanpaTahap" };

  const berjalan = tahap.find((t) => t.urutan === tahapAktif);
  if (!berjalan) return { boleh: false, galat: "tahapTidakDitemukan" };

  if (!bolehMemutus(pengguna, berjalan)) return { boleh: false, galat: "bukanWewenang" };
  return { boleh: true, tahap: berjalan };
}

/**
 * Kemajuan permohonan untuk ditampilkan sebagai jejak langkah.
 * Tahap yang sudah lewat, yang sedang berjalan, dan yang belum tiba dibedakan
 * supaya pemohon tahu permohonannya ada di meja siapa.
 */
export type KemajuanTahap = Tahap & { keadaan: "selesai" | "berjalan" | "menunggu" };

export function kemajuan(
  tahap: readonly Tahap[],
  tahapAktif: number,
  status: StatusPermohonan,
): KemajuanTahap[] {
  const urut = [...tahap].sort((a, b) => a.urutan - b.urutan);

  return urut.map((t) => {
    if (status === "terbit") return { ...t, keadaan: "selesai" as const };
    if (t.urutan < tahapAktif) return { ...t, keadaan: "selesai" as const };
    if (t.urutan === tahapAktif && (status === "diajukan" || status === "diproses")) {
      return { ...t, keadaan: "berjalan" as const };
    }
    return { ...t, keadaan: "menunggu" as const };
  });
}
