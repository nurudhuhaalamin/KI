import { sql } from "drizzle-orm";
import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const STATUS_TENANT = ["calon", "aktif", "berakhir"] as const;
export type StatusTenant = (typeof STATUS_TENANT)[number];

/**
 * Perusahaan penyewa/pembeli kavling.
 *
 * PERHATIAN DATA PRIBADI. Kolom npwp, nib, kontakNama, kontakSurel, dan
 * kontakTelepon termasuk data yang menurut .claude/rules/keamanan.md tidak
 * boleh masuk log, pesan galat, maupun respons yang tidak memerlukannya.
 *
 * Aturan turunannya:
 * - jejak audit untuk entitas ini hanya menyebut `kode` dan nama field yang
 *   berubah, tidak pernah nilainya;
 * - direktori publik memakai proyeksi `KOLOM_PUBLIK` di modules/tenant/query.ts
 *   yang sama sekali tidak memuat kolom-kolom di atas.
 */
export const tenant = sqliteTable(
  "tenant",
  {
    id: text("id").primaryKey(),
    kode: text("kode").notNull().unique(),
    namaPerusahaan: text("nama_perusahaan").notNull(),
    bentukBadanUsaha: text("bentuk_badan_usaha"),
    bidangUsaha: text("bidang_usaha"),
    alamat: text("alamat"),

    // --- data sensitif, lihat catatan di atas ---
    npwp: text("npwp"),
    nib: text("nib"),
    kontakNama: text("kontak_nama"),
    kontakJabatan: text("kontak_jabatan"),
    kontakSurel: text("kontak_surel"),
    kontakTelepon: text("kontak_telepon"),
    // -------------------------------------------

    status: text("status", { enum: STATUS_TENANT }).notNull().default("calon"),
    aktif: integer("aktif", { mode: "boolean" }).notNull().default(true),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
    updatedAt: integer("updated_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
  },
  (t) => [
    index("idx_tenant_status").on(t.status),
    index("idx_tenant_nama").on(t.namaPerusahaan),
  ],
);
