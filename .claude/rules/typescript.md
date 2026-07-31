---
paths:
  - "app/**/*.{ts,tsx}"
  - "workers/**/*.ts"
  - "scripts/**/*.ts"
---

# Pola kode wajib

## Akses lingkungan & database

- `env` selalu diambil dari `context.get(cloudflareContext)` di dalam loader atau
  action. **Jangan** memakai `process.env` — binding Worker tidak ada di sana.
- Koneksi database dibuat per permintaan lewat `buatDb(env)` dari `~/lib/db`.
  Dilarang membuat koneksi sebagai variabel modul global.
- Query memakai Drizzle (`db.select()`, `db.insert()`, …), bukan rangkaian string SQL.

## Hak akses

- Setiap loader/action halaman internal **wajib** memanggil
  `wajibMasuk(env, request, [peran])` dari `~/lib/auth/sesi` sebagai baris pertama.
- Menyembunyikan tombol di tampilan bukan pengamanan. Pemeriksaan yang berlaku
  hanyalah yang berjalan di server.
- Untuk halaman yang boleh diakses tamu tapi berubah bila sudah masuk, pakai
  `ambilSesi(env, request)` yang mengembalikan `null` alih-alih melempar redirect.

## Validasi

- Masukan dari `request.formData()` atau body JSON divalidasi dengan Zod sebelum
  menyentuh database. Skema ditaruh di berkas yang sama dengan action-nya.
- Pengalihan yang tujuannya berasal dari pengguna harus melewati `tujuanAman()`
  dari `~/lib/navigasi`.

## Teks & bahasa

- Seluruh teks yang dilihat pengguna diambil dari `~/lib/i18n`. **Dilarang**
  menulis teks langsung di JSX — terjemahan Inggris akan tertinggal diam-diam.
- Kunci baru ditambahkan lebih dulu di `id.ts`, lalu `en.ts` menyesuaikan.
  Terjemahan yang hilang membuat `npm run typecheck` gagal, dan itu memang disengaja.

## Penamaan

- Nama variabel, fungsi, tipe, tabel, kolom, dan rute: **Bahasa Inggris** untuk
  istilah teknis umum (`users`, `sessions`, `createdAt`), **Bahasa Indonesia**
  untuk istilah domain kawasan (`kavling`, `tenant`, `perizinan`, `jejakAudit`).
- Komentar dan pesan commit: Bahasa Indonesia.

## Tipe

- Dilarang `any`. Pakai `unknown` lalu persempit dengan pemeriksaan tipe.
- Dilarang `@ts-ignore` dan `eslint-disable` untuk menutupi galat. Perbaiki akarnya.
- `noUncheckedIndexedAccess` aktif: hasil `array[i]` bisa `undefined` dan harus
  diperiksa sebelum dipakai.

## Test

- Logika murni (perhitungan, validasi, format) diuji dengan Vitest di berkas
  `*.test.ts` bersebelahan dengan berkas aslinya.
- Alur yang menyentuh database, sesi, atau tampilan diuji lewat Playwright di
  `e2e/`, memakai `data-testid` sebagai penanda elemen — bukan teks tampilan,
  karena teksnya berubah mengikuti bahasa.
