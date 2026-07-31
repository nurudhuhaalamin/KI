import { sql } from "drizzle-orm";
import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

import { users } from "./auth";
import { kavling } from "./kavling";
import { tenant } from "./tenant";

export const JENIS_KONTRAK = ["jual", "sewa"] as const;
export type JenisKontrak = (typeof JENIS_KONTRAK)[number];

export const STATUS_KONTRAK = ["draf", "aktif", "berakhir", "batal"] as const;
export type StatusKontrak = (typeof STATUS_KONTRAK)[number];

/** Perjanjian jual-beli atau sewa kavling antara pengelola dan tenant. */
export const kontrak = sqliteTable(
  "kontrak",
  {
    id: text("id").primaryKey(),
    nomor: text("nomor").notNull().unique(),
    jenis: text("jenis", { enum: JENIS_KONTRAK }).notNull(),
    tenantId: text("tenant_id")
      .notNull()
      .references(() => tenant.id, { onDelete: "restrict" }),
    kavlingId: text("kavling_id")
      .notNull()
      .references(() => kavling.id, { onDelete: "restrict" }),
    tanggalMulai: integer("tanggal_mulai", { mode: "timestamp" }).notNull(),
    // Kosong untuk kontrak jual-beli, wajib untuk sewa.
    tanggalBerakhir: integer("tanggal_berakhir", { mode: "timestamp" }),
    nilai: integer("nilai").notNull().default(0),
    status: text("status", { enum: STATUS_KONTRAK }).notNull().default("draf"),
    keterangan: text("keterangan"),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
    updatedAt: integer("updated_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
  },
  (t) => [
    index("idx_kontrak_tenant").on(t.tenantId),
    index("idx_kontrak_kavling").on(t.kavlingId),
    index("idx_kontrak_status").on(t.status),
  ],
);

export const JENIS_FASILITAS = ["ipal", "jalan", "air", "listrik", "telekomunikasi"] as const;
export type JenisFasilitas = (typeof JENIS_FASILITAS)[number];

/** Perjanjian pemakaian fasilitas bersama yang menempel pada kontrak induk. */
export const kontrakFasilitas = sqliteTable(
  "kontrak_fasilitas",
  {
    id: text("id").primaryKey(),
    kontrakId: text("kontrak_id")
      .notNull()
      .references(() => kontrak.id, { onDelete: "cascade" }),
    jenis: text("jenis", { enum: JENIS_FASILITAS }).notNull(),
    kuotaBulanan: integer("kuota_bulanan"),
    satuan: text("satuan"),
    keterangan: text("keterangan"),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
  },
  (t) => [index("idx_kontrak_fasilitas_kontrak").on(t.kontrakId)],
);

/**
 * Lampiran dokumen kontrak yang tersimpan di R2.
 *
 * `kunciR2` dibuat sistem dan TIDAK PERNAH dikirim ke klien — unduhan selalu
 * lewat rute yang memeriksa hak akses lebih dulu. `namaBerkas` hanya nama asli
 * dari pengguna untuk ditampilkan, tidak dipakai sebagai path penyimpanan.
 */
export const lampiranKontrak = sqliteTable(
  "lampiran_kontrak",
  {
    id: text("id").primaryKey(),
    kontrakId: text("kontrak_id")
      .notNull()
      .references(() => kontrak.id, { onDelete: "cascade" }),
    namaBerkas: text("nama_berkas").notNull(),
    kunciR2: text("kunci_r2").notNull(),
    ukuran: integer("ukuran").notNull(),
    tipeMime: text("tipe_mime").notNull(),
    diunggahOleh: text("diunggah_oleh").references(() => users.id, { onDelete: "set null" }),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
  },
  (t) => [index("idx_lampiran_kontrak").on(t.kontrakId)],
);
