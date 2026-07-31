# Panduan Pemakaian Claude Code — Proyek KI

Dokumen ini adalah pedoman kerja tim saat membangun System Kawasan Industri dengan
bantuan Claude Code. Dibaca manusia; tidak dimuat otomatis ke konteks setiap sesi.
Aturan yang perlu diketahui Claude di **setiap** sesi ada di `CLAUDE.md` dan
`.claude/rules/`, dan sengaja dijaga tetap ringkas.

Disusun dari dokumentasi resmi di <https://code.claude.com/docs>.

---

## 1. Model mental: agen, bukan chatbot

Claude Code bukan kotak tanya-jawab. Ia membaca berkas, menjalankan perintah, mengubah
kode, dan bekerja menembus masalah secara mandiri sementara Anda mengawasi, mengarahkan,
atau meninggalkannya sebentar.

Konsekuensinya, cara kerja Anda berubah: alih-alih menulis kode lalu meminta Claude
mengulasnya, Anda menjelaskan apa yang diinginkan dan Claude yang menelusuri, merancang,
lalu mengimplementasikan. Yang tetap jadi tanggung jawab Anda adalah **kejelasan
permintaan** dan **cara memverifikasi hasilnya**.

## 2. Batasan utama: context window

Hampir semua praktik baik di dokumen ini turun dari satu kenyataan: jendela konteks
Claude terisi cepat, dan mutunya menurun saat konteks makin penuh.

Konteks memuat seluruh percakapan — setiap pesan, setiap berkas yang dibaca, setiap
keluaran perintah. Satu sesi penelusuran kode bisa menghabiskan puluhan ribu token.
Saat konteks mendekati penuh, Claude mulai "melupakan" instruksi awal dan lebih sering
keliru.

Gejala dan penanganannya:

| Gejala | Tindakan |
|---|---|
| Berpindah ke tugas yang tidak berhubungan | `/clear` — reset konteks sepenuhnya |
| Konteks penuh tapi pekerjaan belum selesai | `/compact fokus pada perubahan API` — ringkas dengan arahan |
| Claude salah arah, ingin mundur | `Esc` untuk menghentikan, `Esc Esc` atau `/rewind` untuk memulihkan |
| Butuh riset yang membaca banyak berkas | Minta subagent: *"pakai subagent untuk menelusuri X"* |
| Pertanyaan sampingan singkat | `/btw` — jawabannya tidak masuk riwayat percakapan |

Gunakan `/context` untuk melihat apa saja yang termuat dan seberapa penuh konteksnya.

## 3. Alur kerja empat fase

### Fase 1 — Telusuri (plan mode)

Masuk plan mode. Claude membaca dan menjawab tanpa mengubah apa pun.

> baca modul penyewaan di `src/sewa` dan jelaskan bagaimana status kontrak dihitung.
> lihat juga bagaimana kita menangani migrasi database.

### Fase 2 — Rencanakan (masih plan mode)

> saya ingin menambah perpanjangan kontrak otomatis. berkas apa saja yang berubah?
> bagaimana alur datanya? buat rencana.

Tekan `Ctrl+G` untuk membuka rencana di editor dan menyuntingnya langsung sebelum
disetujui.

### Fase 3 — Implementasikan

> implementasikan perpanjangan kontrak sesuai rencana. tulis test untuk kasus kontrak
> yang sudah kedaluwarsa, jalankan test, perbaiki yang gagal.

### Fase 4 — Commit

> commit dengan pesan deskriptif lalu buka pull request draft

**Kapan plan mode tidak perlu.** Plan mode menambah biaya langkah. Untuk perbaikan
typo, menambah satu baris log, atau mengganti nama variabel — minta langsung. Aturan
praktisnya: kalau diff-nya bisa Anda jelaskan dalam satu kalimat, lewati perencanaan.

## 4. Menulis permintaan yang efektif

Claude bisa menebak maksud, tapi tidak bisa membaca pikiran. Makin presisi permintaan,
makin sedikit koreksi yang dibutuhkan.

| Strategi | Kurang baik | Lebih baik |
|---|---|---|
| Batasi cakupan | *"buat test untuk modul tenant"* | *"tulis test untuk `TenantService` yang mencakup kasus tenant tanpa kontrak aktif. hindari mock."* |
| Tunjuk sumber jawaban | *"kenapa perhitungan tagihan aneh?"* | *"telusuri riwayat git `BillingCalculator` dan ringkas bagaimana rumusnya sampai seperti sekarang"* |
| Rujuk pola yang sudah ada | *"tambah halaman laporan"* | *"lihat cara halaman daftar kavling dibangun sebagai contoh pola, lalu buat halaman laporan okupansi mengikuti pola yang sama. jangan tambah pustaka baru."* |
| Deskripsikan gejala | *"perbaiki bug login"* | *"pengguna gagal login setelah sesi kedaluwarsa. periksa alur di `src/auth/`, terutama refresh token. tulis test yang gagal dulu untuk mereproduksi, baru perbaiki."* |

Cara memasok konteks: rujuk berkas dengan `@`, tempel tangkapan layar langsung ke prompt,
berikan URL dokumentasi, atau salurkan data lewat pipa (`cat error.log | claude`).

Permintaan yang longgar tetap berguna saat Anda memang sedang menjajaki, misalnya
*"menurutmu apa yang perlu diperbaiki di berkas ini?"*.

## 5. Selalu sediakan cara verifikasi

Claude berhenti ketika pekerjaan **tampak** selesai. Tanpa alat cek, "tampak selesai"
adalah satu-satunya sinyal yang tersedia, dan Anda-lah yang jadi loop verifikasinya:
setiap kesalahan menunggu Anda menemukannya.

Beri Claude sesuatu yang menghasilkan lulus/gagal — suite test, exit code build, linter,
skrip yang membandingkan keluaran dengan fixture, atau tangkapan layar yang dibandingkan
dengan rancangan. Setelah itu loop menutup sendiri: Claude bekerja, menjalankan cek,
membaca hasilnya, dan mengulang sampai lulus.

Minta **bukti**, bukan klaim. Keluaran test, perintah yang dijalankan beserta hasilnya,
atau tangkapan layar. Meninjau bukti jauh lebih cepat daripada menjalankan ulang
verifikasinya sendiri — dan itu satu-satunya cara menilai sesi yang tidak Anda tunggui.

> Selama perintah build/test di `CLAUDE.md` masih `TODO`, Claude belum punya alat cek
> apa pun untuk kode KI. Melengkapinya adalah pekerjaan pertama setelah stack ditetapkan.

## 6. Mekanisme mana untuk kebutuhan mana

| Kebutuhan | Pakai | Letak di repo ini |
|---|---|---|
| Konteks yang berlaku di semua sesi | `CLAUDE.md` | `CLAUDE.md` |
| Aturan yang hanya relevan untuk sebagian berkas | `.claude/rules/` + frontmatter `paths` | `.claude/rules/` |
| Prosedur panjang yang dipakai sesekali | Skill | `.claude/skills/` |
| Harus terjadi setiap kali, tanpa kecuali | Hook | `.claude/settings.json` + `.claude/hooks/` |
| Riset yang membaca banyak berkas | Subagent | — |
| Akses layanan eksternal (GitHub, database) | CLI tool atau MCP | — |

Perbedaan paling penting: **`CLAUDE.md` bersifat anjuran, hook dan permission bersifat
paksaan.** Claude berusaha mengikuti `CLAUDE.md`, tapi tidak ada jaminan mutlak. Aturan
yang tidak boleh dilanggar sama sekali harus ditulis sebagai hook atau deny-rule.

Tanda `CLAUDE.md` bermasalah: bila Claude terus melanggar satu aturan padahal aturannya
tertulis, berkasnya kemungkinan terlalu panjang dan aturan itu tenggelam. Pangkas.
Untuk setiap baris, tanyakan: *"kalau baris ini dihapus, apakah Claude jadi salah?"*
Kalau tidak, buang.

## 7. Merancang fitur besar sebelum menulis kode

Untuk fitur yang cukup besar, jangan langsung minta implementasi. Jalankan:

```
/spec-fitur perpanjangan-kontrak
```

Claude akan mewawancarai Anda dengan `AskUserQuestion` soal implementasi teknis, UI/UX,
edge case, dan trade-off — termasuk hal yang belum Anda pikirkan — lalu menulis
spesifikasi mandiri ke `docs/spec/<nama-fitur>.md`.

Setelah spesifikasi selesai, **mulai sesi baru** untuk implementasi. Sesi baru punya
konteks bersih yang sepenuhnya terfokus pada pengerjaan, dan Anda punya dokumen tertulis
sebagai rujukan. Waktu yang dihabiskan untuk mempresisikan spesifikasi terbayar lebih
besar daripada waktu menonton implementasi berjalan.

## 8. Keamanan dan permission

Repo ini sudah membawa `.claude/settings.json` yang:

- **Mengizinkan** perintah baca-saja yang aman (`git status`, `git diff`, `git log`,
  `--version`, `--help`) supaya tidak ada prompt untuk hal remeh.
- **Menolak** pembacaan dan penyuntingan `.env`, `*.pem`, `*.key`; force push; push
  langsung ke `main`; dan `git reset --hard`.
- Menjalankan hook `PreToolUse` (`.claude/hooks/cegah-perintah-berisiko.sh`) yang
  memblokir perintah destruktif dalam berbagai bentuk penulisannya.

Hal yang perlu dipahami:

- Aturan berkas ditulis dengan `Edit(...)`, yang mencakup semua tool penulisan.
  `Write(...)` **tidak** dikenali oleh pemeriksaan permission berkas.
- Pola argumen Bash itu rapuh. `Bash(curl https://contoh.com/ *)` tidak menutup variasi
  penulisan lain. Untuk membatasi akses jaringan, tolak `curl`/`wget` lalu izinkan domain
  tertentu lewat `WebFetch(domain:...)`.
- Aturan `deny` selalu menang atas `allow`, jadi deny-rule tidak bisa dibuatkan
  pengecualian oleh allow-rule yang lebih spesifik.
- **Jangan pernah** menjalankan Claude Code dengan `bypassPermissions` di repo ini.
  Bila prompt terasa terlalu sering, tambahkan allow-rule spesifik atau gunakan mode
  `auto`, jangan mematikan pengamannya.

Untuk menambah aturan, sunting `.claude/settings.json` (dibagikan ke tim) atau
`.claude/settings.local.json` (pribadi, tidak ikut ter-commit).

## 9. Anti-pola yang sering terjadi

- **Sesi campur aduk.** Mulai satu tugas, menyelip tugas lain, lalu kembali ke yang
  pertama. Konteks penuh hal tak relevan. → `/clear` di antara tugas berbeda.
- **Mengoreksi berulang-ulang.** Salah, dikoreksi, masih salah, dikoreksi lagi. Konteks
  tercemar pendekatan-pendekatan gagal. → Setelah dua koreksi gagal, `/clear` lalu tulis
  prompt awal yang lebih baik dengan memasukkan apa yang sudah Anda pelajari.
- **`CLAUDE.md` kembung.** Terlalu panjang sampai aturan pentingnya terabaikan.
  → Pangkas tanpa ampun; kalau Claude sudah benar tanpa instruksi itu, hapus saja.
- **Percaya tanpa verifikasi.** Implementasi tampak masuk akal tapi tidak menangani
  edge case. → Selalu sediakan test/skrip/tangkapan layar. Yang tidak bisa diverifikasi,
  jangan dikirim.
- **Penelusuran tanpa batas.** Meminta "selidiki X" tanpa batasan; ratusan berkas terbaca
  dan konteks habis. → Persempit cakupan atau delegasikan ke subagent.

## 10. Checklist sebelum membangun sistem KI

1. [ ] Stack teknologi ditetapkan (bahasa, framework, database).
2. [ ] Perintah build / test / lint / dev diisi di `CLAUDE.md`, menggantikan `TODO`.
3. [ ] Kerangka proyek dibuat dan **satu test dummy bisa dijalankan sampai hijau** —
       inilah alat verifikasi pertama Claude.
4. [ ] Hook `PostToolUse` (lint setelah penyuntingan) dan/atau `Stop` (test sebelum
       giliran berakhir) ditambahkan ke `.claude/settings.json`.
5. [ ] Aturan gaya kode khusus bahasa ditambahkan sebagai `.claude/rules/*.md` dengan
       frontmatter `paths`, supaya hanya termuat saat berkas yang cocok dibuka.
6. [ ] `.env.example` dibuat; pastikan `.env` asli tidak pernah ter-commit.
7. [ ] Spesifikasi fitur pertama ditulis lewat `/spec-fitur`.
8. [ ] Baru mulai implementasi.

## 11. Perintah yang paling sering dipakai

| Perintah | Kegunaan |
|---|---|
| `/init` | Membuat rancangan awal `CLAUDE.md` dari struktur proyek |
| `/context` | Melihat isi konteks dan berkas memory yang termuat |
| `/clear` | Reset konteks antar tugas |
| `/compact <arahan>` | Meringkas percakapan dengan fokus tertentu |
| `/rewind` (`Esc Esc`) | Memulihkan percakapan dan/atau kode ke titik sebelumnya |
| `/memory` | Membuka dan menyunting berkas memory |
| `/permissions` | Meninjau dan mengubah aturan izin |
| `/hooks` | Melihat hook yang terpasang |
| `/doctor` | Memeriksa masalah konfigurasi |
| `/code-review` | Mengulas diff saat ini di subagent dengan konteks bersih |
| `/spec-fitur <nama>` | Wawancara dan penulisan spesifikasi fitur (skill repo ini) |

## Rujukan

- Praktik terbaik: <https://code.claude.com/docs/en/best-practices>
- Berkas memory / `CLAUDE.md`: <https://code.claude.com/docs/en/memory>
- Hook: <https://code.claude.com/docs/en/hooks>
- Permission: <https://code.claude.com/docs/en/permissions>
- Skill: <https://code.claude.com/docs/en/skills>
- Subagent: <https://code.claude.com/docs/en/sub-agents>
