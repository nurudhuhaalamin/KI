import { sql } from "drizzle-orm";
import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

/** Peruntukan lahan menurut rencana induk kawasan. */
export const PERUNTUKAN = ["industri", "komersial", "fasilitas", "rth"] as const;
export type Peruntukan = (typeof PERUNTUKAN)[number];

/**
 * Status kavling. TIDAK disunting langsung oleh pengguna — nilainya diturunkan
 * dari kontrak yang sedang aktif lewat hitungStatusKavling(). Menyimpannya di
 * tabel hanya sebagai hasil perhitungan agar daftar kavling tidak perlu
 * menghitung ulang untuk setiap baris.
 */
export const STATUS_KAVLING = ["tersedia", "dipesan", "disewa", "terjual"] as const;
export type StatusKavling = (typeof STATUS_KAVLING)[number];

export const kavling = sqliteTable(
  "kavling",
  {
    id: text("id").primaryKey(),
    kode: text("kode").notNull().unique(),
    blok: text("blok").notNull(),
    nomor: text("nomor").notNull(),
    luasM2: integer("luas_m2").notNull(),
    peruntukan: text("peruntukan", { enum: PERUNTUKAN }).notNull().default("industri"),
    status: text("status", { enum: STATUS_KAVLING }).notNull().default("tersedia"),
    // Rupiah penuh sebagai bilangan bulat. Tidak memakai pecahan agar tidak
    // ada galat pembulatan pada nilai kontrak yang besar.
    hargaDasar: integer("harga_dasar"),
    keterangan: text("keterangan"),
    aktif: integer("aktif", { mode: "boolean" }).notNull().default(true),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
    updatedAt: integer("updated_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
  },
  (t) => [index("idx_kavling_blok").on(t.blok), index("idx_kavling_status").on(t.status)],
);
