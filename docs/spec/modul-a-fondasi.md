# Spesifikasi Modul A — Fondasi

## Latar belakang

Modul A adalah dasar yang dirujuk hampir seluruh modul lain: perizinan butuh tahu
siapa pemilik proses, RKL-RPL butuh susunan tim pemeriksa, pelaporan butuh unit
kerja untuk mengelompokkan KPI. Tanpa modul ini, modul B–M tidak punya tempat
menautkan tanggung jawab.

Kerangka teknis (Tahap 0) sudah menyediakan autentikasi, peran dasar, jejak audit,
dan tabel pengaturan. Modul A melengkapinya menjadi fondasi yang benar-benar bisa
dipakai mengelola organisasi pengelola kawasan.

Keputusan pada spesifikasi ini diambil sendiri berdasarkan proposal sumber
(Bagian II: desain organisasi, uraian jabatan, ruang lingkup per unit) karena
pemilik repo meminta keterlibatannya seminimal mungkin. Asumsi ditandai eksplisit.

## Ruang lingkup

1. **Unit kerja** — struktur organisasi pengelola kawasan, bertingkat (unit bisa
   punya induk). Menyimpan kode, nama dwibahasa, fungsi/ruang lingkup, urutan
   tampil, dan status aktif.
2. **Jabatan** — posisi di dalam unit kerja, dengan atasan langsung, ringkasan
   tugas, dan status aktif. Setara "Uraian Jabatan" pada proposal (II.2).
3. **Manajemen pengguna** — daftar, tambah, ubah, aktif/nonaktifkan pengguna;
   menetapkan peran, unit kerja, dan jabatan. Setel ulang kata sandi.
4. **Profil kawasan** — penyuntingan data kawasan yang tersimpan di tabel
   `pengaturan` (nama, alamat, bahasa bawaan, kontak).
5. **Jejak audit** — halaman baca-saja untuk menelusuri perubahan, dengan
   penyaring entitas dan aksi.
6. **Kerangka navigasi internal** — tata letak dengan menu samping yang menampilkan
   hanya menu yang boleh diakses peran pengguna.

### Di luar cakupan

- Matriks RACI dan KPI per unit (II.4, II.5) — menunggu modul L (Pelaporan),
  karena baru bermakna setelah ada data proses.
- Pendaftaran mandiri pengguna. Akun dibuat administrator; kawasan industri tidak
  membuka pendaftaran bebas.
- Verifikasi surel dan lupa kata sandi — menunggu pengiriman surel dipasang pada
  modul D (Perizinan), yang memang membutuhkannya untuk notifikasi.
- Impor massal pengguna dari berkas.

## Model data

Tambahan pada `app/lib/db/schema/organisasi.ts`:

**`unit_kerja`** — `id` (teks, dibuat sistem), `kode` (unik, mis. `OPS`),
`nama`, `namaEn`, `fungsi` (teks panjang, opsional), `indukId` (rujukan ke
`unit_kerja`, opsional), `urutan` (angka), `aktif` (boolean), `createdAt`,
`updatedAt`.

**`jabatan`** — `id`, `kode` (unik), `nama`, `namaEn`, `unitKerjaId` (wajib),
`atasanId` (rujukan ke `jabatan`, opsional), `ringkasanTugas`, `aktif`,
`createdAt`, `updatedAt`.

Perubahan pada `users`: tambah `unitKerjaId` dan `jabatanId`, keduanya opsional
dan `on delete set null` — menghapus unit kerja tidak boleh menghapus pengguna.

Pencegahan gelung pada hierarki (`indukId`, `atasanId`) divalidasi di sisi server,
bukan hanya di antarmuka.

## Perilaku

### Hak akses

| Halaman | admin | manajemen | staf | tenant |
|---|---|---|---|---|
| Dasbor | ✓ | ✓ | ✓ | ✓ |
| Unit kerja & jabatan | ubah | lihat | lihat | — |
| Pengguna | ubah | lihat | — | — |
| Profil kawasan | ubah | lihat | — | — |
| Jejak audit | ✓ | ✓ | — | — |

Peran `tenant` tidak boleh masuk area internal selain dasbor; portal tenant
dibangun pada modul B.

### Aturan

- Administrator terakhir yang aktif tidak boleh dinonaktifkan atau diturunkan
  perannya — mencegah kawasan terkunci dari sistemnya sendiri.
- Pengguna tidak boleh menonaktifkan akunnya sendiri.
- Unit kerja yang masih memiliki jabatan atau pengguna tidak boleh dihapus;
  nonaktifkan saja. Penghapusan permanen tidak disediakan pada modul ini.
- Kode unit kerja dan jabatan bersifat unik dan tidak bisa diubah setelah dibuat —
  dokumen dan penomoran modul lain akan merujuknya.
- Setiap perubahan tercatat di `jejak_audit` lewat satu fungsi bersama
  `catatAudit()`, bukan dipanggil manual per tempat.
- Jejak audit tidak memuat data pribadi; hanya entitas, id, dan ringkasan perubahan.

## Berkas yang terlibat

- `app/lib/db/schema/organisasi.ts` — skema baru
- `app/lib/db/schema/auth.ts` — tambah kolom pada `users`
- `app/lib/audit/index.ts` — `catatAudit()`
- `app/modules/organisasi/` — validasi Zod dan query
- `app/routes/internal/` — halaman unit kerja, jabatan, pengguna, pengaturan, jejak audit
- `app/components/internal/` — tata letak, menu samping, tabel, kolom formulir
- `app/lib/i18n/id.ts` dan `en.ts` — kunci teks baru
- `db/migrations/0001_*.sql` — migrasi

## Verifikasi

1. `npm run check` → exit 0.
2. `npm run test` → test unit untuk validasi Zod, pencegahan gelung hierarki,
   dan aturan administrator terakhir.
3. `npm run test:e2e` → skenario:
   - admin membuat unit kerja lalu jabatan di dalamnya, keduanya muncul di daftar;
   - admin membuat pengguna baru, pengguna itu bisa masuk;
   - staf dialihkan dengan 403 saat membuka halaman pengguna;
   - perubahan muncul di halaman jejak audit;
   - menu samping menampilkan menu berbeda untuk admin dan staf.
4. Seed diperbarui: 4 unit kerja dan 6 jabatan contoh agar sistem bisa langsung dicoba.
