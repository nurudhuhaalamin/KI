import { sql } from "drizzle-orm";
import { index, integer, sqliteTable, text, unique } from "drizzle-orm/sqlite-core";

import { users } from "./auth";
import { jabatan, unitKerja } from "./organisasi";

/** Pengelompokan mengikuti delapan kategori dokumen pada proposal sumber. */
export const KATEGORI_DOKUMEN = [
  "tata-kelola",
  "sop-pelayanan",
  "sop-infrastruktur",
  "sop-keamanan",
  "k3",
  "hubungan-industrial",
  "governance",
  "pelaporan",
] as const;
export type KategoriDokumen = (typeof KATEGORI_DOKUMEN)[number];

export const STATUS_DOKUMEN = [
  "draf",
  "ditinjau",
  "disahkan",
  "kedaluwarsa",
  "ditarik",
] as const;
export type StatusDokumen = (typeof STATUS_DOKUMEN)[number];

/**
 * Daftar induk dokumen kawasan.
 *
 * `nomor` selalu dibuat sistem dan tidak pernah diketik pengguna — itulah yang
 * mencegah duplikasi dan membuat rujukan antar modul dapat dipercaya. Modul
 * berikutnya (perizinan, RKL-RPL, keuangan) menomori keluarannya lewat mekanisme
 * yang sama.
 */
export const dokumen = sqliteTable(
  "dokumen",
  {
    id: text("id").primaryKey(),
    nomor: text("nomor").notNull().unique(),
    urut: integer("urut").notNull(),
    tahun: integer("tahun").notNull(),
    judul: text("judul").notNull(),
    judulEn: text("judul_en"),
    kategori: text("kategori", { enum: KATEGORI_DOKUMEN }).notNull(),
    unitKerjaId: text("unit_kerja_id").references(() => unitKerja.id, { onDelete: "set null" }),
    status: text("status", { enum: STATUS_DOKUMEN }).notNull().default("draf"),
    versiTerkini: integer("versi_terkini").notNull().default(0),
    tanggalTerbit: integer("tanggal_terbit", { mode: "timestamp" }),
    tanggalTinjauUlang: integer("tanggal_tinjau_ulang", { mode: "timestamp" }),
    ringkasan: text("ringkasan"),
    aktif: integer("aktif", { mode: "boolean" }).notNull().default(true),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
    updatedAt: integer("updated_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
  },
  (t) => [
    // Urutan penomoran unik per kategori per tahun; ini yang membuat nomor
    // tidak bisa bertabrakan bahkan bila dua orang menyimpan bersamaan.
    unique("uq_dokumen_urut").on(t.kategori, t.tahun, t.urut),
    index("idx_dokumen_kategori").on(t.kategori),
    index("idx_dokumen_status").on(t.status),
    index("idx_dokumen_tinjau").on(t.tanggalTinjauUlang),
  ],
);

/**
 * Riwayat versi berkas dokumen.
 *
 * Versi lama tidak pernah dihapus atau ditimpa — inilah yang membedakan
 * "pengendalian dokumen" dari sekadar penyimpanan berkas.
 */
export const versiDokumen = sqliteTable(
  "versi_dokumen",
  {
    id: text("id").primaryKey(),
    dokumenId: text("dokumen_id")
      .notNull()
      .references(() => dokumen.id, { onDelete: "cascade" }),
    versi: integer("versi").notNull(),
    kunciR2: text("kunci_r2").notNull(),
    namaBerkas: text("nama_berkas").notNull(),
    ukuran: integer("ukuran").notNull(),
    tipeMime: text("tipe_mime").notNull(),
    catatanRevisi: text("catatan_revisi"),
    diunggahOleh: text("diunggah_oleh").references(() => users.id, { onDelete: "set null" }),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
  },
  (t) => [
    unique("uq_versi_dokumen").on(t.dokumenId, t.versi),
    index("idx_versi_dokumen").on(t.dokumenId),
  ],
);

/** Catatan pengesahan: siapa mengesahkan versi berapa, atas jabatan apa. */
export const pengesahanDokumen = sqliteTable(
  "pengesahan_dokumen",
  {
    id: text("id").primaryKey(),
    dokumenId: text("dokumen_id")
      .notNull()
      .references(() => dokumen.id, { onDelete: "cascade" }),
    versi: integer("versi").notNull(),
    disahkanOleh: text("disahkan_oleh").references(() => users.id, { onDelete: "set null" }),
    jabatanId: text("jabatan_id").references(() => jabatan.id, { onDelete: "set null" }),
    catatan: text("catatan"),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
  },
  (t) => [index("idx_pengesahan_dokumen").on(t.dokumenId)],
);

/** Distribusi salinan terkendali ke unit kerja. */
export const distribusiDokumen = sqliteTable(
  "distribusi_dokumen",
  {
    id: text("id").primaryKey(),
    dokumenId: text("dokumen_id")
      .notNull()
      .references(() => dokumen.id, { onDelete: "cascade" }),
    unitKerjaId: text("unit_kerja_id")
      .notNull()
      .references(() => unitKerja.id, { onDelete: "cascade" }),
    versi: integer("versi").notNull(),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
  },
  (t) => [
    unique("uq_distribusi").on(t.dokumenId, t.unitKerjaId),
    index("idx_distribusi_dokumen").on(t.dokumenId),
  ],
);
