/**
 * Formulir yang bentuknya ditentukan data, bukan kode.
 *
 * Tiap kawasan menanyakan hal berbeda pada pemohon izin: yang satu butuh nomor
 * polisi kendaraan, yang lain butuh nama kontraktor dan tanggal mulai kerja.
 * Kalau kolomnya ditulis di kode, tiap pembeli baru berarti mengubah kode —
 * padahal sistem ini memang dijual berulang.
 *
 * Definisi kolom disimpan sebagai JSON di `jenis_izin.definisiKolom`. Halaman
 * pengajuan merender dari definisi itu dan server memvalidasi dari definisi yang
 * SAMA. Satu sumber kebenaran; dua daftar terpisah pasti akan berbeda suatu hari
 * dan yang bocor selalu sisi server.
 */

export const TIPE_KOLOM = ["teks", "teks-panjang", "angka", "tanggal", "pilihan"] as const;
export type TipeKolom = (typeof TIPE_KOLOM)[number];

export type DefinisiKolom = {
  /** Nama teknis, dipakai sebagai kunci jawaban dan atribut `name`. */
  nama: string;
  label: string;
  labelEn?: string;
  tipe: TipeKolom;
  wajib: boolean;
  /** Hanya untuk tipe `pilihan`. */
  pilihan?: string[];
  petunjuk?: string;
};

/** Nama kolom yang aman dipakai sebagai atribut `name` pada formulir. */
const NAMA_SAH = /^[a-z][a-z0-9_]{0,39}$/;

function adalahTipeKolom(nilai: unknown): nilai is TipeKolom {
  return typeof nilai === "string" && (TIPE_KOLOM as readonly string[]).includes(nilai);
}

/**
 * Membaca definisi kolom dari JSON yang tersimpan.
 *
 * Sengaja memaafkan: baris yang bentuknya salah dibuang, bukan melempar galat.
 * Definisi ditulis manusia lewat antarmuka pengaturan, dan satu baris rusak
 * tidak boleh membuat seluruh halaman perizinan mati. Yang tidak dimaafkan
 * adalah isian pemohon — itu divalidasi ketat di `validasiIsian()`.
 */
export function bacaDefinisi(json: string | null | undefined): DefinisiKolom[] {
  if (!json) return [];

  let mentah: unknown;
  try {
    mentah = JSON.parse(json);
  } catch {
    return [];
  }
  if (!Array.isArray(mentah)) return [];

  const hasil: DefinisiKolom[] = [];
  const namaTerpakai = new Set<string>();

  for (const baris of mentah) {
    if (typeof baris !== "object" || baris === null) continue;
    const isi = baris as Record<string, unknown>;

    const nama = typeof isi.nama === "string" ? isi.nama.trim() : "";
    if (!NAMA_SAH.test(nama) || namaTerpakai.has(nama)) continue;
    if (!adalahTipeKolom(isi.tipe)) continue;

    const pilihan = Array.isArray(isi.pilihan)
      ? isi.pilihan.filter((p): p is string => typeof p === "string" && p.trim() !== "")
      : undefined;

    // Kolom pilihan tanpa pilihan tidak mungkin diisi siapa pun.
    if (isi.tipe === "pilihan" && (!pilihan || pilihan.length === 0)) continue;

    namaTerpakai.add(nama);
    hasil.push({
      nama,
      label: typeof isi.label === "string" && isi.label.trim() !== "" ? isi.label.trim() : nama,
      labelEn: typeof isi.labelEn === "string" ? isi.labelEn.trim() : undefined,
      tipe: isi.tipe,
      wajib: isi.wajib === true,
      pilihan,
      petunjuk: typeof isi.petunjuk === "string" ? isi.petunjuk.trim() : undefined,
    });
  }

  return hasil;
}

export type GalatIsian = {
  kolom: string;
  sebab: "wajib" | "bukanAngka" | "bukanTanggal" | "diLuarPilihan" | "terlaluPanjang";
};

export const PANJANG_MAKSIMUM: Record<TipeKolom, number> = {
  teks: 200,
  "teks-panjang": 2000,
  angka: 20,
  tanggal: 10,
  pilihan: 100,
};

/**
 * Memvalidasi jawaban pemohon terhadap definisi kolom.
 *
 * Kunci yang tidak ada di definisi DIBUANG, bukan disimpan — kalau tidak,
 * siapa pun bisa menambah kolom sendiri di formulir dan menitipkan data
 * sembarang ke dalam JSON yang tersimpan.
 */
export function validasiIsian(
  definisi: readonly DefinisiKolom[],
  isian: Record<string, unknown>,
):
  { berhasil: true; nilai: Record<string, string> } | { berhasil: false; galat: GalatIsian[] } {
  const galat: GalatIsian[] = [];
  const nilai: Record<string, string> = {};

  for (const kolom of definisi) {
    const mentah = isian[kolom.nama];
    const teks =
      typeof mentah === "string" ? mentah.trim() : mentah == null ? "" : String(mentah);

    if (teks === "") {
      if (kolom.wajib) galat.push({ kolom: kolom.nama, sebab: "wajib" });
      continue;
    }

    if (teks.length > PANJANG_MAKSIMUM[kolom.tipe]) {
      galat.push({ kolom: kolom.nama, sebab: "terlaluPanjang" });
      continue;
    }

    if (kolom.tipe === "angka" && !/^-?\d+([.,]\d+)?$/.test(teks)) {
      galat.push({ kolom: kolom.nama, sebab: "bukanAngka" });
      continue;
    }

    if (kolom.tipe === "tanggal" && !adalahTanggal(teks)) {
      galat.push({ kolom: kolom.nama, sebab: "bukanTanggal" });
      continue;
    }

    if (kolom.tipe === "pilihan" && !(kolom.pilihan ?? []).includes(teks)) {
      galat.push({ kolom: kolom.nama, sebab: "diLuarPilihan" });
      continue;
    }

    nilai[kolom.nama] = teks;
  }

  return galat.length > 0 ? { berhasil: false, galat } : { berhasil: true, nilai };
}

/** Tanggal berbentuk YYYY-MM-DD yang benar-benar ada di kalender. */
function adalahTanggal(teks: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(teks)) return false;
  const waktu = new Date(`${teks}T00:00:00Z`);
  return !Number.isNaN(waktu.getTime()) && waktu.toISOString().slice(0, 10) === teks;
}

/** Membaca jawaban tersimpan untuk ditampilkan kembali. */
export function bacaIsian(json: string | null | undefined): Record<string, string> {
  if (!json) return {};

  let mentah: unknown;
  try {
    mentah = JSON.parse(json);
  } catch {
    return {};
  }
  if (typeof mentah !== "object" || mentah === null || Array.isArray(mentah)) return {};

  const hasil: Record<string, string> = {};
  for (const [kunci, nilai] of Object.entries(mentah as Record<string, unknown>)) {
    if (typeof nilai === "string") hasil[kunci] = nilai;
  }
  return hasil;
}

/**
 * Menggabungkan definisi dan jawaban menjadi daftar siap tampil.
 * Kolom yang tidak dijawab tetap muncul supaya pemeriksa tahu apa yang kosong,
 * bukan mengira pertanyaannya memang tidak ada.
 */
export function ringkasJawaban(
  definisi: readonly DefinisiKolom[],
  isian: Record<string, string>,
  locale: "id" | "en" = "id",
): { label: string; nilai: string | null }[] {
  return definisi.map((kolom) => ({
    label: (locale === "en" && kolom.labelEn) || kolom.label,
    nilai: isian[kolom.nama]?.trim() || null,
  }));
}
