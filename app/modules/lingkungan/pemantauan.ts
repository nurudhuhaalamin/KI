/**
 * Kewajiban pemantauan yang melekat setelah persetujuan lingkungan terbit.
 *
 * Inilah yang membuat persetujuan tidak berhenti sebagai arsip. Tenant wajib
 * melapor berkala; kawasan yang menagihnya. Kalau penagihan itu tidak berjalan,
 * yang pertama ditanyakan pengawas justru bukan laporannya, melainkan mengapa
 * kawasan tidak tahu laporannya tidak masuk.
 *
 * Jadwal dihitung sebagai fungsi murni supaya periode dan jatuh tempo bisa
 * dipastikan tanpa database maupun jam sistem.
 */

import type { FrekuensiPemantauan, StatusLaporan } from "~/lib/db/schema/lingkungan";

/** Berapa bulan satu periode berlangsung. */
const BULAN_PER_PERIODE: Record<FrekuensiPemantauan, number> = {
  bulanan: 1,
  triwulanan: 3,
  semesteran: 6,
  tahunan: 12,
};

export type PeriodePemantauan = {
  /** Label periode yang stabil dan bisa diurutkan sebagai teks. */
  periode: string;
  mulai: Date;
  /** Hari terakhir periode; laporan jatuh tempo setelah periode berakhir. */
  akhir: Date;
  jatuhTempo: Date;
};

/**
 * Tenggang waktu pelaporan setelah periode berakhir.
 *
 * Laporan tidak mungkin dikirim pada hari terakhir periode yang dilaporkannya —
 * datanya belum lengkap. Tenggang inilah yang membuat jatuh tempo masuk akal.
 */
export const HARI_TENGGANG = 30;

function tambahBulan(tanggal: Date, bulan: number): Date {
  return new Date(
    Date.UTC(
      tanggal.getUTCFullYear(),
      tanggal.getUTCMonth() + bulan,
      tanggal.getUTCDate(),
      0,
      0,
      0,
    ),
  );
}

function labelPeriode(frekuensi: FrekuensiPemantauan, mulai: Date): string {
  const tahun = mulai.getUTCFullYear();
  const bulan = mulai.getUTCMonth();

  if (frekuensi === "tahunan") return String(tahun);
  if (frekuensi === "semesteran") return `${tahun}-S${Math.floor(bulan / 6) + 1}`;
  if (frekuensi === "triwulanan") return `${tahun}-TW${Math.floor(bulan / 3) + 1}`;
  return `${tahun}-${String(bulan + 1).padStart(2, "0")}`;
}

/**
 * Seluruh periode dari `mulai` sampai `sampai`.
 *
 * Periode yang sedang berjalan ikut dihasilkan supaya tenant melihat apa yang
 * sedang berlangsung, bukan hanya yang sudah lewat. Batas 200 periode menjaga
 * tanggal mulai yang salah ketik tidak menghasilkan daftar tak berujung.
 */
export function jadwalPemantauan(
  frekuensi: FrekuensiPemantauan,
  mulai: Date,
  sampai: Date,
  hariTenggang = HARI_TENGGANG,
): PeriodePemantauan[] {
  const langkah = BULAN_PER_PERIODE[frekuensi];
  const hasil: PeriodePemantauan[] = [];

  let awal = new Date(Date.UTC(mulai.getUTCFullYear(), mulai.getUTCMonth(), 1));
  const batas = new Date(Date.UTC(sampai.getUTCFullYear(), sampai.getUTCMonth(), 1));

  while (awal.getTime() <= batas.getTime() && hasil.length < 200) {
    const berikut = tambahBulan(awal, langkah);
    const akhir = new Date(berikut.getTime() - 24 * 60 * 60 * 1000);

    hasil.push({
      periode: labelPeriode(frekuensi, awal),
      mulai: awal,
      akhir,
      jatuhTempo: new Date(akhir.getTime() + hariTenggang * 24 * 60 * 60 * 1000),
    });

    awal = berikut;
  }

  return hasil;
}

export type LaporanRingkas = {
  id: string;
  periode: string;
  jatuhTempo: Date;
  status: StatusLaporan;
};

export type KeadaanLaporan = "aman" | "mendekati" | "terlambat" | "selesai";

/**
 * Keadaan satu laporan.
 *
 * Keterlambatan dihitung dari tanggal, bukan dibaca dari kolom status —
 * status yang disimpan akan basi begitu tanggalnya lewat tanpa ada yang
 * memperbaruinya, dan tidak ada yang menjalankan pekerjaan berkala di sini.
 */
export function keadaanLaporan(
  laporan: LaporanRingkas,
  sekarang: Date = new Date(),
  ambangHari = 7,
): KeadaanLaporan {
  if (laporan.status === "terkirim" || laporan.status === "diterima") return "selesai";

  const selisihHari = Math.floor(
    (laporan.jatuhTempo.getTime() - sekarang.getTime()) / (24 * 60 * 60 * 1000),
  );
  if (selisihHari < 0) return "terlambat";
  return selisihHari <= ambangHari ? "mendekati" : "aman";
}

/**
 * Laporan yang perlu ditagih: sudah lewat tempo atau hampir.
 * Yang sudah dikirim tidak ikut, sekalipun belum diperiksa pengelola — menagih
 * sesuatu yang sudah dikirim membuat tenant berhenti mempercayai pengingatnya.
 */
export function laporanTertunggak<T extends LaporanRingkas>(
  daftar: readonly T[],
  sekarang: Date = new Date(),
  ambangHari = 7,
): T[] {
  return daftar
    .filter((l) => {
      const keadaan = keadaanLaporan(l, sekarang, ambangHari);
      return keadaan === "terlambat" || keadaan === "mendekati";
    })
    .sort((a, b) => a.jatuhTempo.getTime() - b.jatuhTempo.getTime());
}

/**
 * Periode yang belum punya baris laporan.
 *
 * Dipakai saat membuka halaman: baris dibuat sesuai kebutuhan, bukan seluruhnya
 * di muka. Kewajiban tahunan yang berlaku sepuluh tahun tidak perlu membuat 120
 * baris kosong pada hari persetujuan terbit.
 */
export function periodeBelumTercatat(
  jadwal: readonly PeriodePemantauan[],
  sudahAda: readonly string[],
): PeriodePemantauan[] {
  const punya = new Set(sudahAda);
  return jadwal.filter((p) => !punya.has(p.periode));
}
