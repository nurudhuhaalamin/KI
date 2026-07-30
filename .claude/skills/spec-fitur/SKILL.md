---
name: spec-fitur
description: Wawancarai pemilik fitur lalu tulis spesifikasi mandiri ke docs/spec/ sebelum implementasi dimulai
disable-model-invocation: true
---

# Menulis spesifikasi fitur KI

Nama fitur: $ARGUMENTS

Tujuan skill ini adalah memisahkan **perancangan** dari **implementasi**. Hasil akhirnya
satu berkas spesifikasi yang cukup lengkap untuk dikerjakan di sesi baru dengan konteks
bersih. Jangan menulis kode aplikasi apa pun di sesi ini.

## Langkah

1. **Pahami dulu konteks yang ada.** Baca `README.md`, `CLAUDE.md`, dan spesifikasi lain
   di `docs/spec/` bila ada. Bila fitur menyentuh kode yang sudah ada, cari pola sejenis
   yang bisa dipakai ulang sebelum merancang sesuatu yang baru.

2. **Wawancara dengan `AskUserQuestion`.** Ajukan pertanyaan bergelombang, bukan sekaligus.
   Lewati pertanyaan yang jawabannya sudah jelas dari konteks. Gali hal yang belum
   dipikirkan pemilik fitur:
   - Ruang lingkup: apa yang termasuk, dan yang lebih penting — apa yang **tidak** termasuk.
   - Data: entitas, relasi, field wajib, aturan validasi, kebutuhan migrasi.
   - Peran dan hak akses: siapa boleh melihat, membuat, mengubah, menghapus.
   - Alur pengguna dan tampilan: layar yang dibutuhkan, keadaan kosong, keadaan error.
   - Edge case: data ganda, penghapusan bertingkat, akses bersamaan, nilai batas.
   - Trade-off: mana yang dikorbankan bila ada dua pendekatan yang masuk akal.
   Lanjutkan sampai tidak ada lagi lubang yang berarti.

3. **Tulis spesifikasi** ke `docs/spec/<nama-fitur>.md` dengan bagian:
   - **Latar belakang** — masalah yang dipecahkan dan alasan dikerjakan sekarang.
   - **Ruang lingkup** — daftar yang dikerjakan, disusul daftar **di luar cakupan**.
   - **Model data** — entitas, field, relasi, perubahan skema.
   - **Perilaku** — aturan bisnis dan alur, termasuk edge case dari hasil wawancara.
   - **Berkas dan antarmuka yang terlibat** — path konkret yang akan dibuat atau diubah.
   - **Verifikasi** — langkah end-to-end yang membuktikan fitur bekerja, ditambah kasus
     uji yang harus ada. Bagian ini wajib; spesifikasi tanpa cara verifikasi belum selesai.
   - **Pertanyaan terbuka** — hal yang sengaja ditunda beserta alasannya.

4. **Tutup dengan instruksi eksekusi.** Beri tahu pengguna agar menjalankan `/clear` atau
   membuka sesi baru, lalu memulai implementasi dengan merujuk berkas spesifikasi tadi.
   Konteks bersih membuat sesi implementasi fokus dan tidak terbebani riwayat wawancara.
