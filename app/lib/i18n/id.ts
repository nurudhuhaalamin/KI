/**
 * Pesan bahasa Indonesia. Berkas ini adalah acuan — tipe `Messages`
 * diturunkan darinya, sehingga berkas terjemahan lain wajib memuat
 * seluruh kunci yang sama. Kunci yang belum diterjemahkan akan
 * ditolak oleh `npm run typecheck`, bukan lolos diam-diam.
 */
export const id = {
  situs: {
    nama: "Kawasan Industri",
    tagline: "Sistem tata kelola dan operasional kawasan",
  },
  nav: {
    beranda: "Beranda",
    masuk: "Masuk",
    keluar: "Keluar",
    dasbor: "Dasbor",
  },
  beranda: {
    judul: "Sistem Tata Kelola & Operasional Kawasan Industri",
    ringkasan:
      "Pengelolaan perizinan, lingkungan, infrastruktur, keamanan, dan pelaporan kawasan dalam satu sistem.",
    masukSebagaiPengelola: "Masuk sebagai pengelola",
  },
  masuk: {
    judul: "Masuk",
    surel: "Alamat surel",
    kataSandi: "Kata sandi",
    tombol: "Masuk",
    sedangMemproses: "Memproses…",
    gagal: "Alamat surel atau kata sandi tidak sesuai.",
  },
  dasbor: {
    judul: "Dasbor",
    selamatDatang: "Selamat datang",
    peran: "Peran",
  },
  umum: {
    bahasa: "Bahasa",
    galat: "Terjadi kesalahan",
    galatKeterangan: "Silakan coba lagi beberapa saat lagi.",
    tidakDitemukan: "Halaman tidak ditemukan",
    kembaliKeBeranda: "Kembali ke beranda",
  },
};

export type Messages = typeof id;
