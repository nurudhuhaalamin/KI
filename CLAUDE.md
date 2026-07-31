# KI — System Kawasan Industri

Sistem pengelolaan kawasan industri. Pedoman lengkap pemakaian Claude Code ada di
`docs/panduan-claude-code.md` (dokumen untuk dibaca manusia, tidak dimuat otomatis).

## Bahasa

- Percakapan, komentar kode, pesan commit, dan dokumentasi: **Bahasa Indonesia**.
- Nama variabel, fungsi, kelas, tabel, dan endpoint: **Bahasa Inggris**.

## Stack

TypeScript + React Router v8 (framework mode) di Cloudflare Workers.
Database Cloudflare D1 lewat Drizzle ORM; berkas di R2; autentikasi Better Auth;
tampilan Tailwind CSS. Satu kawasan = satu instans (Worker + D1 + R2 sendiri).
Rinciannya di `docs/arsitektur.md`.

## Perintah penting

```
Dev        : npm run dev
Periksa    : npm run check      # typecheck + lint + test + build
Test unit  : npm run test
Test E2E   : npm run test:e2e   # Playwright, menjalankan aplikasi sungguhan
Migrasi    : npm run db:migrate:local
Data demo  : npm run db:seed
```

Sebelum menyatakan pekerjaan selesai, jalankan `npm run check` dan tunjukkan
hasilnya. Untuk perubahan yang menyentuh tampilan atau alur pengguna, jalankan
juga `npm run test:e2e`.

## Alur kerja

- Gunakan **plan mode** bila perubahan menyentuh banyak file, pendekatannya belum jelas,
  atau kode yang disentuh belum dikenal. Untuk perubahan sepele, kerjakan langsung.
- Setiap perubahan harus disertai cara memverifikasinya. Tunjukkan bukti (output test,
  exit code, screenshot) — jangan hanya menyatakan "sudah selesai".
- Fitur besar: tulis spesifikasi lebih dulu lewat `/spec-fitur <nama>`, lalu implementasikan
  di sesi baru dengan konteks bersih.
- `/clear` di antara tugas yang tidak berhubungan.

## Etiket repo

- Branch: `feat/…`, `fix/…`, `docs/…`, `refactor/…`.
- **JANGAN PERNAH** push langsung ke `main`. Selalu lewat branch + pull request draft.
- Pesan commit imperatif berbahasa Indonesia, mis. `tambah modul penyewaan kavling`.
- Jangan `git push --force`, `git reset --hard`, atau `git clean -fdx` tanpa diminta.

## Aturan keras

- **JANGAN** commit kredensial, token, atau isi `.env`. Gunakan `.env.example` untuk contoh.
- **JANGAN** menonaktifkan, melewati (`skip`), atau menghapus test/lint agar build hijau.
  Perbaiki akar masalahnya.
- **JANGAN** menambah dependensi baru tanpa persetujuan pemilik repo.
- Jangan menyentuh file di luar cakupan tugas yang diminta.
