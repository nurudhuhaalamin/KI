import { describe, expect, it } from "vitest";

import {
  POLA_BAWAAN,
  bolehDisahkan,
  bolehSuntingIsi,
  bolehUbahStatusDokumen,
  dokumenJatuhTempo,
  susunNomor,
  urutBerikutnya,
  type DokumenTinjau,
} from "./penomoran";

describe("susunNomor", () => {
  it("mengisi seluruh placeholder pola bawaan", () => {
    expect(
      susunNomor(POLA_BAWAAN, {
        kategori: "sop-pelayanan",
        kodeUnit: "OPS",
        urut: 7,
        tahun: 2026,
      }),
    ).toBe("SOP-PLY/OPS/007/2026");
  });

  it("membuat nomor urut selalu tiga digit agar urutan teks tetap benar", () => {
    const nomor = [1, 2, 10, 100].map((urut) =>
      susunNomor(POLA_BAWAAN, { kategori: "k3", kodeUnit: "LK3", urut, tahun: 2026 }),
    );
    expect(nomor).toEqual([
      "K3/LK3/001/2026",
      "K3/LK3/002/2026",
      "K3/LK3/010/2026",
      "K3/LK3/100/2026",
    ]);
    // Urutan menurut teks sama dengan urutan menurut angka.
    expect([...nomor].sort()).toEqual(nomor);
  });

  it("membuang placeholder unit yang kosong beserta pemisahnya", () => {
    expect(susunNomor(POLA_BAWAAN, { kategori: "governance", urut: 3, tahun: 2026 })).toBe(
      "GCG/003/2026",
    );
    expect(
      susunNomor(POLA_BAWAAN, {
        kategori: "governance",
        kodeUnit: "   ",
        urut: 3,
        tahun: 2026,
      }),
    ).toBe("GCG/003/2026");
  });

  it("menghormati pola khusus milik kawasan", () => {
    expect(
      susunNomor("KI-{tahun}-{kategori}-{urut}", {
        kategori: "pelaporan",
        urut: 12,
        tahun: 2027,
      }),
    ).toBe("KI-2027-LAP-012");
  });

  it("membiarkan placeholder yang tidak dikenal apa adanya", () => {
    expect(
      susunNomor("{kategori}/{entah}/{urut}", { kategori: "k3", urut: 1, tahun: 2026 }),
    ).toBe("K3/{entah}/001");
  });
});

describe("urutBerikutnya", () => {
  const terpakai = [
    { kategori: "k3" as const, tahun: 2026, urut: 1 },
    { kategori: "k3" as const, tahun: 2026, urut: 2 },
    { kategori: "governance" as const, tahun: 2026, urut: 1 },
    { kategori: "k3" as const, tahun: 2025, urut: 9 },
  ];

  it("mulai dari 1 bila kategori dan tahun itu belum punya dokumen", () => {
    expect(urutBerikutnya([], "k3", 2026)).toBe(1);
    expect(urutBerikutnya(terpakai, "pelaporan", 2026)).toBe(1);
  });

  it("melanjutkan dari nomor tertinggi dalam kategori dan tahun yang sama", () => {
    expect(urutBerikutnya(terpakai, "k3", 2026)).toBe(3);
    expect(urutBerikutnya(terpakai, "governance", 2026)).toBe(2);
  });

  it("menghitung terpisah per tahun", () => {
    expect(urutBerikutnya(terpakai, "k3", 2027)).toBe(1);
    expect(urutBerikutnya(terpakai, "k3", 2025)).toBe(10);
  });

  it("tidak memakai ulang nomor yang hilang di tengah", () => {
    const berlubang = [
      { kategori: "k3" as const, tahun: 2026, urut: 1 },
      { kategori: "k3" as const, tahun: 2026, urut: 5 },
    ];
    // Nomor 2-4 pernah terbit lalu ditarik; memakainya lagi akan membuat surat
    // yang sudah beredar merujuk dokumen yang salah.
    expect(urutBerikutnya(berlubang, "k3", 2026)).toBe(6);
  });
});

describe("bolehSuntingIsi", () => {
  it("mengizinkan dokumen yang masih draf atau sedang ditinjau", () => {
    expect(bolehSuntingIsi("draf")).toBe(true);
    expect(bolehSuntingIsi("ditinjau")).toBe(true);
  });

  it("menolak menyunting dokumen yang sudah disahkan atau ditarik", () => {
    expect(bolehSuntingIsi("disahkan")).toBe(false);
    expect(bolehSuntingIsi("kedaluwarsa")).toBe(false);
    expect(bolehSuntingIsi("ditarik")).toBe(false);
  });
});

describe("bolehUbahStatusDokumen", () => {
  it("mengizinkan alur normal draf sampai disahkan", () => {
    expect(bolehUbahStatusDokumen("draf", "ditinjau")).toBe(true);
    expect(bolehUbahStatusDokumen("ditinjau", "disahkan")).toBe(true);
  });

  it("mengizinkan dikembalikan ke draf saat peninjauan menemukan masalah", () => {
    expect(bolehUbahStatusDokumen("ditinjau", "draf")).toBe(true);
  });

  it("melarang melompati peninjauan", () => {
    expect(bolehUbahStatusDokumen("draf", "disahkan")).toBe(false);
  });

  it("melarang dokumen yang sudah ditarik dihidupkan kembali", () => {
    expect(bolehUbahStatusDokumen("ditarik", "draf")).toBe(false);
    expect(bolehUbahStatusDokumen("ditarik", "disahkan")).toBe(false);
  });
});

describe("bolehDisahkan", () => {
  it("menolak dokumen yang belum punya berkas sama sekali", () => {
    expect(bolehDisahkan("ditinjau", 0)).toBe("belumAdaBerkas");
  });

  it("menolak dokumen yang belum melewati peninjauan", () => {
    expect(bolehDisahkan("draf", 1)).toBe("belumDitinjau");
  });

  it("mengizinkan dokumen yang sudah ditinjau dan punya berkas", () => {
    expect(bolehDisahkan("ditinjau", 1)).toBeNull();
  });
});

describe("dokumenJatuhTempo", () => {
  const kini = new Date("2026-07-01T00:00:00Z");
  const tgl = (iso: string) => new Date(`${iso}T00:00:00Z`);

  const daftar: DokumenTinjau[] = [
    {
      id: "1",
      nomor: "A",
      judul: "Lewat",
      tanggalTinjauUlang: tgl("2026-06-01"),
      status: "disahkan",
    },
    {
      id: "2",
      nomor: "B",
      judul: "Segera",
      tanggalTinjauUlang: tgl("2026-07-15"),
      status: "disahkan",
    },
    {
      id: "3",
      nomor: "C",
      judul: "Masih lama",
      tanggalTinjauUlang: tgl("2027-01-01"),
      status: "disahkan",
    },
    {
      id: "4",
      nomor: "D",
      judul: "Draf",
      tanggalTinjauUlang: tgl("2026-06-01"),
      status: "draf",
    },
    {
      id: "5",
      nomor: "E",
      judul: "Tanpa tanggal",
      tanggalTinjauUlang: null,
      status: "disahkan",
    },
  ];

  it("mengambil yang sudah lewat dan yang jatuh tempo dalam 30 hari", () => {
    expect(dokumenJatuhTempo(daftar, kini).map((d) => d.nomor)).toEqual(["A", "B"]);
  });

  it("mengurutkan dari yang paling mendesak", () => {
    const hasil = dokumenJatuhTempo(daftar, kini);
    expect(hasil[0]?.nomor).toBe("A");
  });

  it("mengabaikan dokumen yang belum berlaku", () => {
    expect(dokumenJatuhTempo(daftar, kini).some((d) => d.nomor === "D")).toBe(false);
  });

  it("mengabaikan dokumen tanpa tanggal tinjau ulang", () => {
    expect(dokumenJatuhTempo(daftar, kini).some((d) => d.nomor === "E")).toBe(false);
  });

  it("menghormati ambang hari yang diberikan", () => {
    expect(dokumenJatuhTempo(daftar, kini, 0).map((d) => d.nomor)).toEqual(["A"]);
    expect(dokumenJatuhTempo(daftar, kini, 400).map((d) => d.nomor)).toEqual(["A", "B", "C"]);
  });
});
