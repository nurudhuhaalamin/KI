import { sql } from "drizzle-orm";
import {
  index,
  integer,
  sqliteTable,
  text,
  type AnySQLiteColumn,
} from "drizzle-orm/sqlite-core";

/**
 * Struktur organisasi pengelola kawasan.
 *
 * Setara "Desain Struktur Organisasi" dan "Uraian Jabatan" pada dokumen tata
 * kelola. Modul lain menautkan kepemilikan proses ke unit kerja dan jabatan di
 * sini, jadi kode unit sengaja dibuat stabil dan tidak bisa diubah.
 */
export const unitKerja = sqliteTable(
  "unit_kerja",
  {
    id: text("id").primaryKey(),
    kode: text("kode").notNull().unique(),
    nama: text("nama").notNull(),
    namaEn: text("nama_en"),
    fungsi: text("fungsi"),
    indukId: text("induk_id").references((): AnySQLiteColumn => unitKerja.id, {
      onDelete: "set null",
    }),
    urutan: integer("urutan").notNull().default(0),
    aktif: integer("aktif", { mode: "boolean" }).notNull().default(true),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
    updatedAt: integer("updated_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
  },
  (t) => [
    index("idx_unit_kerja_induk").on(t.indukId),
    index("idx_unit_kerja_urutan").on(t.urutan),
  ],
);

export const jabatan = sqliteTable(
  "jabatan",
  {
    id: text("id").primaryKey(),
    kode: text("kode").notNull().unique(),
    nama: text("nama").notNull(),
    namaEn: text("nama_en"),
    unitKerjaId: text("unit_kerja_id")
      .notNull()
      .references(() => unitKerja.id, { onDelete: "cascade" }),
    atasanId: text("atasan_id").references((): AnySQLiteColumn => jabatan.id, {
      onDelete: "set null",
    }),
    ringkasanTugas: text("ringkasan_tugas"),
    aktif: integer("aktif", { mode: "boolean" }).notNull().default(true),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
    updatedAt: integer("updated_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
  },
  (t) => [
    index("idx_jabatan_unit").on(t.unitKerjaId),
    index("idx_jabatan_atasan").on(t.atasanId),
  ],
);
