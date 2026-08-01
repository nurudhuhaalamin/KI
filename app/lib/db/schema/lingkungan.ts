import { sql } from "drizzle-orm";
import { index, integer, sqliteTable, text, unique } from "drizzle-orm/sqlite-core";

import { users } from "./auth";
import { kavling } from "./kavling";
import { jabatan } from "./organisasi";
import { tenant } from "./tenant";

/**
 * Jenis dokumen lingkungan yang diperiksa kawasan.
 *
 * Penamaannya mengikuti istilah yang dipakai proposal sumber. Kalau kawasan
 * pembeli memakai istilah lain, yang berubah hanyalah label di `~/lib/i18n`;
 * kodenya tetap.
 */
export const JENIS_DOKUMEN_LINGKUNGAN = [
  "rkl-rpl-rinci",
  "ukl-upl",
  "rintek-air-limbah",
  "rintek-emisi",
  "sppl",
] as const;
export type JenisDokumenLingkungan = (typeof JENIS_DOKUMEN_LINGKUNGAN)[number];

/**
 * Tahapan pemeriksaan.
 *
 * `perlu-dilengkapi` dan `perlu-diperbaiki` berarti bola ada di tangan tenant —
 * dan selama itu jam tenggat kawasan berhenti.
 */
export const STATUS_LINGKUNGAN = [
  "draf",
  "diajukan",
  "pemeriksaan-administrasi",
  "perlu-dilengkapi",
  "pemeriksaan-substansi",
  "perlu-diperbaiki",
  "disetujui",
  "ditolak",
  "batal",
] as const;
export type StatusLingkungan = (typeof STATUS_LINGKUNGAN)[number];

/**
 * Dokumen lingkungan yang diajukan tenant.
 *
 * Kawasan yang memegang RKL-RPL Rinci berwenang memeriksanya sendiri alih-alih
 * menyerahkannya ke pemerintah daerah satu per satu. Kewenangan itu hanya bisa
 * dipertanggungjawabkan bila prosesnya berjejak: siapa memeriksa, apa temuannya,
 * kapan tenggatnya, dan atas dasar apa persetujuan diterbitkan.
 *
 * Dua tenggat disimpan terpisah karena memang dua jam yang berbeda: kelengkapan
 * administrasi, lalu substansi yang baru mulai setelah berkas dinyatakan lengkap.
 */
export const dokumenLingkungan = sqliteTable(
  "dokumen_lingkungan",
  {
    id: text("id").primaryKey(),
    nomor: text("nomor").notNull().unique(),
    urut: integer("urut").notNull(),
    tahun: integer("tahun").notNull(),
    tenantId: text("tenant_id")
      .notNull()
      .references(() => tenant.id, { onDelete: "restrict" }),
    kavlingId: text("kavling_id").references(() => kavling.id, { onDelete: "set null" }),
    diajukanOleh: text("diajukan_oleh").references(() => users.id, { onDelete: "set null" }),
    jenis: text("jenis", { enum: JENIS_DOKUMEN_LINGKUNGAN }).notNull(),
    judul: text("judul").notNull(),
    ringkasanKegiatan: text("ringkasan_kegiatan"),
    status: text("status", { enum: STATUS_LINGKUNGAN }).notNull().default("draf"),
    tanggalDiajukan: integer("tanggal_diajukan", { mode: "timestamp" }),
    tenggatAdministrasi: integer("tenggat_administrasi", { mode: "timestamp" }),
    /** Baru terisi saat berkas dinyatakan lengkap, bukan saat pengajuan pertama. */
    tenggatSubstansi: integer("tenggat_substansi", { mode: "timestamp" }),
    tanggalSelesai: integer("tanggal_selesai", { mode: "timestamp" }),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
    updatedAt: integer("updated_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
  },
  (t) => [
    unique("uq_dokumen_lingkungan_urut").on(t.jenis, t.tahun, t.urut),
    index("idx_dokumen_lingkungan_tenant").on(t.tenantId),
    index("idx_dokumen_lingkungan_status").on(t.status),
  ],
);

/** Membedakan berkas pengajuan, berkas perbaikan, dan surat keputusan. */
export const PERAN_BERKAS_LINGKUNGAN = ["pengajuan", "perbaikan", "surat-keputusan"] as const;
export type PeranBerkasLingkungan = (typeof PERAN_BERKAS_LINGKUNGAN)[number];

export const berkasLingkungan = sqliteTable(
  "berkas_lingkungan",
  {
    id: text("id").primaryKey(),
    dokumenLingkunganId: text("dokumen_lingkungan_id")
      .notNull()
      .references(() => dokumenLingkungan.id, { onDelete: "cascade" }),
    peran: text("peran", { enum: PERAN_BERKAS_LINGKUNGAN }).notNull().default("pengajuan"),
    namaBerkas: text("nama_berkas").notNull(),
    kunciR2: text("kunci_r2").notNull(),
    ukuran: integer("ukuran").notNull(),
    tipeMime: text("tipe_mime").notNull(),
    diunggahOleh: text("diunggah_oleh").references(() => users.id, { onDelete: "set null" }),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
  },
  (t) => [index("idx_berkas_lingkungan").on(t.dokumenLingkunganId)],
);

export const PERAN_ANGGOTA = ["ketua", "sekretaris", "anggota", "ahli"] as const;
export type PeranAnggota = (typeof PERAN_ANGGOTA)[number];

/**
 * Tim pemeriksa dibentuk per dokumen.
 *
 * Sengaja bukan tim tetap: susunannya berubah menurut jenis kegiatan yang
 * diperiksa, dan berita acara pemeriksaan menyebut nama-nama yang memeriksa
 * dokumen itu, bukan daftar pegawai yang berlaku umum.
 */
export const timPemeriksa = sqliteTable(
  "tim_pemeriksa",
  {
    id: text("id").primaryKey(),
    dokumenLingkunganId: text("dokumen_lingkungan_id")
      .notNull()
      .references(() => dokumenLingkungan.id, { onDelete: "cascade" })
      .unique(),
    dibentukOleh: text("dibentuk_oleh").references(() => users.id, { onDelete: "set null" }),
    catatan: text("catatan"),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
  },
  (t) => [index("idx_tim_pemeriksa_dokumen").on(t.dokumenLingkunganId)],
);

export const anggotaTimPemeriksa = sqliteTable(
  "anggota_tim_pemeriksa",
  {
    id: text("id").primaryKey(),
    timId: text("tim_id")
      .notNull()
      .references(() => timPemeriksa.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    peran: text("peran", { enum: PERAN_ANGGOTA }).notNull().default("anggota"),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
  },
  (t) => [
    // Satu orang satu kursi dalam satu tim.
    unique("uq_anggota_tim").on(t.timId, t.userId),
    index("idx_anggota_tim").on(t.timId),
  ],
);

export const TAHAP_PEMERIKSAAN = ["administrasi", "substansi"] as const;
export type TahapPemeriksaan = (typeof TAHAP_PEMERIKSAAN)[number];

/**
 * Temuan tiap pemeriksa. Tidak pernah ditimpa — temuan yang sudah dicatat adalah
 * dasar keputusan, dan menghapusnya berarti menghapus alasannya.
 */
export const catatanPemeriksaan = sqliteTable(
  "catatan_pemeriksaan",
  {
    id: text("id").primaryKey(),
    dokumenLingkunganId: text("dokumen_lingkungan_id")
      .notNull()
      .references(() => dokumenLingkungan.id, { onDelete: "cascade" }),
    olehId: text("oleh_id").references(() => users.id, { onDelete: "set null" }),
    tahap: text("tahap", { enum: TAHAP_PEMERIKSAAN }).notNull(),
    aspek: text("aspek").notNull(),
    temuan: text("temuan").notNull(),
    rekomendasi: text("rekomendasi"),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
  },
  (t) => [index("idx_catatan_pemeriksaan").on(t.dokumenLingkunganId)],
);

export const HASIL_KEPUTUSAN = ["disetujui", "ditolak"] as const;
export type HasilKeputusanLingkungan = (typeof HASIL_KEPUTUSAN)[number];

/**
 * Keputusan akhir beserta nomor suratnya.
 *
 * Nomor dibuat sistem lewat `~/lib/penomoran`, sama seperti nomor dokumen dan
 * nomor permohonan izin. Surat yang sudah ditandatangani diunggah sebagai berkas
 * berperan `surat-keputusan`; sistem mencatat dasarnya, bukan memalsukan tanda
 * tangannya.
 */
export const keputusanLingkungan = sqliteTable(
  "keputusan_lingkungan",
  {
    id: text("id").primaryKey(),
    dokumenLingkunganId: text("dokumen_lingkungan_id")
      .notNull()
      .references(() => dokumenLingkungan.id, { onDelete: "cascade" })
      .unique(),
    nomorKeputusan: text("nomor_keputusan").notNull().unique(),
    urut: integer("urut").notNull(),
    tahun: integer("tahun").notNull(),
    hasil: text("hasil", { enum: HASIL_KEPUTUSAN }).notNull(),
    diputusOleh: text("diputus_oleh").references(() => users.id, { onDelete: "set null" }),
    jabatanId: text("jabatan_id").references(() => jabatan.id, { onDelete: "set null" }),
    berlakuSampai: integer("berlaku_sampai", { mode: "timestamp" }),
    pertimbangan: text("pertimbangan"),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
  },
  (t) => [unique("uq_keputusan_lingkungan_urut").on(t.tahun, t.urut)],
);

export const FREKUENSI_PEMANTAUAN = ["bulanan", "triwulanan", "semesteran", "tahunan"] as const;
export type FrekuensiPemantauan = (typeof FREKUENSI_PEMANTAUAN)[number];

/**
 * Kewajiban pemantauan yang melekat setelah persetujuan terbit.
 *
 * Inilah yang membuat persetujuan tidak berhenti sebagai arsip: tenant wajib
 * melapor berkala, dan kawasan yang menagihnya.
 */
export const kewajibanPemantauan = sqliteTable(
  "kewajiban_pemantauan",
  {
    id: text("id").primaryKey(),
    dokumenLingkunganId: text("dokumen_lingkungan_id")
      .notNull()
      .references(() => dokumenLingkungan.id, { onDelete: "cascade" }),
    nama: text("nama").notNull(),
    namaEn: text("nama_en"),
    frekuensi: text("frekuensi", { enum: FREKUENSI_PEMANTAUAN }).notNull(),
    mulai: integer("mulai", { mode: "timestamp" }).notNull(),
    aktif: integer("aktif", { mode: "boolean" }).notNull().default(true),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
  },
  (t) => [index("idx_kewajiban_dokumen").on(t.dokumenLingkunganId)],
);

export const STATUS_LAPORAN = ["belum", "terkirim", "diterima", "ditolak"] as const;
export type StatusLaporan = (typeof STATUS_LAPORAN)[number];

/**
 * Satu baris per periode pelaporan.
 *
 * Keterlambatan tidak disimpan sebagai kolom melainkan dihitung dari `jatuhTempo`
 * — status yang disimpan akan basi begitu tanggalnya lewat tanpa ada yang
 * memperbaruinya.
 */
export const laporanPemantauan = sqliteTable(
  "laporan_pemantauan",
  {
    id: text("id").primaryKey(),
    kewajibanId: text("kewajiban_id")
      .notNull()
      .references(() => kewajibanPemantauan.id, { onDelete: "cascade" }),
    periode: text("periode").notNull(),
    jatuhTempo: integer("jatuh_tempo", { mode: "timestamp" }).notNull(),
    status: text("status", { enum: STATUS_LAPORAN }).notNull().default("belum"),
    berkasId: text("berkas_id").references(() => berkasLingkungan.id, {
      onDelete: "set null",
    }),
    dikirimOleh: text("dikirim_oleh").references(() => users.id, { onDelete: "set null" }),
    tanggalKirim: integer("tanggal_kirim", { mode: "timestamp" }),
    catatan: text("catatan"),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
  },
  (t) => [
    unique("uq_laporan_periode").on(t.kewajibanId, t.periode),
    index("idx_laporan_jatuh_tempo").on(t.jatuhTempo),
  ],
);
