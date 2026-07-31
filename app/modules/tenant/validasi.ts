import { z } from "zod";

import { STATUS_TENANT } from "~/lib/db/schema/tenant";

const opsional = (maks: number) =>
  z
    .string()
    .trim()
    .max(maks)
    .optional()
    .transform((t) => (t === "" ? undefined : t));

export const skemaTenantBaru = z.object({
  kode: z
    .string()
    .trim()
    .toUpperCase()
    .min(2)
    .max(16)
    .regex(/^[A-Z0-9-]+$/, "Kode hanya boleh huruf kapital, angka, dan tanda hubung"),
  namaPerusahaan: z.string().trim().min(2, "Nama perusahaan wajib diisi").max(160),
  bentukBadanUsaha: opsional(40),
  bidangUsaha: opsional(120),
  alamat: opsional(400),

  // Data sensitif. Divalidasi bentuknya, tetapi tidak pernah ikut ke log
  // maupun jejak audit — lihat catatan di app/lib/db/schema/tenant.ts.
  npwp: opsional(30),
  nib: opsional(30),
  kontakNama: opsional(120),
  kontakJabatan: opsional(80),
  kontakSurel: z
    .union([z.string().trim().toLowerCase().email("Alamat surel tidak valid"), z.literal("")])
    .optional()
    .transform((t) => (t === "" ? undefined : t)),
  kontakTelepon: opsional(40),

  status: z.enum(STATUS_TENANT).default("calon"),
});

export const skemaTenantUbah = skemaTenantBaru.omit({ kode: true }).extend({
  aktif: z.coerce.boolean().default(true),
});

export type TenantBaru = z.infer<typeof skemaTenantBaru>;
