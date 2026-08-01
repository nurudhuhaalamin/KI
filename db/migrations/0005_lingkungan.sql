CREATE TABLE `anggota_tim_pemeriksa` (
	`id` text PRIMARY KEY NOT NULL,
	`tim_id` text NOT NULL,
	`user_id` text NOT NULL,
	`peran` text DEFAULT 'anggota' NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`tim_id`) REFERENCES `tim_pemeriksa`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_anggota_tim` ON `anggota_tim_pemeriksa` (`tim_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `uq_anggota_tim` ON `anggota_tim_pemeriksa` (`tim_id`,`user_id`);--> statement-breakpoint
CREATE TABLE `berkas_lingkungan` (
	`id` text PRIMARY KEY NOT NULL,
	`dokumen_lingkungan_id` text NOT NULL,
	`peran` text DEFAULT 'pengajuan' NOT NULL,
	`nama_berkas` text NOT NULL,
	`kunci_r2` text NOT NULL,
	`ukuran` integer NOT NULL,
	`tipe_mime` text NOT NULL,
	`diunggah_oleh` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`dokumen_lingkungan_id`) REFERENCES `dokumen_lingkungan`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`diunggah_oleh`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `idx_berkas_lingkungan` ON `berkas_lingkungan` (`dokumen_lingkungan_id`);--> statement-breakpoint
CREATE TABLE `catatan_pemeriksaan` (
	`id` text PRIMARY KEY NOT NULL,
	`dokumen_lingkungan_id` text NOT NULL,
	`oleh_id` text,
	`tahap` text NOT NULL,
	`aspek` text NOT NULL,
	`temuan` text NOT NULL,
	`rekomendasi` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`dokumen_lingkungan_id`) REFERENCES `dokumen_lingkungan`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`oleh_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `idx_catatan_pemeriksaan` ON `catatan_pemeriksaan` (`dokumen_lingkungan_id`);--> statement-breakpoint
CREATE TABLE `dokumen_lingkungan` (
	`id` text PRIMARY KEY NOT NULL,
	`nomor` text NOT NULL,
	`urut` integer NOT NULL,
	`tahun` integer NOT NULL,
	`tenant_id` text NOT NULL,
	`kavling_id` text,
	`diajukan_oleh` text,
	`jenis` text NOT NULL,
	`judul` text NOT NULL,
	`ringkasan_kegiatan` text,
	`status` text DEFAULT 'draf' NOT NULL,
	`tanggal_diajukan` integer,
	`tenggat_administrasi` integer,
	`tenggat_substansi` integer,
	`tanggal_selesai` integer,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`tenant_id`) REFERENCES `tenant`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`kavling_id`) REFERENCES `kavling`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`diajukan_oleh`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `dokumen_lingkungan_nomor_unique` ON `dokumen_lingkungan` (`nomor`);--> statement-breakpoint
CREATE INDEX `idx_dokumen_lingkungan_tenant` ON `dokumen_lingkungan` (`tenant_id`);--> statement-breakpoint
CREATE INDEX `idx_dokumen_lingkungan_status` ON `dokumen_lingkungan` (`status`);--> statement-breakpoint
CREATE UNIQUE INDEX `uq_dokumen_lingkungan_urut` ON `dokumen_lingkungan` (`jenis`,`tahun`,`urut`);--> statement-breakpoint
CREATE TABLE `keputusan_lingkungan` (
	`id` text PRIMARY KEY NOT NULL,
	`dokumen_lingkungan_id` text NOT NULL,
	`nomor_keputusan` text NOT NULL,
	`urut` integer NOT NULL,
	`tahun` integer NOT NULL,
	`hasil` text NOT NULL,
	`diputus_oleh` text,
	`jabatan_id` text,
	`berlaku_sampai` integer,
	`pertimbangan` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`dokumen_lingkungan_id`) REFERENCES `dokumen_lingkungan`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`diputus_oleh`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`jabatan_id`) REFERENCES `jabatan`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `keputusan_lingkungan_dokumen_lingkungan_id_unique` ON `keputusan_lingkungan` (`dokumen_lingkungan_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `keputusan_lingkungan_nomor_keputusan_unique` ON `keputusan_lingkungan` (`nomor_keputusan`);--> statement-breakpoint
CREATE UNIQUE INDEX `uq_keputusan_lingkungan_urut` ON `keputusan_lingkungan` (`tahun`,`urut`);--> statement-breakpoint
CREATE TABLE `kewajiban_pemantauan` (
	`id` text PRIMARY KEY NOT NULL,
	`dokumen_lingkungan_id` text NOT NULL,
	`nama` text NOT NULL,
	`nama_en` text,
	`frekuensi` text NOT NULL,
	`mulai` integer NOT NULL,
	`aktif` integer DEFAULT true NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`dokumen_lingkungan_id`) REFERENCES `dokumen_lingkungan`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_kewajiban_dokumen` ON `kewajiban_pemantauan` (`dokumen_lingkungan_id`);--> statement-breakpoint
CREATE TABLE `laporan_pemantauan` (
	`id` text PRIMARY KEY NOT NULL,
	`kewajiban_id` text NOT NULL,
	`periode` text NOT NULL,
	`jatuh_tempo` integer NOT NULL,
	`status` text DEFAULT 'belum' NOT NULL,
	`berkas_id` text,
	`dikirim_oleh` text,
	`tanggal_kirim` integer,
	`catatan` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`kewajiban_id`) REFERENCES `kewajiban_pemantauan`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`berkas_id`) REFERENCES `berkas_lingkungan`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`dikirim_oleh`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `idx_laporan_jatuh_tempo` ON `laporan_pemantauan` (`jatuh_tempo`);--> statement-breakpoint
CREATE UNIQUE INDEX `uq_laporan_periode` ON `laporan_pemantauan` (`kewajiban_id`,`periode`);--> statement-breakpoint
CREATE TABLE `tim_pemeriksa` (
	`id` text PRIMARY KEY NOT NULL,
	`dokumen_lingkungan_id` text NOT NULL,
	`dibentuk_oleh` text,
	`catatan` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`dokumen_lingkungan_id`) REFERENCES `dokumen_lingkungan`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`dibentuk_oleh`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `tim_pemeriksa_dokumen_lingkungan_id_unique` ON `tim_pemeriksa` (`dokumen_lingkungan_id`);--> statement-breakpoint
CREATE INDEX `idx_tim_pemeriksa_dokumen` ON `tim_pemeriksa` (`dokumen_lingkungan_id`);