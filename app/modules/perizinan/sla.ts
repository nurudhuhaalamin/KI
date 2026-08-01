/**
 * Perhitungan janji layanan (SLA).
 *
 * Kawasan menjanjikan "5 hari kerja", bukan "5 hari". Menghitungnya sebagai hari
 * kalender membuat tenggat yang jatuh pada Sabtu dianggap terlambat padahal
 * kantor memang tutup — dan itu yang membuat laporan ketepatan layanan tidak
 * dipercaya siapa pun.
 *
 * Seluruh fungsi di sini murni: hari libur diberikan pemanggil, bukan dibaca
 * dari database, supaya bisa diuji tanpa apa pun.
 */

/** Tanggal dalam bentuk `YYYY-MM-DD` menurut UTC. */
export function keTanggalUtc(waktu: Date): string {
  return waktu.toISOString().slice(0, 10);
}

/** Sabtu dan Minggu bukan hari kerja. */
export function hariKerja(waktu: Date, hariLibur: readonly string[] = []): boolean {
  const hari = waktu.getUTCDay();
  if (hari === 0 || hari === 6) return false;
  return !hariLibur.includes(keTanggalUtc(waktu));
}

const SEHARI = 24 * 60 * 60 * 1000;

/**
 * Tenggat penyelesaian: `slaHari` hari kerja setelah tanggal pengajuan.
 *
 * Hari pengajuan tidak dihitung — janji "3 hari kerja" untuk berkas yang masuk
 * Senin berarti selesai Kamis, bukan Rabu. Tenggat selalu jatuh pada hari kerja;
 * `slaHari` nol atau negatif berarti harus selesai pada hari kerja pertama sejak
 * pengajuan (mis. layanan yang dijanjikan "hari itu juga").
 */
export function hitungTenggat(
  diajukan: Date,
  slaHari: number,
  hariLibur: readonly string[] = [],
): Date {
  // Mulai dari tengah malam UTC supaya jam pengajuan tidak menggeser hasilnya.
  let tanggal = new Date(
    Date.UTC(diajukan.getUTCFullYear(), diajukan.getUTCMonth(), diajukan.getUTCDate()),
  );

  const langkah = Math.max(1, Math.floor(slaHari));
  let terlewati = 0;
  while (terlewati < langkah) {
    tanggal = new Date(tanggal.getTime() + SEHARI);
    if (hariKerja(tanggal, hariLibur)) terlewati += 1;
  }

  return tanggal;
}

/** Sisa hari kerja menuju tenggat; negatif berarti sudah terlambat. */
export function sisaHariKerja(
  tenggat: Date,
  sekarang: Date,
  hariLibur: readonly string[] = [],
): number {
  const awal = new Date(
    Date.UTC(sekarang.getUTCFullYear(), sekarang.getUTCMonth(), sekarang.getUTCDate()),
  );
  const akhir = new Date(
    Date.UTC(tenggat.getUTCFullYear(), tenggat.getUTCMonth(), tenggat.getUTCDate()),
  );

  const mundur = akhir.getTime() < awal.getTime();
  const [dari, sampai] = mundur ? [akhir, awal] : [awal, akhir];

  let jumlah = 0;
  let jalan = dari;
  while (jalan.getTime() < sampai.getTime()) {
    jalan = new Date(jalan.getTime() + SEHARI);
    if (hariKerja(jalan, hariLibur)) jumlah += 1;
  }

  return mundur ? -jumlah : jumlah;
}

export type StatusSla = "aman" | "mendekati" | "terlambat";

/**
 * Warna lampu antrean kerja. `mendekati` sengaja dipisah supaya pengelola
 * sempat bertindak sebelum janji dilanggar, bukan setelah.
 */
export function statusSla(
  tenggat: Date | null,
  sekarang: Date = new Date(),
  ambangMendekati = 1,
  hariLibur: readonly string[] = [],
): StatusSla {
  if (!tenggat) return "aman";

  const sisa = sisaHariKerja(tenggat, sekarang, hariLibur);
  if (sisa < 0) return "terlambat";
  return sisa <= ambangMendekati ? "mendekati" : "aman";
}

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

/**
 * Membaca daftar hari libur dari nilai pengaturan kawasan.
 *
 * Bentuknya sengaja longgar — dipisah koma atau baris baru — karena yang
 * mengisinya administrator kawasan lewat kolom teks biasa, bukan berkas JSON.
 * Nilai yang tidak berbentuk tanggal diabaikan diam-diam supaya salah ketik
 * tidak menggagalkan seluruh perhitungan tenggat.
 */
export function bacaHariLibur(nilai: string | null | undefined): string[] {
  if (!nilai) return [];
  return nilai
    .split(/[\s,;]+/)
    .map((bagian) => bagian.trim())
    .filter((bagian) => /^\d{4}-\d{2}-\d{2}$/.test(bagian));
}
