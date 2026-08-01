/**
 * Penomoran bersama seluruh modul.
 *
 * Modul C (dokumen) yang pertama membutuhkannya, tetapi modul D sampai M
 * semuanya menghasilkan keluaran bernomor: surat izin, berita acara pemeriksaan,
 * SK persetujuan, invoice, laporan audit. Kalau tiap modul menomori dengan
 * caranya sendiri, cepat atau lambat ada dua modul yang menerbitkan nomor sama
 * dan rujukan antar modul tidak lagi bisa dipercaya.
 *
 * Karena itu fungsinya generik terhadap "seri" — teks singkatan apa pun yang
 * dipilih modul pemakainya — dan tidak tahu apa-apa tentang dokumen maupun izin.
 */

/** Pola bawaan bila kawasan belum mengaturnya sendiri. */
export const POLA_BAWAAN = "{seri}/{unit}/{urut}/{tahun}";

export type BagianNomor = {
  /** Singkatan seri, mis. `SOP-PLY` untuk dokumen atau `IK` untuk izin kerja. */
  seri: string;
  kodeUnit?: string | null;
  urut: number;
  tahun: number;
  /** Placeholder tambahan khusus modul, mis. `{jenis}`. */
  tambahan?: Record<string, string>;
};

/**
 * Menyusun nomor dari pola.
 *
 * Placeholder yang dikenal: {seri} {kategori} {unit} {urut} {tahun}, ditambah
 * apa pun yang diberikan lewat `tambahan`. `{kategori}` sengaja tetap dikenali
 * dan berarti sama dengan `{seri}`: pola yang sudah tersimpan di tabel
 * `pengaturan` milik kawasan memakai nama itu, dan mengubahnya diam-diam akan
 * membuat nomor berikutnya berbeda bentuk dari yang sudah terbit.
 *
 * Nomor urut selalu tiga digit agar pengurutan menurut teks tetap benar
 * (001, 002, … 010). Placeholder yang tidak punya nilai dibuang beserta
 * pemisahnya, supaya tidak menyisakan garis miring ganda.
 */
export function susunNomor(pola: string, bagian: BagianNomor): string {
  const nilai: Record<string, string> = {
    ...bagian.tambahan,
    seri: bagian.seri,
    kategori: bagian.seri,
    unit: bagian.kodeUnit?.trim() ?? "",
    urut: String(bagian.urut).padStart(3, "0"),
    tahun: String(bagian.tahun),
  };

  const terisi = pola.replace(/\{(\w+)\}/g, (cocok, kunci: string) =>
    kunci in nilai ? nilai[kunci]! : cocok,
  );

  // Rapikan bekas placeholder kosong: "TK//001/2026" -> "TK/001/2026".
  return terisi
    .replace(/\/{2,}/g, "/")
    .replace(/^\/+|\/+$/g, "")
    .trim();
}

/**
 * Menentukan nomor urut berikutnya untuk satu seri pada satu tahun.
 *
 * Memakai nilai tertinggi + 1, bukan jumlah baris. Data yang ditarik atau
 * dihapus meninggalkan lompatan nomor, dan lompatan itu memang harus dibiarkan:
 * memakai ulang nomor yang pernah terbit akan membuat arsip dan surat yang
 * sudah beredar merujuk ke berkas yang salah.
 */
export function urutBerikutnya(
  terpakai: readonly { seri: string; tahun: number; urut: number }[],
  seri: string,
  tahun: number,
): number {
  const sekelompok = terpakai.filter((d) => d.seri === seri && d.tahun === tahun);
  if (sekelompok.length === 0) return 1;
  return Math.max(...sekelompok.map((d) => d.urut)) + 1;
}
