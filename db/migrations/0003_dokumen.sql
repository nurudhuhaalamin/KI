CREATE TABLE `distribusi_dokumen` (
	`id` text PRIMARY KEY NOT NULL,
	`dokumen_id` text NOT NULL,
	`unit_kerja_id` text NOT NULL,
	`versi` integer NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`dokumen_id`) REFERENCES `dokumen`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`unit_kerja_id`) REFERENCES `unit_kerja`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_distribusi_dokumen` ON `distribusi_dokumen` (`dokumen_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `uq_distribusi` ON `distribusi_dokumen` (`dokumen_id`,`unit_kerja_id`);--> statement-breakpoint
CREATE TABLE `dokumen` (
	`id` text PRIMARY KEY NOT NULL,
	`nomor` text NOT NULL,
	`urut` integer NOT NULL,
	`tahun` integer NOT NULL,
	`judul` text NOT NULL,
	`judul_en` text,
	`kategori` text NOT NULL,
	`unit_kerja_id` text,
	`status` text DEFAULT 'draf' NOT NULL,
	`versi_terkini` integer DEFAULT 0 NOT NULL,
	`tanggal_terbit` integer,
	`tanggal_tinjau_ulang` integer,
	`ringkasan` text,
	`aktif` integer DEFAULT true NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`unit_kerja_id`) REFERENCES `unit_kerja`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `dokumen_nomor_unique` ON `dokumen` (`nomor`);--> statement-breakpoint
CREATE INDEX `idx_dokumen_kategori` ON `dokumen` (`kategori`);--> statement-breakpoint
CREATE INDEX `idx_dokumen_status` ON `dokumen` (`status`);--> statement-breakpoint
CREATE INDEX `idx_dokumen_tinjau` ON `dokumen` (`tanggal_tinjau_ulang`);--> statement-breakpoint
CREATE UNIQUE INDEX `uq_dokumen_urut` ON `dokumen` (`kategori`,`tahun`,`urut`);--> statement-breakpoint
CREATE TABLE `pengesahan_dokumen` (
	`id` text PRIMARY KEY NOT NULL,
	`dokumen_id` text NOT NULL,
	`versi` integer NOT NULL,
	`disahkan_oleh` text,
	`jabatan_id` text,
	`catatan` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`dokumen_id`) REFERENCES `dokumen`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`disahkan_oleh`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`jabatan_id`) REFERENCES `jabatan`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `idx_pengesahan_dokumen` ON `pengesahan_dokumen` (`dokumen_id`);--> statement-breakpoint
CREATE TABLE `versi_dokumen` (
	`id` text PRIMARY KEY NOT NULL,
	`dokumen_id` text NOT NULL,
	`versi` integer NOT NULL,
	`kunci_r2` text NOT NULL,
	`nama_berkas` text NOT NULL,
	`ukuran` integer NOT NULL,
	`tipe_mime` text NOT NULL,
	`catatan_revisi` text,
	`diunggah_oleh` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`dokumen_id`) REFERENCES `dokumen`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`diunggah_oleh`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `idx_versi_dokumen` ON `versi_dokumen` (`dokumen_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `uq_versi_dokumen` ON `versi_dokumen` (`dokumen_id`,`versi`);