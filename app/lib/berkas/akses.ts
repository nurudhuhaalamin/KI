import { eq } from "drizzle-orm";

import type { PenggunaSesi } from "../auth/sesi";
import type { Db } from "../db";
import { versiDokumen } from "../db/schema/dokumen";
import { kontrak, lampiranKontrak } from "../db/schema/kontrak";
import { berkasPermohonan, permohonan } from "../db/schema/perizinan";
import { ambilBerkas } from "./r2";

export const JENIS_BERKAS = ["lampiran-kontrak", "versi-dokumen", "berkas-permohonan"] as const;
export type JenisBerkas = (typeof JENIS_BERKAS)[number];

export function adalahJenisBerkas(nilai: string): nilai is JenisBerkas {
  return (JENIS_BERKAS as readonly string[]).includes(nilai);
}

type BerkasTerdaftar = {
  kunciR2: string;
  namaBerkas: string;
  tipeMime: string;
  /** Perusahaan pemilik, bila berkas ini terikat pada satu tenant. */
  tenantId: string | null;
  /**
   * Apakah staf pengelola boleh membukanya walau berkas ini milik tenant.
   *
   * Dibedakan per jenis berkas karena kepekaannya memang berbeda: lampiran
   * kontrak memuat nilai komersial yang bukan urusan staf, sedangkan lampiran
   * permohonan izin justru HARUS dibaca staf — dialah yang memeriksanya pada
   * tahap pertama. Satu aturan seragam akan salah pada salah satu di antaranya.
   */
  bolehStaf: boolean;
};

/**
 * Pemeriksaan izin unduhan yang dipakai SELURUH modul.
 *
 * Sengaja dijadikan satu tempat: setiap modul yang menyimpan berkas akan butuh
 * rute unduhan, dan menyalin logika izin ke tiap modul cepat atau lambat
 * menghasilkan satu salinan yang lupa memeriksanya. Modul baru cukup menambah
 * satu cabang di `cariBerkas()` di bawah.
 *
 * Aturannya:
 * - admin dan manajemen boleh mengunduh berkas mana pun;
 * - staf boleh mengunduh berkas yang tidak terikat tenant (mis. dokumen kawasan)
 *   dan berkas tenant yang memang menjadi bahan kerjanya (lampiran permohonan);
 * - pengguna tenant hanya boleh mengunduh berkas milik perusahaannya sendiri;
 * - selain itu `null` — pemanggil menjawabnya 404, bukan 403, supaya keberadaan
 *   berkas milik pihak lain tidak bisa disimpulkan dari kode statusnya.
 */
export async function ambilBerkasTerizin(
  env: Env,
  db: Db,
  pengguna: PenggunaSesi | null,
  jenis: JenisBerkas,
  id: string,
): Promise<{ objek: R2ObjectBody; namaBerkas: string; tipeMime: string } | null> {
  if (!pengguna) return null;

  const berkas = await cariBerkas(db, jenis, id);
  if (!berkas) return null;

  if (!bolehMengunduh(pengguna, berkas)) return null;

  const objek = await ambilBerkas(env, berkas.kunciR2);
  if (!objek) return null;

  return { objek, namaBerkas: berkas.namaBerkas, tipeMime: berkas.tipeMime };
}

function bolehMengunduh(pengguna: PenggunaSesi, berkas: BerkasTerdaftar): boolean {
  if (pengguna.peran === "admin" || pengguna.peran === "manajemen") return true;

  if (pengguna.peran === "tenant") {
    return berkas.tenantId !== null && berkas.tenantId === pengguna.tenantId;
  }

  // Staf pengelola: berkas kawasan, atau berkas tenant yang memang bahan kerjanya.
  return pengguna.peran === "staf" && (berkas.tenantId === null || berkas.bolehStaf);
}

async function cariBerkas(
  db: Db,
  jenis: JenisBerkas,
  id: string,
): Promise<BerkasTerdaftar | null> {
  if (jenis === "lampiran-kontrak") {
    const [baris] = await db
      .select({
        kunciR2: lampiranKontrak.kunciR2,
        namaBerkas: lampiranKontrak.namaBerkas,
        tipeMime: lampiranKontrak.tipeMime,
        tenantId: kontrak.tenantId,
      })
      .from(lampiranKontrak)
      .innerJoin(kontrak, eq(lampiranKontrak.kontrakId, kontrak.id))
      .where(eq(lampiranKontrak.id, id))
      .limit(1);
    // Lampiran kontrak memuat nilai komersial; bukan bahan kerja staf.
    return baris ? { ...baris, bolehStaf: false } : null;
  }

  if (jenis === "berkas-permohonan") {
    // Lampiran permohonan milik perusahaan yang mengajukannya.
    const [baris] = await db
      .select({
        kunciR2: berkasPermohonan.kunciR2,
        namaBerkas: berkasPermohonan.namaBerkas,
        tipeMime: berkasPermohonan.tipeMime,
        tenantId: permohonan.tenantId,
      })
      .from(berkasPermohonan)
      .innerJoin(permohonan, eq(berkasPermohonan.permohonanId, permohonan.id))
      .where(eq(berkasPermohonan.id, id))
      .limit(1);
    // Justru staf yang memeriksanya pada tahap pertama persetujuan.
    return baris ? { ...baris, bolehStaf: true } : null;
  }

  // Dokumen kawasan tidak terikat tenant mana pun.
  const [baris] = await db
    .select({
      kunciR2: versiDokumen.kunciR2,
      namaBerkas: versiDokumen.namaBerkas,
      tipeMime: versiDokumen.tipeMime,
    })
    .from(versiDokumen)
    .where(eq(versiDokumen.id, id))
    .limit(1);

  return baris ? { ...baris, tenantId: null, bolehStaf: true } : null;
}
