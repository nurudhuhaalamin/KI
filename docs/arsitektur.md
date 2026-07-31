# Arsitektur Sistem KI

Catatan teknis untuk manusia. Dibaca sebelum mengerjakan modul baru.
Aturan yang dibaca Claude di setiap sesi ada di `CLAUDE.md` dan `.claude/rules/`.

## Gambaran

Sistem tata kelola dan operasional kawasan industri. **Satu kawasan = satu
instans**: setiap kawasan yang membeli mendapat Worker, database D1, dan bucket
R2 sendiri. Ini bukan produk SaaS multi-tenant — data antar kawasan tidak pernah
berbagi tempat.

Pembeda antar kawasan (nama, alamat, logo, tarif, struktur unit kerja, jenis
izin) berada di **data konfigurasi**, bukan di kode. Repo ini tetap satu untuk
semua pembeli.

## Susunan

Satu aplikasi dengan tiga wajah:

| Wajah         | Akses                | Isi                                                                                                                 |
| ------------- | -------------------- | ------------------------------------------------------------------------------------------------------------------- |
| Publik        | tanpa login          | Profil kawasan, berita, direktori tenant, ketersediaan kavling, formulir minat investor, kanal pengaduan masyarakat |
| Internal      | login staf pengelola | Seluruh modul operasional, dibatasi per peran                                                                       |
| Portal tenant | login tenant         | Ajukan izin, lihat tagihan, lapor gangguan, unduh dokumen                                                           |

## Stack

| Lapis       | Pilihan                                                 |
| ----------- | ------------------------------------------------------- |
| Bahasa      | TypeScript (mode ketat, `noUncheckedIndexedAccess`)     |
| Framework   | React Router v8 framework mode + Cloudflare Vite plugin |
| Runtime     | Cloudflare Workers                                      |
| Database    | Cloudflare D1 (SQLite) + Drizzle ORM                    |
| Berkas      | Cloudflare R2                                           |
| Autentikasi | Better Auth (adapter Drizzle/SQLite)                    |
| Tampilan    | Tailwind CSS                                            |
| Validasi    | Zod                                                     |
| Test        | Vitest (logika) + Playwright (alur sungguhan)           |

**Kenapa bukan Next.js.** Next.js di Cloudflare butuh adapter OpenNext sebagai
lapisan penerjemah. Ketika lapisan itu bermasalah, sulit membedakan bug aplikasi
dari bug adapter. React Router adalah jalur yang didukung Cloudflare langsung.

**Kenapa bukan Postgres.** Skala satu kawasan muat nyaman dalam batas 10 GB per
database D1. Semua di satu akun Cloudflare, satu alat migrasi, emulasi lokal penuh.

## Binding Cloudflare

Didefinisikan di `wrangler.jsonc`, tipenya dihasilkan `npm run cf-typegen`
ke `worker-configuration.d.ts`.

| Binding              | Jenis  | Kegunaan                                         |
| -------------------- | ------ | ------------------------------------------------ |
| `DB`                 | D1     | Seluruh data kawasan                             |
| `BERKAS`             | R2     | Dokumen izin, foto inspeksi, lampiran, arsip     |
| `NAMA_KAWASAN`       | var    | Nama yang tampil di antarmuka                    |
| `LOKALE_BAWAAN`      | var    | Bahasa bawaan (`id`/`en`)                        |
| `BETTER_AUTH_SECRET` | secret | Penandatangan sesi — **tidak pernah masuk repo** |

Binding hanya tersedia di dalam konteks permintaan. Ambil lewat
`context.get(cloudflareContext)`, jangan `process.env`.

## Susunan folder

```
app/
  root.tsx                 # kerangka HTML, loader bahasa, batas galat
  routes.ts                # daftar rute
  routes/                  # halaman publik, internal, portal tenant
  components/              # komponen tampilan bersama
  modules/<nama-modul>/    # logika + tampilan per modul (mulai tahap 1)
  lib/
    context.ts             # jembatan binding Cloudflare ke loader/action
    db/                    # koneksi + skema Drizzle
    auth/                  # Better Auth, pembacaan sesi, pengaman peran
    i18n/                  # pesan ID & EN
    navigasi.ts            # pengaman pengalihan
db/migrations/             # migrasi D1
e2e/                       # skenario Playwright
scripts/                   # seed dan perkakas
workers/app.ts             # entry Worker
```

## Peta modul

Nomor Bagian merujuk proposal sumber yang menjadi acuan cakupan.

| #   | Modul                                                                    | Sumber        | Status                                  |
| --- | ------------------------------------------------------------------------ | ------------- | --------------------------------------- |
| —   | Kerangka teknis & alat verifikasi                                        | —             | **selesai**                             |
| A   | Fondasi: pengguna, peran, unit kerja, jabatan, jejak audit, konfigurasi  | II            | **selesai**                             |
| B   | Kavling, tenant & kontrak                                                | IV.3, IV.4    | belum                                   |
| C   | Pengendalian dokumen: daftar induk, penomoran, versi, pengesahan         | XI.1          | belum                                   |
| D   | Perizinan satu pintu: formulir dinamis, persetujuan berjenjang, SLA      | IV.1, IV.2    | belum                                   |
| E   | RKL-RPL Rinci: tim pemeriksa, verifikasi 3+10 hari, PKPLH PU, pemantauan | V.7–V.9       | belum                                   |
| F   | Keuangan kawasan: tarif, meter, tagihan, pembayaran, tunggakan           | IV.5          | belum                                   |
| G   | Infrastruktur & pemeliharaan: aset, jadwal, inspeksi, work order         | V.1, V.5, V.6 | belum                                   |
| H   | Lingkungan: IPAL, sampling air limbah, manifes sampah                    | V.2–V.4       | belum                                   |
| I   | Keamanan & tanggap darurat: tamu, patroli, insiden, evakuasi             | VI            | belum                                   |
| J   | K3: HIRADC, P2K3, kecelakaan kerja                                       | VII           | belum                                   |
| K   | Hubungan industrial & sosial: pengaduan, mediasi, TJSL, whistleblowing   | VIII, IX.5    | belum                                   |
| L   | Pelaporan & dasbor: KPI, laporan direksi, SIINas, audit internal         | X, II.5       | belum                                   |
| M   | Website publik & CMS dwibahasa                                           | XII.2         | sebagian (beranda sudah ada)            |

Urutan pengerjaan mengikuti ketergantungan: A → B → C → D → E → F → G+H → I+J →
K → L → M → pengerasan. Modul belakangan memakai data dan pola modul di depannya.

## Cara menambah modul

1. Tulis spesifikasi lebih dulu: `/spec-fitur <nama-modul>` → menghasilkan
   `docs/spec/<nama-modul>.md`.
2. Mulai sesi baru berkonteks bersih, kerjakan mengacu spesifikasi itu.
3. Tambah skema di `app/lib/db/schema/<modul>.ts`, ekspor dari `schema/index.ts`.
4. `npm run db:generate -- --name <nama>` lalu `npm run db:migrate:local`.
5. Buat `app/modules/<modul>/` untuk logika, `app/routes/internal/<modul>/`
   untuk halaman.
6. Tambah kunci teks di `app/lib/i18n/id.ts` dan `en.ts`.
7. Tulis test: Vitest untuk logika, Playwright untuk alur.
8. `npm run check` dan `npm run test:e2e` harus hijau sebelum PR.

## Merilis instans untuk kawasan pembeli baru

```bash
# 1. Buat database dan bucket khusus kawasan tersebut
npx wrangler d1 create ki-<nama-kawasan>
npx wrangler r2 bucket create ki-<nama-kawasan>-berkas

# 2. Salin repo ini, lalu sesuaikan wrangler.jsonc:
#    - "name"          -> ki-<nama-kawasan>
#    - database_name & database_id  -> hasil langkah 1
#    - bucket_name     -> hasil langkah 1
#    - vars.NAMA_KAWASAN, vars.LOKALE_BAWAAN

# 3. Pasang rahasia produksi (nilai acak minimal 32 karakter)
npx wrangler secret put BETTER_AUTH_SECRET

# 4. Siapkan struktur database
npx wrangler d1 migrations apply ki-<nama-kawasan> --remote

# 5. Deploy
npm run deploy
```

Setelah itu isi data awal kawasan (profil, unit kerja, akun administrator) lewat
antarmuka. Jangan memakai `npm run db:seed` di produksi — isinya akun demo.

## Keputusan yang masih terbuka

Ditunda sampai modul yang membutuhkannya dikerjakan, agar tidak menebak terlalu dini:

- **Pembuat PDF** (surat izin, berita acara, invoice): `pdf-lib` di dalam Worker
  atau Browser Rendering API Cloudflare.
- **Peta kavling**: Leaflet + OpenStreetMap, atau denah SVG dengan area klik.
- **Payment gateway** untuk modul keuangan.
- **Pengiriman surel**: Resend direncanakan, dipasang saat modul perizinan
  membutuhkan notifikasi.
