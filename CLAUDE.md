# KI — System Kawasan Industri

Sistem pengelolaan kawasan industri. Pedoman lengkap pemakaian Claude Code ada di
`docs/panduan-claude-code.md` (dokumen untuk dibaca manusia, tidak dimuat otomatis).

## Bahasa

- Percakapan, komentar kode, pesan commit, dan dokumentasi: **Bahasa Indonesia**.
- Nama variabel, fungsi, kelas, tabel, dan endpoint: **Bahasa Inggris**.

## Perintah penting

TODO — stack belum ditentukan. Isi blok ini segera setelah stack dipilih;
tanpa perintah yang bisa dijalankan, Claude tidak punya cara memverifikasi hasilnya.

```
Build : TODO
Test  : TODO
Lint  : TODO
Dev   : TODO
```

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
