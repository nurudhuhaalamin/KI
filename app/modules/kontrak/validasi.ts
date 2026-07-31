import { z } from "zod";

import { JENIS_FASILITAS, JENIS_KONTRAK, STATUS_KONTRAK } from "~/lib/db/schema/kontrak";

/** Tanggal dari input type="date" (YYYY-MM-DD), dibaca sebagai UTC. */
const tanggal = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Format tanggal tidak valid")
  .transform((t) => new Date(`${t}T00:00:00Z`));

const tanggalOpsional = z
  .string()
  .trim()
  .optional()
  .transform((t) => (t && /^\d{4}-\d{2}-\d{2}$/.test(t) ? new Date(`${t}T00:00:00Z`) : null));

export const skemaKontrakBaru = z.object({
  nomor: z.string().trim().min(3, "Nomor kontrak wajib diisi").max(60),
  jenis: z.enum(JENIS_KONTRAK),
  tenantId: z.string().trim().min(1, "Tenant wajib dipilih"),
  kavlingId: z.string().trim().min(1, "Kavling wajib dipilih"),
  tanggalMulai: tanggal,
  tanggalBerakhir: tanggalOpsional,
  nilai: z.coerce.number().int().min(0).default(0),
  keterangan: z
    .string()
    .trim()
    .max(1000)
    .optional()
    .transform((t) => (t === "" ? undefined : t)),
});

export const skemaKontrakUbah = skemaKontrakBaru.omit({ nomor: true }).extend({
  status: z.enum(STATUS_KONTRAK),
});

export const skemaFasilitas = z.object({
  jenis: z.enum(JENIS_FASILITAS),
  kuotaBulanan: z.coerce.number().int().min(0).optional(),
  satuan: z
    .string()
    .trim()
    .max(20)
    .optional()
    .transform((t) => (t === "" ? undefined : t)),
  keterangan: z
    .string()
    .trim()
    .max(500)
    .optional()
    .transform((t) => (t === "" ? undefined : t)),
});

export type KontrakBaru = z.infer<typeof skemaKontrakBaru>;
