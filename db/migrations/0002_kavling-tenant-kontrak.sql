CREATE TABLE `kavling` (
	`id` text PRIMARY KEY NOT NULL,
	`kode` text NOT NULL,
	`blok` text NOT NULL,
	`nomor` text NOT NULL,
	`luas_m2` integer NOT NULL,
	`peruntukan` text DEFAULT 'industri' NOT NULL,
	`status` text DEFAULT 'tersedia' NOT NULL,
	`harga_dasar` integer,
	`keterangan` text,
	`aktif` integer DEFAULT true NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `kavling_kode_unique` ON `kavling` (`kode`);--> statement-breakpoint
CREATE INDEX `idx_kavling_blok` ON `kavling` (`blok`);--> statement-breakpoint
CREATE INDEX `idx_kavling_status` ON `kavling` (`status`);--> statement-breakpoint
CREATE TABLE `kontrak` (
	`id` text PRIMARY KEY NOT NULL,
	`nomor` text NOT NULL,
	`jenis` text NOT NULL,
	`tenant_id` text NOT NULL,
	`kavling_id` text NOT NULL,
	`tanggal_mulai` integer NOT NULL,
	`tanggal_berakhir` integer,
	`nilai` integer DEFAULT 0 NOT NULL,
	`status` text DEFAULT 'draf' NOT NULL,
	`keterangan` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`tenant_id`) REFERENCES `tenant`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`kavling_id`) REFERENCES `kavling`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE UNIQUE INDEX `kontrak_nomor_unique` ON `kontrak` (`nomor`);--> statement-breakpoint
CREATE INDEX `idx_kontrak_tenant` ON `kontrak` (`tenant_id`);--> statement-breakpoint
CREATE INDEX `idx_kontrak_kavling` ON `kontrak` (`kavling_id`);--> statement-breakpoint
CREATE INDEX `idx_kontrak_status` ON `kontrak` (`status`);--> statement-breakpoint
CREATE TABLE `kontrak_fasilitas` (
	`id` text PRIMARY KEY NOT NULL,
	`kontrak_id` text NOT NULL,
	`jenis` text NOT NULL,
	`kuota_bulanan` integer,
	`satuan` text,
	`keterangan` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`kontrak_id`) REFERENCES `kontrak`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_kontrak_fasilitas_kontrak` ON `kontrak_fasilitas` (`kontrak_id`);--> statement-breakpoint
CREATE TABLE `lampiran_kontrak` (
	`id` text PRIMARY KEY NOT NULL,
	`kontrak_id` text NOT NULL,
	`nama_berkas` text NOT NULL,
	`kunci_r2` text NOT NULL,
	`ukuran` integer NOT NULL,
	`tipe_mime` text NOT NULL,
	`diunggah_oleh` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`kontrak_id`) REFERENCES `kontrak`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`diunggah_oleh`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `idx_lampiran_kontrak` ON `lampiran_kontrak` (`kontrak_id`);--> statement-breakpoint
CREATE TABLE `tenant` (
	`id` text PRIMARY KEY NOT NULL,
	`kode` text NOT NULL,
	`nama_perusahaan` text NOT NULL,
	`bentuk_badan_usaha` text,
	`bidang_usaha` text,
	`alamat` text,
	`npwp` text,
	`nib` text,
	`kontak_nama` text,
	`kontak_jabatan` text,
	`kontak_surel` text,
	`kontak_telepon` text,
	`status` text DEFAULT 'calon' NOT NULL,
	`aktif` integer DEFAULT true NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `tenant_kode_unique` ON `tenant` (`kode`);--> statement-breakpoint
CREATE INDEX `idx_tenant_status` ON `tenant` (`status`);--> statement-breakpoint
CREATE INDEX `idx_tenant_nama` ON `tenant` (`nama_perusahaan`);--> statement-breakpoint
ALTER TABLE `users` ADD `tenant_id` text REFERENCES tenant(id);