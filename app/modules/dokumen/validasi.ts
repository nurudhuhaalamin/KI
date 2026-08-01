import { z } from "zod";

import { KATEGORI_DOKUMEN, STATUS_DOKUMEN } from "~/lib/db/schema/dokumen";

const opsional = (maks: number) =>
  z
    .string()
    .trim()
    .max(maks)
    .optional()
    .transform((t) => (t === "" ? undefined : t));

const tanggalOpsional = z
  .string()
  .trim()
  .optional()
  .transform((t) => (t && /^\d{4}-\d{2}-\d{2}$/.test(t) ? new Date(`${t}T00:00:00Z`) : null));

/**
 * Nomor sengaja TIDAK ada di skema mana pun: nomor dibuat sistem dan tidak
 * pernah diterima dari formulir, sehingga tidak ada cara mengetiknya manual.
 */
export const skemaDokumenBaru = z.object({
  judul: z.string().trim().min(3, "Judul wajib diisi").max(200),
  judulEn: opsional(200),
  kategori: z.enum(KATEGORI_DOKUMEN),
  unitKerjaId: opsional(40),
  ringkasan: opsional(2000),
  tanggalTinjauUlang: tanggalOpsional,
});

/**
 * Kategori sengaja dihilangkan: nomor dokumen memuat singkatan kategorinya,
 * jadi mengubah kategori akan membuat nomor yang sudah beredar tidak lagi cocok
 * dengan isinya. Kategori ditetapkan sekali saat dokumen dibuat.
 */
export const skemaDokumenUbah = skemaDokumenBaru.omit({ kategori: true }).extend({
  status: z.enum(STATUS_DOKUMEN),
  tanggalTerbit: tanggalOpsional,
});

export const skemaRevisi = z.object({
  catatanRevisi: opsional(500),
});

export const skemaPengesahan = z.object({
  jabatanId: opsional(40),
  catatan: opsional(500),
});

export const skemaDistribusi = z.object({
  unitKerjaId: z.string().trim().min(1, "Unit kerja wajib dipilih"),
});

export type DokumenBaru = z.infer<typeof skemaDokumenBaru>;
