/**
 * Alur pemeriksaan dokumen lingkungan: 3 hari kerja administrasi, lalu 10 hari
 * kerja substansi.
 *
 * Yang paling mudah salah dan paling penting benar: **jam kawasan berhenti
 * selama bola ada di tangan tenant**. Selama dokumen berstatus
 * `perlu-dilengkapi` atau `perlu-diperbaiki`, keterlambatan bukan milik kawasan.
 * Kalau ini diabaikan, laporan ketepatan layanan akan menyalahkan pihak yang
 * salah — dan justru laporan itulah yang dipakai kawasan membuktikan
 * kewenangannya layak dipertahankan.
 *
 * Seluruhnya fungsi murni: tanggal dan hari libur diberikan pemanggil.
 */

import { hitungTenggat, statusSla, type StatusSla } from "~/lib/waktu-kerja";
import type {
  PeranAnggota,
  StatusLingkungan,
  TahapPemeriksaan,
} from "~/lib/db/schema/lingkungan";

/** Nilai bawaan bila kawasan belum mengaturnya sendiri. */
export const HARI_ADMINISTRASI = 3;
export const HARI_SUBSTANSI = 10;

export type BatasHari = { administrasi: number; substansi: number };

export const BATAS_BAWAAN: BatasHari = {
  administrasi: HARI_ADMINISTRASI,
  substansi: HARI_SUBSTANSI,
};

/** Isi dokumen hanya boleh diubah selagi belum ada di meja pemeriksa. */
export function bolehSuntingPengajuan(status: StatusLingkungan): boolean {
  return status === "draf" || status === "perlu-dilengkapi" || status === "perlu-diperbaiki";
}

/** Pengajuan dan pengajuan ulang berangkat dari keadaan yang sama. */
export function bolehDiajukan(status: StatusLingkungan): boolean {
  return bolehSuntingPengajuan(status);
}

/**
 * Tahap mana yang sedang berjalan, atau `null` bila bola tidak ada di kawasan.
 *
 * Dipakai untuk menentukan jam mana yang dinilai — dan untuk memutuskan bahwa
 * tidak ada jam yang berjalan sama sekali.
 */
export function tahapBerjalan(status: StatusLingkungan): TahapPemeriksaan | null {
  if (status === "diajukan" || status === "pemeriksaan-administrasi") return "administrasi";
  if (status === "pemeriksaan-substansi") return "substansi";
  return null;
}

/** Bola ada di tangan tenant; jam kawasan berhenti. */
export function menungguTenant(status: StatusLingkungan): boolean {
  return status === "draf" || status === "perlu-dilengkapi" || status === "perlu-diperbaiki";
}

export function sudahSelesai(status: StatusLingkungan): boolean {
  return status === "disetujui" || status === "ditolak" || status === "batal";
}

/**
 * Tenggat satu tahap, dihitung dari saat tahap itu dimulai.
 *
 * Tahap substansi memakai `mulai` = saat berkas dinyatakan lengkap, BUKAN saat
 * pengajuan pertama. Kalau dihitung dari pengajuan pertama, waktu yang dipakai
 * tenant melengkapi berkasnya ikut memakan jatah kawasan.
 */
export function tenggatTahap(
  tahap: TahapPemeriksaan,
  mulai: Date,
  batas: BatasHari = BATAS_BAWAAN,
  hariLibur: readonly string[] = [],
): Date {
  const hari = tahap === "administrasi" ? batas.administrasi : batas.substansi;
  return hitungTenggat(mulai, hari, hariLibur);
}

export type TindakanPemeriksaan =
  | "mulai-administrasi"
  | "minta-lengkapi"
  | "nyatakan-lengkap"
  | "minta-perbaikan"
  | "setujui"
  | "tolak"
  | "ajukan"
  | "batalkan";

const PERPINDAHAN: Record<
  TindakanPemeriksaan,
  { dari: StatusLingkungan[]; ke: StatusLingkungan }
> = {
  ajukan: { dari: ["draf", "perlu-dilengkapi", "perlu-diperbaiki"], ke: "diajukan" },
  "mulai-administrasi": { dari: ["diajukan"], ke: "pemeriksaan-administrasi" },
  "minta-lengkapi": {
    dari: ["diajukan", "pemeriksaan-administrasi"],
    ke: "perlu-dilengkapi",
  },
  "nyatakan-lengkap": {
    dari: ["diajukan", "pemeriksaan-administrasi"],
    ke: "pemeriksaan-substansi",
  },
  "minta-perbaikan": { dari: ["pemeriksaan-substansi"], ke: "perlu-diperbaiki" },
  setujui: { dari: ["pemeriksaan-substansi"], ke: "disetujui" },
  tolak: { dari: ["pemeriksaan-administrasi", "pemeriksaan-substansi"], ke: "ditolak" },
  batalkan: {
    dari: ["draf", "diajukan", "perlu-dilengkapi", "perlu-diperbaiki"],
    ke: "batal",
  },
};

/**
 * Perpindahan status yang diizinkan.
 *
 * Perhatikan yang TIDAK ada: `setujui` dari tahap administrasi. Dokumen tidak
 * boleh disetujui tanpa pernah diperiksa substansinya, sekalipun administrasinya
 * lengkap — itu persis lubang yang membuat kewenangan kawasan dicabut.
 */
export function bolehBerpindah(
  dari: StatusLingkungan,
  tindakan: TindakanPemeriksaan,
): StatusLingkungan | null {
  const aturan = PERPINDAHAN[tindakan];
  return aturan.dari.includes(dari) ? aturan.ke : null;
}

export type Anggota = { userId: string; peran: PeranAnggota };

export type PenggunaPemeriksa = { id: string; peran: string };

/** Anggota tim mana pun boleh mencatat temuan. */
export function bolehMencatatTemuan(
  pengguna: PenggunaPemeriksa,
  anggota: readonly Anggota[],
): boolean {
  if (pengguna.peran === "admin") return true;
  return anggota.some((a) => a.userId === pengguna.id);
}

/**
 * Hanya ketua tim yang boleh menyimpulkan tahap.
 *
 * Administrator boleh bertindak sebagai ketua supaya pemeriksaan tidak macet
 * permanen saat ketuanya berhalangan — sama seperti aturan pada modul D.
 */
export function bolehMenyimpulkan(
  pengguna: PenggunaPemeriksa,
  anggota: readonly Anggota[],
): boolean {
  if (pengguna.peran === "admin") return true;
  return anggota.some((a) => a.userId === pengguna.id && a.peran === "ketua");
}

export type GalatTahapan =
  "statusTidakBoleh" | "bukanKetua" | "bukanAnggota" | "belumAdaTim" | "belumAdaBerkas";

/** Pemeriksaan lengkap sebelum satu tindakan pemeriksa dijalankan. */
export function periksaTindakan(
  status: StatusLingkungan,
  tindakan: TindakanPemeriksaan,
  pengguna: PenggunaPemeriksa,
  anggota: readonly Anggota[],
): { boleh: true; statusBaru: StatusLingkungan } | { boleh: false; galat: GalatTahapan } {
  const statusBaru = bolehBerpindah(status, tindakan);
  if (!statusBaru) return { boleh: false, galat: "statusTidakBoleh" };

  if (anggota.length === 0 && pengguna.peran !== "admin") {
    return { boleh: false, galat: "belumAdaTim" };
  }
  if (!bolehMenyimpulkan(pengguna, anggota)) return { boleh: false, galat: "bukanKetua" };

  return { boleh: true, statusBaru };
}

export type KeadaanTenggat = {
  tahap: TahapPemeriksaan | null;
  tenggat: Date | null;
  status: StatusSla;
};

/**
 * Tenggat yang sedang berlaku beserta keadaannya.
 *
 * Mengembalikan `aman` tanpa tenggat ketika bola ada di tenant atau perkaranya
 * sudah selesai — bukan `terlambat`, karena tidak ada janji kawasan yang sedang
 * berjalan untuk dilanggar.
 */
export function keadaanTenggat(
  status: StatusLingkungan,
  tenggatAdministrasi: Date | null,
  tenggatSubstansi: Date | null,
  sekarang: Date = new Date(),
  hariLibur: readonly string[] = [],
): KeadaanTenggat {
  const tahap = tahapBerjalan(status);
  if (!tahap) return { tahap: null, tenggat: null, status: "aman" };

  const tenggat = tahap === "administrasi" ? tenggatAdministrasi : tenggatSubstansi;
  return { tahap, tenggat, status: statusSla(tenggat, sekarang, 1, hariLibur) };
}

export type DokumenTenggat = {
  id: string;
  nomor: string;
  judul: string;
  status: StatusLingkungan;
  tenggatAdministrasi: Date | null;
  tenggatSubstansi: Date | null;
};

/**
 * Dokumen yang perlu didahulukan pengelola: tenggatnya sudah atau hampir lewat.
 * Yang menunggu tenant tidak ikut — mengingatkan pengelola atas keterlambatan
 * pihak lain hanya menambah kebisingan.
 */
export function lingkunganMendesak<T extends DokumenTenggat>(
  daftar: readonly T[],
  sekarang: Date = new Date(),
  hariLibur: readonly string[] = [],
): T[] {
  return daftar
    .map((d) => ({
      dokumen: d,
      keadaan: keadaanTenggat(
        d.status,
        d.tenggatAdministrasi,
        d.tenggatSubstansi,
        sekarang,
        hariLibur,
      ),
    }))
    .filter((x) => x.keadaan.tenggat !== null && x.keadaan.status !== "aman")
    .sort((a, b) => a.keadaan.tenggat!.getTime() - b.keadaan.tenggat!.getTime())
    .map((x) => x.dokumen);
}
