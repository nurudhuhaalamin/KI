import type { KategoriDokumen, StatusDokumen } from "~/lib/db/schema/dokumen";
import {
  susunNomor as susunNomorUmum,
  urutBerikutnya as urutBerikutnyaUmum,
} from "~/lib/penomoran";

/**
 * Pola bawaan bila kawasan belum mengaturnya sendiri.
 *
 * Tetap memakai `{kategori}`, bukan `{seri}` milik penomoran umum: pola ini
 * sudah tersimpan di tabel `pengaturan` pada instans yang berjalan, dan
 * penomoran umum memang mengenali keduanya.
 */
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
 * Penyusunannya dikerjakan penomoran umum di `~/lib/penomoran`; yang khas
 * dokumen hanyalah penerjemahan kategori menjadi singkatannya.
 */
export function susunNomor(pola: string, bagian: BagianNomor): string {
  return susunNomorUmum(pola, {
    seri: SINGKATAN_KATEGORI[bagian.kategori],
    kodeUnit: bagian.kodeUnit,
    urut: bagian.urut,
    tahun: bagian.tahun,
  });
}

/** Nomor urut berikutnya untuk satu kategori dokumen pada satu tahun. */
export function urutBerikutnya(
  terpakai: readonly { kategori: KategoriDokumen; tahun: number; urut: number }[],
  kategori: KategoriDokumen,
  tahun: number,
): number {
  return urutBerikutnyaUmum(
    terpakai.map((d) => ({ seri: d.kategori, tahun: d.tahun, urut: d.urut })),
    kategori,
    tahun,
  );
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
