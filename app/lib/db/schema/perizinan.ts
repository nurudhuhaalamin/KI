import { sql } from "drizzle-orm";
import { index, integer, sqliteTable, text, unique } from "drizzle-orm/sqlite-core";

import { users } from "./auth";
import { unitKerja } from "./organisasi";
import { tenant } from "./tenant";

/**
 * Jenis izin ditentukan tiap kawasan sendiri, jadi ini DATA, bukan kode.
 *
 * Kawasan yang satu mewajibkan izin kerja panas, yang lain tidak; yang satu
 * memproses izin bangun dalam 5 hari kerja, yang lain 14. Kalau daftarnya
 * ditulis di kode, tiap pembeli baru berarti mengubah kode — dan sistem ini
 * dijual berulang ke kawasan yang berbeda-beda.
 *
 * `definisiKolom` berisi JSON daftar kolom formulir. Halaman pengajuan merender
 * apa pun yang ada di sana, dan server memvalidasi dari definisi yang sama —
 * satu sumber kebenaran, bukan dua daftar yang cepat berbeda.
 */
export const jenisIzin = sqliteTable(
  "jenis_izin",
  {
    id: text("id").primaryKey(),
    kode: text("kode").notNull().unique(),
    nama: text("nama").notNull(),
    namaEn: text("nama_en"),
    keterangan: text("keterangan"),
    unitKerjaId: text("unit_kerja_id").references(() => unitKerja.id, { onDelete: "set null" }),
    /** Janji layanan dalam HARI KERJA, bukan hari kalender. */
    slaHari: integer("sla_hari").notNull().default(5),
    definisiKolom: text("definisi_kolom").notNull().default("[]"),
    urutan: integer("urutan").notNull().default(0),
    aktif: integer("aktif", { mode: "boolean" }).notNull().default(true),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
    updatedAt: integer("updated_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
  },
  (t) => [index("idx_jenis_izin_aktif").on(t.aktif)],
);

/** Peran yang boleh memutus satu tahap. */
export const PERAN_PEMUTUS = ["staf", "manajemen", "admin"] as const;
export type PeranPemutus = (typeof PERAN_PEMUTUS)[number];

/**
 * Tahap persetujuan per jenis izin.
 *
 * Izin kerja harian cukup satu tahap staf; izin bangun bisa tiga tahap sampai
 * manajemen. Karena itu jumlah dan urutannya ikut menjadi data.
 */
export const tahapPersetujuan = sqliteTable(
  "tahap_persetujuan",
  {
    id: text("id").primaryKey(),
    jenisIzinId: text("jenis_izin_id")
      .notNull()
      .references(() => jenisIzin.id, { onDelete: "cascade" }),
    urutan: integer("urutan").notNull(),
    nama: text("nama").notNull(),
    namaEn: text("nama_en"),
    peranPemutus: text("peran_pemutus", { enum: PERAN_PEMUTUS }).notNull().default("staf"),
    unitKerjaId: text("unit_kerja_id").references(() => unitKerja.id, { onDelete: "set null" }),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
  },
  (t) => [
    unique("uq_tahap_urutan").on(t.jenisIzinId, t.urutan),
    index("idx_tahap_jenis").on(t.jenisIzinId),
  ],
);

export const STATUS_PERMOHONAN = [
  "draf",
  "diajukan",
  "diproses",
  "perlu-revisi",
  "terbit",
  "ditolak",
  "batal",
] as const;
export type StatusPermohonan = (typeof STATUS_PERMOHONAN)[number];

/**
 * Permohonan izin dari tenant.
 *
 * `isian` menyimpan jawaban formulir sebagai JSON karena kolomnya berbeda tiap
 * jenis izin. Yang dipakai untuk menyaring, mengurutkan, dan menagih tenggat
 * tetap kolom sungguhan — JSON hanya untuk isi jawaban.
 */
export const permohonan = sqliteTable(
  "permohonan",
  {
    id: text("id").primaryKey(),
    nomor: text("nomor").notNull().unique(),
    urut: integer("urut").notNull(),
    tahun: integer("tahun").notNull(),
    jenisIzinId: text("jenis_izin_id")
      .notNull()
      .references(() => jenisIzin.id, { onDelete: "restrict" }),
    tenantId: text("tenant_id")
      .notNull()
      .references(() => tenant.id, { onDelete: "restrict" }),
    diajukanOleh: text("diajukan_oleh").references(() => users.id, { onDelete: "set null" }),
    judul: text("judul").notNull(),
    isian: text("isian").notNull().default("{}"),
    status: text("status", { enum: STATUS_PERMOHONAN }).notNull().default("draf"),
    /** Urutan tahap yang sedang menunggu keputusan; 0 berarti belum diajukan. */
    tahapAktif: integer("tahap_aktif").notNull().default(0),
    tanggalDiajukan: integer("tanggal_diajukan", { mode: "timestamp" }),
    tenggat: integer("tenggat", { mode: "timestamp" }),
    tanggalSelesai: integer("tanggal_selesai", { mode: "timestamp" }),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
    updatedAt: integer("updated_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
  },
  (t) => [
    unique("uq_permohonan_urut").on(t.jenisIzinId, t.tahun, t.urut),
    index("idx_permohonan_tenant").on(t.tenantId),
    index("idx_permohonan_status").on(t.status),
    index("idx_permohonan_tenggat").on(t.tenggat),
  ],
);

export const KEPUTUSAN = ["setuju", "tolak", "revisi"] as const;
export type Keputusan = (typeof KEPUTUSAN)[number];

/**
 * Keputusan tiap tahap.
 *
 * Tidak pernah ditimpa: permohonan yang sempat ditolak lalu disetujui setelah
 * diperbaiki harus tetap terlihat riwayatnya saat audit menanyakan dasar
 * penerbitan izin.
 */
export const keputusanPermohonan = sqliteTable(
  "keputusan_permohonan",
  {
    id: text("id").primaryKey(),
    permohonanId: text("permohonan_id")
      .notNull()
      .references(() => permohonan.id, { onDelete: "cascade" }),
    tahapId: text("tahap_id").references(() => tahapPersetujuan.id, { onDelete: "set null" }),
    urutanTahap: integer("urutan_tahap").notNull(),
    keputusan: text("keputusan", { enum: KEPUTUSAN }).notNull(),
    oleh: text("oleh").references(() => users.id, { onDelete: "set null" }),
    catatan: text("catatan"),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
  },
  (t) => [index("idx_keputusan_permohonan").on(t.permohonanId)],
);

/** Lampiran permohonan; terikat tenant lewat permohonan induknya. */
export const berkasPermohonan = sqliteTable(
  "berkas_permohonan",
  {
    id: text("id").primaryKey(),
    permohonanId: text("permohonan_id")
      .notNull()
      .references(() => permohonan.id, { onDelete: "cascade" }),
    namaBerkas: text("nama_berkas").notNull(),
    kunciR2: text("kunci_r2").notNull(),
    ukuran: integer("ukuran").notNull(),
    tipeMime: text("tipe_mime").notNull(),
    diunggahOleh: text("diunggah_oleh").references(() => users.id, { onDelete: "set null" }),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
  },
  (t) => [index("idx_berkas_permohonan").on(t.permohonanId)],
);

/**
 * Notifikasi di dalam aplikasi.
 *
 * Pengiriman surel belum dipasang; seluruh pembuatan notifikasi lewat satu
 * fungsi supaya nanti cukup ditambahkan di satu tempat.
 */
export const notifikasi = sqliteTable(
  "notifikasi",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    judul: text("judul").notNull(),
    pesan: text("pesan").notNull(),
    tautan: text("tautan"),
    dibaca: integer("dibaca", { mode: "boolean" }).notNull().default(false),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
  },
  (t) => [index("idx_notifikasi_pengguna").on(t.userId, t.dibaca)],
);
