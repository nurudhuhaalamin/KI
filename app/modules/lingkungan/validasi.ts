import { z } from "zod";

import {
  FREKUENSI_PEMANTAUAN,
  HASIL_KEPUTUSAN,
  JENIS_DOKUMEN_LINGKUNGAN,
  PERAN_ANGGOTA,
  TAHAP_PEMERIKSAAN,
} from "~/lib/db/schema/lingkungan";

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
 * Nomor dokumen dan nomor keputusan sengaja TIDAK ada di skema mana pun: dibuat
 * sistem, sama seperti nomor dokumen modul C dan nomor permohonan modul D.
 */
export const skemaDokumenLingkunganBaru = z.object({
  jenis: z.enum(JENIS_DOKUMEN_LINGKUNGAN),
  judul: z.string().trim().min(3, "Judul wajib diisi").max(200),
  kavlingId: opsional(40),
  ringkasanKegiatan: opsional(4000),
});

export const skemaDokumenLingkunganUbah = skemaDokumenLingkunganBaru.omit({ jenis: true });

export const skemaAnggotaTim = z.object({
  userId: z.string().trim().min(1, "Anggota wajib dipilih"),
  peran: z.enum(PERAN_ANGGOTA),
});

export const skemaCatatan = z.object({
  tahap: z.enum(TAHAP_PEMERIKSAAN),
  aspek: z.string().trim().min(2, "Aspek wajib diisi").max(200),
  temuan: z.string().trim().min(3, "Temuan wajib diisi").max(4000),
  rekomendasi: opsional(4000),
});

export const skemaKeputusanLingkungan = z.object({
  hasil: z.enum(HASIL_KEPUTUSAN),
  jabatanId: opsional(40),
  berlakuSampai: tanggalOpsional,
  pertimbangan: opsional(4000),
});

export const skemaKewajiban = z.object({
  nama: z.string().trim().min(3, "Nama kewajiban wajib diisi").max(200),
  namaEn: opsional(200),
  frekuensi: z.enum(FREKUENSI_PEMANTAUAN),
  mulai: z
    .string()
    .trim()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Tanggal mulai wajib diisi")
    .transform((t) => new Date(`${t}T00:00:00Z`)),
});

export const skemaLaporan = z.object({
  laporanId: z.string().trim().min(1),
  catatan: opsional(1000),
});
