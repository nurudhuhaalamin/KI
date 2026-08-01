CREATE TABLE `berkas_permohonan` (
	`id` text PRIMARY KEY NOT NULL,
	`permohonan_id` text NOT NULL,
	`nama_berkas` text NOT NULL,
	`kunci_r2` text NOT NULL,
	`ukuran` integer NOT NULL,
	`tipe_mime` text NOT NULL,
	`diunggah_oleh` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`permohonan_id`) REFERENCES `permohonan`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`diunggah_oleh`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `idx_berkas_permohonan` ON `berkas_permohonan` (`permohonan_id`);--> statement-breakpoint
CREATE TABLE `jenis_izin` (
	`id` text PRIMARY KEY NOT NULL,
	`kode` text NOT NULL,
	`nama` text NOT NULL,
	`nama_en` text,
	`keterangan` text,
	`unit_kerja_id` text,
	`sla_hari` integer DEFAULT 5 NOT NULL,
	`definisi_kolom` text DEFAULT '[]' NOT NULL,
	`urutan` integer DEFAULT 0 NOT NULL,
	`aktif` integer DEFAULT true NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`unit_kerja_id`) REFERENCES `unit_kerja`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `jenis_izin_kode_unique` ON `jenis_izin` (`kode`);--> statement-breakpoint
CREATE INDEX `idx_jenis_izin_aktif` ON `jenis_izin` (`aktif`);--> statement-breakpoint
CREATE TABLE `keputusan_permohonan` (
	`id` text PRIMARY KEY NOT NULL,
	`permohonan_id` text NOT NULL,
	`tahap_id` text,
	`urutan_tahap` integer NOT NULL,
	`keputusan` text NOT NULL,
	`oleh` text,
	`catatan` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`permohonan_id`) REFERENCES `permohonan`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`tahap_id`) REFERENCES `tahap_persetujuan`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`oleh`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `idx_keputusan_permohonan` ON `keputusan_permohonan` (`permohonan_id`);--> statement-breakpoint
CREATE TABLE `notifikasi` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`judul` text NOT NULL,
	`pesan` text NOT NULL,
	`tautan` text,
	`dibaca` integer DEFAULT false NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_notifikasi_pengguna` ON `notifikasi` (`user_id`,`dibaca`);--> statement-breakpoint
CREATE TABLE `permohonan` (
	`id` text PRIMARY KEY NOT NULL,
	`nomor` text NOT NULL,
	`urut` integer NOT NULL,
	`tahun` integer NOT NULL,
	`jenis_izin_id` text NOT NULL,
	`tenant_id` text NOT NULL,
	`diajukan_oleh` text,
	`judul` text NOT NULL,
	`isian` text DEFAULT '{}' NOT NULL,
	`status` text DEFAULT 'draf' NOT NULL,
	`tahap_aktif` integer DEFAULT 0 NOT NULL,
	`tanggal_diajukan` integer,
	`tenggat` integer,
	`tanggal_selesai` integer,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`jenis_izin_id`) REFERENCES `jenis_izin`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`tenant_id`) REFERENCES `tenant`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`diajukan_oleh`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `permohonan_nomor_unique` ON `permohonan` (`nomor`);--> statement-breakpoint
CREATE INDEX `idx_permohonan_tenant` ON `permohonan` (`tenant_id`);--> statement-breakpoint
CREATE INDEX `idx_permohonan_status` ON `permohonan` (`status`);--> statement-breakpoint
CREATE INDEX `idx_permohonan_tenggat` ON `permohonan` (`tenggat`);--> statement-breakpoint
CREATE UNIQUE INDEX `uq_permohonan_urut` ON `permohonan` (`jenis_izin_id`,`tahun`,`urut`);--> statement-breakpoint
CREATE TABLE `tahap_persetujuan` (
	`id` text PRIMARY KEY NOT NULL,
	`jenis_izin_id` text NOT NULL,
	`urutan` integer NOT NULL,
	`nama` text NOT NULL,
	`nama_en` text,
	`peran_pemutus` text DEFAULT 'staf' NOT NULL,
	`unit_kerja_id` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`jenis_izin_id`) REFERENCES `jenis_izin`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`unit_kerja_id`) REFERENCES `unit_kerja`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `idx_tahap_jenis` ON `tahap_persetujuan` (`jenis_izin_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `uq_tahap_urutan` ON `tahap_persetujuan` (`jenis_izin_id`,`urutan`);