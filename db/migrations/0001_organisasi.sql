CREATE TABLE `jabatan` (
	`id` text PRIMARY KEY NOT NULL,
	`kode` text NOT NULL,
	`nama` text NOT NULL,
	`nama_en` text,
	`unit_kerja_id` text NOT NULL,
	`atasan_id` text,
	`ringkasan_tugas` text,
	`aktif` integer DEFAULT true NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`unit_kerja_id`) REFERENCES `unit_kerja`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`atasan_id`) REFERENCES `jabatan`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `jabatan_kode_unique` ON `jabatan` (`kode`);--> statement-breakpoint
CREATE INDEX `idx_jabatan_unit` ON `jabatan` (`unit_kerja_id`);--> statement-breakpoint
CREATE INDEX `idx_jabatan_atasan` ON `jabatan` (`atasan_id`);--> statement-breakpoint
CREATE TABLE `unit_kerja` (
	`id` text PRIMARY KEY NOT NULL,
	`kode` text NOT NULL,
	`nama` text NOT NULL,
	`nama_en` text,
	`fungsi` text,
	`induk_id` text,
	`urutan` integer DEFAULT 0 NOT NULL,
	`aktif` integer DEFAULT true NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`induk_id`) REFERENCES `unit_kerja`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `unit_kerja_kode_unique` ON `unit_kerja` (`kode`);--> statement-breakpoint
CREATE INDEX `idx_unit_kerja_induk` ON `unit_kerja` (`induk_id`);--> statement-breakpoint
CREATE INDEX `idx_unit_kerja_urutan` ON `unit_kerja` (`urutan`);--> statement-breakpoint
ALTER TABLE `users` ADD `unit_kerja_id` text REFERENCES unit_kerja(id);--> statement-breakpoint
ALTER TABLE `users` ADD `jabatan_id` text REFERENCES jabatan(id);--> statement-breakpoint
CREATE INDEX `idx_users_unit` ON `users` (`unit_kerja_id`);