import { sql } from "drizzle-orm";
import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

import { users } from "./auth";

/**
 * Konfigurasi kawasan. Inilah yang membedakan satu instans dengan instans
 * lain (nama kawasan, logo, warna, alamat, dsb.) — pembeda ada di data,
 * bukan di kode, sehingga satu repo master melayani semua kawasan pembeli.
 */
export const pengaturan = sqliteTable("pengaturan", {
  kunci: text("kunci").primaryKey(),
  nilai: text("nilai").notNull(),
  keterangan: text("keterangan"),
  updatedAt: integer("updated_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
});

/**
 * Jejak audit: siapa mengubah apa, kapan. Wajib ada untuk sistem tata kelola —
 * dipakai saat audit internal dan penelusuran sengketa.
 *
 * Catatan keamanan: kolom `ringkasan` tidak boleh memuat data pribadi tenant
 * (NIK, NPWP, nomor kontak, nilai kontrak). Simpan identitas baris lewat
 * `entitas` + `entitasId` saja.
 */
export const jejakAudit = sqliteTable(
  "jejak_audit",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    userId: text("user_id").references(() => users.id, { onDelete: "set null" }),
    aksi: text("aksi", { enum: ["buat", "ubah", "hapus", "masuk", "keluar"] }).notNull(),
    entitas: text("entitas").notNull(),
    entitasId: text("entitas_id"),
    ringkasan: text("ringkasan"),
    ipAddress: text("ip_address"),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
  },
  (t) => [
    index("idx_jejak_audit_entitas").on(t.entitas, t.entitasId),
    index("idx_jejak_audit_waktu").on(t.createdAt),
  ],
);
