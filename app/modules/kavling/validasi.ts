import { z } from "zod";

import { PERUNTUKAN } from "~/lib/db/schema/kavling";

const kode = z
  .string()
  .trim()
  .toUpperCase()
  .min(2)
  .max(16)
  .regex(/^[A-Z0-9-]+$/, "Kode hanya boleh huruf kapital, angka, dan tanda hubung");

const teksPendek = z
  .string()
  .trim()
  .max(60)
  .optional()
  .transform((t) => (t === "" ? undefined : t));

export const skemaKavlingBaru = z.object({
  kode,
  blok: z.string().trim().min(1, "Blok wajib diisi").max(20),
  nomor: z.string().trim().min(1, "Nomor wajib diisi").max(20),
  luasM2: z.coerce.number().int().positive("Luas harus lebih dari nol").max(100_000_000),
  peruntukan: z.enum(PERUNTUKAN),
  hargaDasar: z.coerce.number().int().min(0).max(Number.MAX_SAFE_INTEGER).optional(),
  keterangan: z
    .string()
    .trim()
    .max(1000)
    .optional()
    .transform((t) => (t === "" ? undefined : t)),
});

export const skemaKavlingUbah = skemaKavlingBaru.omit({ kode: true }).extend({
  aktif: z.coerce.boolean().default(true),
});

export type KavlingBaru = z.infer<typeof skemaKavlingBaru>;
export { teksPendek };
