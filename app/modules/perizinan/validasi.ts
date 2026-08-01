import { z } from "zod";

import { KEPUTUSAN, PERAN_PEMUTUS } from "~/lib/db/schema/perizinan";

const opsional = (maks: number) =>
  z
    .string()
    .trim()
    .max(maks)
    .optional()
    .transform((t) => (t === "" ? undefined : t));

/**
 * Nomor permohonan sengaja TIDAK ada di skema mana pun: nomor dibuat sistem,
 * sama seperti nomor dokumen pada modul C.
 */
export const skemaJenisIzin = z.object({
  kode: z
    .string()
    .trim()
    .min(2, "Kode wajib diisi")
    .max(20)
    .regex(/^[A-Z0-9-]+$/, "Kode hanya boleh huruf kapital, angka, dan tanda hubung"),
  nama: z.string().trim().min(3, "Nama wajib diisi").max(120),
  namaEn: opsional(120),
  keterangan: opsional(1000),
  unitKerjaId: opsional(40),
  slaHari: z.coerce.number().int().min(0).max(365),
  definisiKolom: z.string().trim().max(20_000).optional(),
  aktif: z
    .string()
    .optional()
    .transform((t) => t === "on" || t === "true"),
});

export const skemaTahap = z.object({
  nama: z.string().trim().min(2, "Nama tahap wajib diisi").max(120),
  namaEn: opsional(120),
  peranPemutus: z.enum(PERAN_PEMUTUS),
  unitKerjaId: opsional(40),
});

export const skemaPermohonanBaru = z.object({
  jenisIzinId: z.string().trim().min(1, "Jenis izin wajib dipilih"),
  judul: z.string().trim().min(3, "Judul wajib diisi").max(200),
});

export const skemaPermohonanUbah = z.object({
  judul: z.string().trim().min(3, "Judul wajib diisi").max(200),
});

export const skemaKeputusan = z.object({
  keputusan: z.enum(KEPUTUSAN),
  catatan: opsional(1000),
});

export type JenisIzinBaru = z.infer<typeof skemaJenisIzin>;
