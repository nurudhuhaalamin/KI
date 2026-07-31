import { z } from "zod";

import { PERAN } from "~/lib/db/schema/auth";

/**
 * Kode unit kerja dan jabatan dipakai modul lain sebagai rujukan stabil
 * (penomoran dokumen, kepemilikan proses), jadi bentuknya dibatasi ketat dan
 * tidak bisa diubah setelah dibuat.
 */
const kode = z
  .string()
  .trim()
  .min(2, "Kode minimal 2 karakter")
  .max(16, "Kode maksimal 16 karakter")
  .regex(/^[A-Z0-9-]+$/, "Kode hanya boleh huruf kapital, angka, dan tanda hubung");

const nama = z.string().trim().min(2, "Nama minimal 2 karakter").max(120);
const namaOpsional = z
  .string()
  .trim()
  .max(120)
  .optional()
  .transform((n) => (n === "" ? undefined : n));
const teksPanjang = z
  .string()
  .trim()
  .max(2000)
  .optional()
  .transform((t) => (t === "" ? undefined : t));
const rujukanOpsional = z
  .string()
  .trim()
  .optional()
  .transform((r) => (r === "" ? undefined : r));

export const skemaUnitKerjaBaru = z.object({
  kode,
  nama,
  namaEn: namaOpsional,
  fungsi: teksPanjang,
  indukId: rujukanOpsional,
  urutan: z.coerce.number().int().min(0).max(9999).default(0),
});

export const skemaUnitKerjaUbah = skemaUnitKerjaBaru.omit({ kode: true }).extend({
  aktif: z.coerce.boolean().default(true),
});

export const skemaJabatanBaru = z.object({
  kode,
  nama,
  namaEn: namaOpsional,
  unitKerjaId: z.string().trim().min(1, "Unit kerja wajib dipilih"),
  atasanId: rujukanOpsional,
  ringkasanTugas: teksPanjang,
});

export const skemaJabatanUbah = skemaJabatanBaru.omit({ kode: true }).extend({
  aktif: z.coerce.boolean().default(true),
});

export const skemaPenggunaBaru = z.object({
  nama,
  surel: z.string().trim().toLowerCase().email("Alamat surel tidak valid"),
  kataSandi: z.string().min(12, "Kata sandi minimal 12 karakter").max(128),
  peran: z.enum(PERAN),
  unitKerjaId: rujukanOpsional,
  jabatanId: rujukanOpsional,
});

export const skemaPenggunaUbah = z.object({
  nama,
  peran: z.enum(PERAN),
  aktif: z.coerce.boolean().default(true),
  unitKerjaId: rujukanOpsional,
  jabatanId: rujukanOpsional,
});

export const skemaKataSandiBaru = z.object({
  kataSandi: z.string().min(12, "Kata sandi minimal 12 karakter").max(128),
});

export const skemaPengaturan = z.object({
  nama: z.string().trim().min(2).max(160),
  alamat: z.string().trim().max(500).optional(),
  kontakSurel: z
    .union([z.string().trim().email("Alamat surel tidak valid"), z.literal("")])
    .optional(),
  kontakTelepon: z.string().trim().max(40).optional(),
  localeBawaan: z.enum(["id", "en"]),
});

export type UnitKerjaBaru = z.infer<typeof skemaUnitKerjaBaru>;
export type JabatanBaru = z.infer<typeof skemaJabatanBaru>;
export type PenggunaBaru = z.infer<typeof skemaPenggunaBaru>;
