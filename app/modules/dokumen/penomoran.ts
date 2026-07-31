import type { KategoriDokumen, StatusDokumen } from "~/lib/db/schema/dokumen";

/** Pola bawaan bila kawasan belum mengaturnya sendiri. */
export const POLA_BAWAAN = "{kategori}/{unit}/{urut}/{tahun}";

/** Singkatan kategori yang dipakai di dalam nomor dokumen. */
export const SINGKATAN_KATEGORI: Record<KategoriDokumen, string> = {
  "tata-kelola": "TK",
  "sop-pelayanan": "SOP-PLY",
  "sop-infrastruktur": "SOP-INF",
  "sop-keamanan": "SOP-KMN",
  k3: "K3",
  "hubungan-industrial": "HI",
  governance: "GCG",
  pelaporan: "LAP",
};

export type BagianNomor = {
  kategori: KategoriDokumen;
  kodeUnit?: string | null;
  urut: number;
  tahun: number;
};

/**
 * Menyusun nomor dokumen dari pola.
 *
 * Placeholder yang dikenal: {kategori} {unit} {urut} {tahun}. Nomor urut
 * selalu tiga digit agar pengurutan menurut teks tetap benar (001, 002, … 010).
 * Placeholder {unit} yang tidak punya nilai dibuang beserta pemisahnya, supaya
 * tidak menyisakan garis miring ganda.
 */
export function susunNomor(pola: string, bagian: BagianNomor): string {
  const nilai: Record<string, string> = {
    kategori: SINGKATAN_KATEGORI[bagian.kategori],
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
 * Menentukan nomor urut berikutnya untuk satu kategori pada satu tahun.
 *
 * Memakai nilai tertinggi + 1, bukan jumlah baris. Dokumen yang ditarik atau
 * dihapus meninggalkan lompatan nomor, dan lompatan itu memang harus dibiarkan:
 * memakai ulang nomor yang pernah terbit akan membuat arsip dan surat yang
 * sudah beredar merujuk ke dokumen yang salah.
 */
export function urutBerikutnya(
  terpakai: readonly { kategori: KategoriDokumen; tahun: number; urut: number }[],
  kategori: KategoriDokumen,
  tahun: number,
): number {
  const sekelompok = terpakai.filter((d) => d.kategori === kategori && d.tahun === tahun);
  if (sekelompok.length === 0) return 1;
  return Math.max(...sekelompok.map((d) => d.urut)) + 1;
}

export type GalatDokumen =
  "sudahDisahkan" | "belumAdaBerkas" | "statusTidakBoleh" | "belumDitinjau";

/**
 * Dokumen yang sudah disahkan tidak boleh disunting isinya.
 *
 * Perubahan hanya boleh lewat revisi baru, yang mengembalikan statusnya ke
 * draf. Tanpa aturan ini, isi dokumen yang sudah beredar bisa berubah diam-diam
 * tanpa jejak versi — persis yang harus dicegah pengendalian dokumen.
 */
export function bolehSuntingIsi(status: StatusDokumen): boolean {
  return status === "draf" || status === "ditinjau";
}

/** Perpindahan status yang diizinkan. */
export function bolehUbahStatusDokumen(dari: StatusDokumen, ke: StatusDokumen): boolean {
  const diizinkan: Record<StatusDokumen, StatusDokumen[]> = {
    draf: ["draf", "ditinjau"],
    ditinjau: ["ditinjau", "draf", "disahkan"],
    disahkan: ["disahkan", "kedaluwarsa", "ditarik"],
    kedaluwarsa: ["kedaluwarsa", "ditarik", "draf"],
    ditarik: ["ditarik"],
  };
  return diizinkan[dari].includes(ke);
}

/** Dokumen hanya bisa disahkan bila sudah punya berkas dan sudah ditinjau. */
export function bolehDisahkan(
  status: StatusDokumen,
  versiTerkini: number,
): GalatDokumen | null {
  if (versiTerkini < 1) return "belumAdaBerkas";
  if (status !== "ditinjau") return "belumDitinjau";
  return null;
}

export type DokumenTinjau = {
  id: string;
  nomor: string;
  judul: string;
  tanggalTinjauUlang: Date | null;
  status: StatusDokumen;
};

/**
 * Dokumen yang perlu ditinjau ulang: sudah lewat tanggalnya, atau akan lewat
 * dalam `ambangHari` ke depan. Hanya dokumen yang sedang berlaku yang dihitung —
 * yang masih draf atau sudah ditarik tidak perlu diingatkan.
 */
export function dokumenJatuhTempo(
  daftar: readonly DokumenTinjau[],
  sekarang: Date = new Date(),
  ambangHari = 30,
): DokumenTinjau[] {
  const batas = sekarang.getTime() + ambangHari * 24 * 60 * 60 * 1000;

  return daftar
    .filter((d) => d.status === "disahkan" || d.status === "kedaluwarsa")
    .filter((d) => d.tanggalTinjauUlang !== null && d.tanggalTinjauUlang.getTime() <= batas)
    .sort((a, b) => a.tanggalTinjauUlang!.getTime() - b.tanggalTinjauUlang!.getTime());
}
