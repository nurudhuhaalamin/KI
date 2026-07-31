import type { JenisKontrak, StatusKontrak } from "~/lib/db/schema/kontrak";
import type { StatusKavling } from "~/lib/db/schema/kavling";

export type MasaKontrak = {
  id: string;
  jenis: JenisKontrak;
  status: StatusKontrak;
  tanggalMulai: Date;
  tanggalBerakhir: Date | null;
};

/**
 * Memeriksa apakah kontrak baru bertabrakan dengan kontrak lain pada kavling
 * yang sama.
 *
 * Hanya kontrak berstatus `draf` dan `aktif` yang diperhitungkan; yang sudah
 * `berakhir` atau `batal` tidak lagi mengikat kavling.
 *
 * Kontrak jual-beli tidak punya tanggal berakhir — ia mengikat kavling
 * selamanya, sehingga kontrak apa pun sesudahnya dianggap tumpang tindih.
 */
export function adaTumpangTindih(
  kontrakLain: readonly MasaKontrak[],
  calon: { tanggalMulai: Date; tanggalBerakhir: Date | null },
  kecualikanId?: string,
): boolean {
  const mengikat = kontrakLain.filter(
    (k) => k.id !== kecualikanId && (k.status === "draf" || k.status === "aktif"),
  );

  const awalCalon = calon.tanggalMulai.getTime();
  const akhirCalon = calon.tanggalBerakhir?.getTime() ?? Number.POSITIVE_INFINITY;

  return mengikat.some((k) => {
    const awalLain = k.tanggalMulai.getTime();
    const akhirLain = k.tanggalBerakhir?.getTime() ?? Number.POSITIVE_INFINITY;

    // Dua rentang bertabrakan bila masing-masing dimulai sebelum yang lain berakhir.
    return awalCalon <= akhirLain && awalLain <= akhirCalon;
  });
}

/**
 * Menurunkan status kavling dari kontrak-kontraknya.
 *
 * Status kavling bukan data yang disunting manual: ia selalu merupakan akibat
 * dari kontrak yang melekat padanya. Menyimpannya di tabel hanya agar daftar
 * kavling tidak perlu menghitung ulang tiap baris.
 */
export function hitungStatusKavling(
  kontrakKavling: readonly MasaKontrak[],
  sekarang: Date = new Date(),
): StatusKavling {
  const waktu = sekarang.getTime();

  const sedangBerlaku = kontrakKavling.filter((k) => {
    if (k.status !== "aktif") return false;
    const mulai = k.tanggalMulai.getTime();
    const akhir = k.tanggalBerakhir?.getTime() ?? Number.POSITIVE_INFINITY;
    return mulai <= waktu && waktu <= akhir;
  });

  if (sedangBerlaku.some((k) => k.jenis === "jual")) return "terjual";
  if (sedangBerlaku.some((k) => k.jenis === "sewa")) return "disewa";

  // Draf mengikat kavling agar tidak ditawarkan ke calon lain, tetapi belum
  // berarti tersewa atau terjual.
  if (kontrakKavling.some((k) => k.status === "draf")) return "dipesan";

  return "tersedia";
}

/** Alasan penolakan yang bisa diterjemahkan di tampilan. */
export type GalatKontrak = "tanggalBerakhirWajib" | "tanggalTerbalik" | "tumpangTindih";

/**
 * Memvalidasi rentang tanggal kontrak. Sewa wajib punya tanggal berakhir;
 * jual-beli tidak boleh punya karena kepemilikannya tidak berbatas waktu.
 */
export function periksaTanggal(
  jenis: JenisKontrak,
  tanggalMulai: Date,
  tanggalBerakhir: Date | null,
): GalatKontrak | null {
  if (jenis === "sewa" && !tanggalBerakhir) return "tanggalBerakhirWajib";
  if (tanggalBerakhir && tanggalBerakhir.getTime() <= tanggalMulai.getTime()) {
    return "tanggalTerbalik";
  }
  return null;
}

/** Kontrak yang sudah aktif tidak boleh langsung dihapus, hanya diakhiri atau dibatalkan. */
export function bolehUbahStatus(dari: StatusKontrak, ke: StatusKontrak): boolean {
  const diizinkan: Record<StatusKontrak, StatusKontrak[]> = {
    draf: ["draf", "aktif", "batal"],
    aktif: ["aktif", "berakhir", "batal"],
    berakhir: ["berakhir"],
    batal: ["batal"],
  };
  return diizinkan[dari].includes(ke);
}
