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
| B   | Kavling, tenant & kontrak, portal tenant                                 | IV.3, IV.4    | **selesai**                             |
| C   | Pengendalian dokumen: daftar induk, penomoran, versi, pengesahan         | XI.1          | **selesai**                             |
| D   | Perizinan satu pintu: formulir dinamis, persetujuan berjenjang, SLA      | IV.1, IV.2    | **selesai**                             |
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

Modul yang menerbitkan sesuatu bernomor memakai `app/lib/penomoran/`, bukan
membuat penomorannya sendiri. Modul yang menyimpan berkas menambah satu cabang
di `app/lib/berkas/akses.ts`, bukan menulis rute unduhan berikut pemeriksaan
izinnya sendiri. Pemberitahuan lewat `kirimNotifikasi()` di `app/lib/notifikasi/`.

### Menjalankan E2E

Seluruh suite kini sekitar 25 menit dan berjalan satu worker karena berbagi satu
database. Jalankan per berkas bila alat yang dipakai punya batas waktu:

```
npx playwright test e2e/modul-d-perizinan.spec.ts
npx playwright test e2e/alur-utama.spec.ts e2e/modul-a-fondasi.spec.ts
npx playwright test e2e/modul-b-kavling-tenant.spec.ts
npx playwright test e2e/modul-c-dokumen.spec.ts
```

Jalankan `npm run db:seed` lebih dulu: seed mengembalikan data demo ke keadaan
awal, dan sebagian skenario memang bertumpu padanya.

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

### Urutan deploy tidak boleh dibalik

`wrangler.jsonc` di akar repo adalah konfigurasi **sumber**, bukan yang dipakai
saat deploy. `npm run build` menghasilkan konfigurasi turunan di
`build/server/wrangler.json`, dan `wrangler deploy` diarahkan ke sana lewat
`.wrangler/deploy/config.json` yang dibuat plugin Vite.

Akibatnya `wrangler deploy` **selalu** harus didahului `npm run build`. Menjalankan
`wrangler deploy` pada repo yang baru di-clone akan gagal dengan pesan
*"the redirected configuration path … does not exist"*. Gunakan `npm run deploy`
yang sudah menggabungkan keduanya.

### Cloudflare Workers Builds (integrasi Git)

Bila kawasan memakai Workers Builds agar setiap push otomatis ter-deploy, atur di
dasbor Cloudflare:

| Pengaturan | Nilai |
|---|---|
| Build command | `npm run build` |
| Deploy command | `npx wrangler deploy` |

Sebelum build pertama bisa berhasil, sumber daya berikut harus sudah ada di akun:

1. Database D1 sudah dibuat dan `database_id`-nya **sudah ditulis** di
   `wrangler.jsonc` — nilai bawaan di repo ini masih penanda
   `00000000-0000-0000-0000-000000000000` dan pasti menggagalkan deploy.
2. Bucket R2 sudah dibuat dengan nama yang sama seperti di `wrangler.jsonc`.
3. `BETTER_AUTH_SECRET` sudah dipasang lewat `wrangler secret put`.
4. Akun berada pada paket **Workers Paid** agar batas D1 menjadi 10 GB.

Alur GitHub Actions di `.github/workflows/ci.yml` melakukan urutan ini dengan
benar dan melewati langkah deploy selama secret Cloudflare belum diatur, sehingga
pemeriksaan mutu tetap berjalan sebelum akun disiapkan.

## Keputusan yang masih terbuka

Ditunda sampai modul yang membutuhkannya dikerjakan, agar tidak menebak terlalu dini:

- **Pembuat PDF** (surat izin, berita acara, invoice): `pdf-lib` di dalam Worker
  atau Browser Rendering API Cloudflare.
- **Peta kavling**: Leaflet + OpenStreetMap, atau denah SVG dengan area klik.
- **Payment gateway** untuk modul keuangan.
- **Pengiriman surel**: Resend direncanakan. Modul D sudah menyediakan titik
  sambungnya — seluruh pemberitahuan dibuat lewat `kirimNotifikasi()` di
  `app/lib/notifikasi/`, jadi pemasangan surel nanti hanya menyentuh berkas itu.
  Menunggu akun Resend, kunci API, dan domain terverifikasi milik kawasan.
