# Aturan keamanan

- Kredensial, API key, dan connection string diambil dari variabel lingkungan.
  Jangan pernah ditulis langsung di kode, migrasi, seed, atau test.
- Validasi dan sanitasi seluruh input di sisi server, tidak cukup di sisi klien.
- Query database selalu memakai parameter binding / query builder, bukan rangkaian string.
- Setiap endpoint yang mengubah data wajib memeriksa autentikasi dan otorisasi.
- Jangan menulis data pribadi tenant (NIK, NPWP, nomor kontak, nilai kontrak) ke log,
  pesan error, atau respons API yang tidak memerlukannya.
- Pesan error ke pengguna bersifat umum; detail teknis hanya masuk log server.
- Unggahan berkas: batasi tipe dan ukuran, simpan di luar document root, jangan
  memakai nama berkas dari pengguna apa adanya.
