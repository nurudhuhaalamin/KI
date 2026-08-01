import { describe, expect, it } from "vitest";

import {
  bacaDefinisi,
  bacaIsian,
  ringkasJawaban,
  validasiIsian,
  type DefinisiKolom,
} from "./formulir";

const definisi: DefinisiKolom[] = [
  { nama: "kontraktor", label: "Nama kontraktor", tipe: "teks", wajib: true },
  { nama: "jumlah_pekerja", label: "Jumlah pekerja", tipe: "angka", wajib: true },
  { nama: "mulai", label: "Tanggal mulai", tipe: "tanggal", wajib: false },
  {
    nama: "risiko",
    label: "Tingkat risiko",
    tipe: "pilihan",
    wajib: true,
    pilihan: ["rendah", "sedang", "tinggi"],
  },
];

describe("bacaDefinisi", () => {
  it("membaca definisi yang benar apa adanya", () => {
    const json = JSON.stringify([
      { nama: "kontraktor", label: "Nama kontraktor", tipe: "teks", wajib: true },
    ]);
    expect(bacaDefinisi(json)).toEqual([
      {
        nama: "kontraktor",
        label: "Nama kontraktor",
        labelEn: undefined,
        tipe: "teks",
        wajib: true,
        pilihan: undefined,
        petunjuk: undefined,
      },
    ]);
  });

  it("mengembalikan daftar kosong untuk JSON rusak atau bukan larik", () => {
    // Halaman perizinan tidak boleh mati hanya karena pengaturan salah ketik.
    expect(bacaDefinisi("{bukan json")).toEqual([]);
    expect(bacaDefinisi('{"nama":"x"}')).toEqual([]);
    expect(bacaDefinisi(null)).toEqual([]);
    expect(bacaDefinisi("")).toEqual([]);
  });

  it("membuang baris yang namanya tidak sah atau tipenya tidak dikenal", () => {
    const json = JSON.stringify([
      { nama: "Nama Besar", label: "spasi & huruf besar", tipe: "teks", wajib: true },
      { nama: "sah", label: "Sah", tipe: "warna", wajib: false },
      { nama: "9awal", label: "Diawali angka", tipe: "teks", wajib: false },
      { nama: "benar", label: "Benar", tipe: "teks", wajib: false },
    ]);
    expect(bacaDefinisi(json).map((k) => k.nama)).toEqual(["benar"]);
  });

  it("membuang nama kolom yang kembar", () => {
    const json = JSON.stringify([
      { nama: "sama", label: "Pertama", tipe: "teks", wajib: false },
      { nama: "sama", label: "Kedua", tipe: "angka", wajib: true },
    ]);
    const hasil = bacaDefinisi(json);
    expect(hasil).toHaveLength(1);
    expect(hasil[0]?.label).toBe("Pertama");
  });

  it("membuang kolom pilihan yang tidak punya pilihan", () => {
    const json = JSON.stringify([
      { nama: "kosong", label: "Tanpa pilihan", tipe: "pilihan", wajib: true },
      { nama: "isi", label: "Ada pilihan", tipe: "pilihan", wajib: true, pilihan: ["a"] },
    ]);
    expect(bacaDefinisi(json).map((k) => k.nama)).toEqual(["isi"]);
  });

  it("memakai nama sebagai label bila labelnya kosong", () => {
    const json = JSON.stringify([{ nama: "tanpa_label", tipe: "teks", wajib: false }]);
    expect(bacaDefinisi(json)[0]?.label).toBe("tanpa_label");
  });
});

describe("validasiIsian", () => {
  it("menerima isian lengkap dan benar", () => {
    const hasil = validasiIsian(definisi, {
      kontraktor: "PT Bangun Jaya",
      jumlah_pekerja: "12",
      mulai: "2026-09-01",
      risiko: "sedang",
    });
    expect(hasil).toEqual({
      berhasil: true,
      nilai: {
        kontraktor: "PT Bangun Jaya",
        jumlah_pekerja: "12",
        mulai: "2026-09-01",
        risiko: "sedang",
      },
    });
  });

  it("menolak kolom wajib yang kosong atau hanya spasi", () => {
    const hasil = validasiIsian(definisi, {
      kontraktor: "   ",
      jumlah_pekerja: "",
      risiko: "rendah",
    });
    expect(hasil.berhasil).toBe(false);
    if (hasil.berhasil) return;
    expect(hasil.galat).toEqual([
      { kolom: "kontraktor", sebab: "wajib" },
      { kolom: "jumlah_pekerja", sebab: "wajib" },
    ]);
  });

  it("membiarkan kolom tidak wajib yang dikosongkan", () => {
    const hasil = validasiIsian(definisi, {
      kontraktor: "PT Contoh",
      jumlah_pekerja: "3",
      risiko: "rendah",
    });
    expect(hasil.berhasil).toBe(true);
    if (!hasil.berhasil) return;
    expect(hasil.nilai).not.toHaveProperty("mulai");
  });

  it("menolak angka yang bukan angka dan tanggal yang tidak ada di kalender", () => {
    const hasil = validasiIsian(definisi, {
      kontraktor: "PT Contoh",
      jumlah_pekerja: "dua belas",
      mulai: "2026-02-31",
      risiko: "rendah",
    });
    expect(hasil.berhasil).toBe(false);
    if (hasil.berhasil) return;
    expect(hasil.galat).toEqual([
      { kolom: "jumlah_pekerja", sebab: "bukanAngka" },
      { kolom: "mulai", sebab: "bukanTanggal" },
    ]);
  });

  it("menolak nilai pilihan di luar daftar", () => {
    const hasil = validasiIsian(definisi, {
      kontraktor: "PT Contoh",
      jumlah_pekerja: "1",
      risiko: "sangat-tinggi",
    });
    expect(hasil.berhasil).toBe(false);
    if (hasil.berhasil) return;
    expect(hasil.galat).toEqual([{ kolom: "risiko", sebab: "diLuarPilihan" }]);
  });

  it("menolak teks yang melampaui batas panjang", () => {
    const hasil = validasiIsian(definisi, {
      kontraktor: "x".repeat(201),
      jumlah_pekerja: "1",
      risiko: "rendah",
    });
    expect(hasil.berhasil).toBe(false);
    if (hasil.berhasil) return;
    expect(hasil.galat).toEqual([{ kolom: "kontraktor", sebab: "terlaluPanjang" }]);
  });

  it("membuang kunci yang tidak ada di definisi", () => {
    // Kolom sisipan dari formulir yang diubah pemohon tidak boleh ikut tersimpan.
    const hasil = validasiIsian(definisi, {
      kontraktor: "PT Contoh",
      jumlah_pekerja: "1",
      risiko: "rendah",
      peran: "admin",
      catatan_rahasia: "apa saja",
    });
    expect(hasil.berhasil).toBe(true);
    if (!hasil.berhasil) return;
    expect(Object.keys(hasil.nilai).sort()).toEqual(["jumlah_pekerja", "kontraktor", "risiko"]);
  });

  it("menerima angka desimal dan negatif", () => {
    const hasil = validasiIsian([{ nama: "luas", label: "Luas", tipe: "angka", wajib: true }], {
      luas: "1250,5",
    });
    expect(hasil.berhasil).toBe(true);
  });
});

describe("bacaIsian", () => {
  it("membaca jawaban tersimpan dan mengabaikan nilai bukan teks", () => {
    expect(bacaIsian('{"a":"satu","b":2,"c":null}')).toEqual({ a: "satu" });
  });

  it("mengembalikan objek kosong untuk JSON rusak atau larik", () => {
    expect(bacaIsian("[1,2]")).toEqual({});
    expect(bacaIsian("bukan json")).toEqual({});
    expect(bacaIsian(null)).toEqual({});
  });
});

describe("ringkasJawaban", () => {
  it("menampilkan seluruh pertanyaan termasuk yang tidak dijawab", () => {
    const hasil = ringkasJawaban(definisi, { kontraktor: "PT Contoh", risiko: "tinggi" });
    expect(hasil).toEqual([
      { label: "Nama kontraktor", nilai: "PT Contoh" },
      { label: "Jumlah pekerja", nilai: null },
      { label: "Tanggal mulai", nilai: null },
      { label: "Tingkat risiko", nilai: "tinggi" },
    ]);
  });

  it("memakai label Inggris bila tersedia dan bahasa yang dipilih Inggris", () => {
    const dwibahasa: DefinisiKolom[] = [
      { nama: "a", label: "Kontraktor", labelEn: "Contractor", tipe: "teks", wajib: false },
      { nama: "b", label: "Hanya Indonesia", tipe: "teks", wajib: false },
    ];
    expect(ringkasJawaban(dwibahasa, {}, "en").map((r) => r.label)).toEqual([
      "Contractor",
      "Hanya Indonesia",
    ]);
  });
});
