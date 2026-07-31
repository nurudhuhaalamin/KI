# KI

Sistem tata kelola dan operasional kawasan industri.

Perizinan satu pintu, pemeriksaan RKL-RPL Rinci, keuangan kawasan, pemeliharaan
infrastruktur, monitoring lingkungan, keamanan, K3, pengendalian dokumen, dan
pelaporan — dalam satu sistem. Satu kawasan mendapat satu instans tersendiri.

## Status

Kerangka teknis selesai dan terverifikasi. Modul bisnis belum dibangun —
peta modul dan urutan pengerjaannya ada di [docs/arsitektur.md](docs/arsitektur.md).

## Menjalankan secara lokal

Butuh Node.js 22 atau lebih baru.

```bash
npm install                    # 1. pasang dependensi
cp .dev.vars.example .dev.vars # 2. siapkan rahasia lokal
npm run db:migrate:local       # 3. buat struktur database
npm run db:seed                # 4. isi data demo
npm run dev                    # 5. jalankan di http://localhost:5173
```

Akun demo (kata sandi sama untuk ketiganya: `KawasanDemo2026!`):

| Surel                | Peran  |
| -------------------- | ------ |
| `admin@contoh.test`  | admin  |
| `staf@contoh.test`   | staf   |
| `tenant@contoh.test` | tenant |

## Memeriksa hasil kerja

```bash
npm run check      # pemeriksaan tipe + lint + test unit + build
npm run test:e2e   # menjalankan aplikasi sungguhan di peramban (Playwright)
```

`npm run check` menjawab lulus atau gagal tanpa perlu membaca kode. `test:e2e`
membuktikan alur nyata: login, halaman internal yang menolak tamu, dan pergantian
bahasa. Jalankan keduanya sebelum menganggap sebuah perubahan selesai.

## Dokumentasi

- **[docs/panduan-claude-code.md](docs/panduan-claude-code.md)** — pedoman
  pemakaian Claude Code: alur kerja, cara memberi konteks, verifikasi, keamanan,
  anti-pola, dan checklist sebelum membangun.
- **[docs/arsitektur.md](docs/arsitektur.md)** — susunan sistem, peta modul, cara
  menambah modul, dan langkah merilis instans untuk kawasan pembeli baru.
- **[CLAUDE.md](CLAUDE.md)** — aturan proyek yang dibaca Claude di setiap sesi.
- **[.claude/](.claude/)** — pemberlakuan teknis: aturan izin, hook pencegah
  perintah berisiko, hook penegak mutu, dan skill `/spec-fitur`.
