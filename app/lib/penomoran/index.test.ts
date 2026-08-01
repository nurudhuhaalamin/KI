import { describe, expect, it } from "vitest";

import { POLA_BAWAAN, susunNomor, urutBerikutnya } from "./index";

describe("susunNomor", () => {
  it("mengisi seluruh placeholder pola bawaan", () => {
    expect(susunNomor(POLA_BAWAAN, { seri: "IK", kodeUnit: "OPS", urut: 7, tahun: 2026 })).toBe(
      "IK/OPS/007/2026",
    );
  });

  it("mengenali {kategori} sebagai nama lain dari {seri}", () => {
    // Pola lama milik modul dokumen harus tetap menghasilkan bentuk yang sama.
    expect(
      susunNomor("{kategori}/{unit}/{urut}/{tahun}", {
        seri: "SOP-PLY",
        kodeUnit: "OPS",
        urut: 2,
        tahun: 2026,
      }),
    ).toBe("SOP-PLY/OPS/002/2026");
  });

  it("membuat nomor urut tiga digit sehingga urutan teks sama dengan urutan angka", () => {
    const nomor = [1, 2, 10, 100].map((urut) =>
      susunNomor(POLA_BAWAAN, { seri: "IB", kodeUnit: "LK3", urut, tahun: 2026 }),
    );
    expect(nomor).toEqual([
      "IB/LK3/001/2026",
      "IB/LK3/002/2026",
      "IB/LK3/010/2026",
      "IB/LK3/100/2026",
    ]);
    expect([...nomor].sort()).toEqual(nomor);
  });

  it("membuang placeholder unit yang kosong beserta pemisahnya", () => {
    expect(susunNomor(POLA_BAWAAN, { seri: "IK", urut: 3, tahun: 2026 })).toBe("IK/003/2026");
    expect(susunNomor(POLA_BAWAAN, { seri: "IK", kodeUnit: "   ", urut: 3, tahun: 2026 })).toBe(
      "IK/003/2026",
    );
  });

  it("mengisi placeholder tambahan milik modul pemakainya", () => {
    expect(
      susunNomor("{seri}/{jenis}/{urut}/{tahun}", {
        seri: "IZIN",
        urut: 4,
        tahun: 2026,
        tambahan: { jenis: "ALAT-BERAT" },
      }),
    ).toBe("IZIN/ALAT-BERAT/004/2026");
  });

  it("membiarkan placeholder yang tidak dikenal apa adanya", () => {
    // Salah ketik pada pengaturan kawasan harus terlihat, bukan hilang diam-diam.
    expect(susunNomor("{seri}/{entah}/{urut}", { seri: "IK", urut: 1, tahun: 2026 })).toBe(
      "IK/{entah}/001",
    );
  });

  it("tidak membiarkan nilai tambahan menimpa bagian yang baku", () => {
    expect(
      susunNomor(POLA_BAWAAN, {
        seri: "IK",
        urut: 5,
        tahun: 2026,
        tambahan: { urut: "999", tahun: "1900" },
      }),
    ).toBe("IK/005/2026");
  });
});

describe("urutBerikutnya", () => {
  it("mulai dari satu bila seri itu belum pernah dipakai", () => {
    expect(urutBerikutnya([], "IK", 2026)).toBe(1);
    expect(urutBerikutnya([{ seri: "IB", tahun: 2026, urut: 9 }], "IK", 2026)).toBe(1);
  });

  it("memisahkan hitungan antar seri dan antar tahun", () => {
    const terpakai = [
      { seri: "IK", tahun: 2026, urut: 1 },
      { seri: "IK", tahun: 2026, urut: 2 },
      { seri: "IB", tahun: 2026, urut: 5 },
      { seri: "IK", tahun: 2025, urut: 40 },
    ];
    expect(urutBerikutnya(terpakai, "IK", 2026)).toBe(3);
    expect(urutBerikutnya(terpakai, "IB", 2026)).toBe(6);
    // Tahun baru selalu mulai dari satu lagi.
    expect(urutBerikutnya(terpakai, "IK", 2027)).toBe(1);
  });

  it("tidak memakai ulang nomor yang hilang di tengah", () => {
    // Nomor 2 ditarik. Memakainya ulang akan membuat surat yang sudah beredar
    // merujuk ke permohonan yang salah.
    const terpakai = [
      { seri: "IK", tahun: 2026, urut: 1 },
      { seri: "IK", tahun: 2026, urut: 3 },
    ];
    expect(urutBerikutnya(terpakai, "IK", 2026)).toBe(4);
  });
});
