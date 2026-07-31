import { describe, expect, it } from "vitest";

import {
  adaTumpangTindih,
  bolehUbahStatus,
  hitungStatusKavling,
  periksaTanggal,
  type MasaKontrak,
} from "./aturan";

const tgl = (iso: string) => new Date(`${iso}T00:00:00Z`);

function kontrak(sebagian: Partial<MasaKontrak> & { id: string }): MasaKontrak {
  return {
    jenis: "sewa",
    status: "aktif",
    tanggalMulai: tgl("2026-01-01"),
    tanggalBerakhir: tgl("2026-12-31"),
    ...sebagian,
  };
}

describe("adaTumpangTindih", () => {
  const sewa2026 = kontrak({ id: "k1" });

  it("menolak rentang yang beririsan", () => {
    expect(
      adaTumpangTindih([sewa2026], {
        tanggalMulai: tgl("2026-06-01"),
        tanggalBerakhir: tgl("2027-05-31"),
      }),
    ).toBe(true);
  });

  it("mengizinkan rentang yang benar-benar terpisah", () => {
    expect(
      adaTumpangTindih([sewa2026], {
        tanggalMulai: tgl("2027-01-01"),
        tanggalBerakhir: tgl("2027-12-31"),
      }),
    ).toBe(false);
  });

  it("mengabaikan kontrak yang sudah berakhir atau dibatalkan", () => {
    const selesai = [
      kontrak({ id: "k1", status: "berakhir" }),
      kontrak({ id: "k2", status: "batal" }),
    ];
    expect(
      adaTumpangTindih(selesai, {
        tanggalMulai: tgl("2026-06-01"),
        tanggalBerakhir: tgl("2026-08-01"),
      }),
    ).toBe(false);
  });

  it("memperhitungkan kontrak berstatus draf", () => {
    const draf = [kontrak({ id: "k1", status: "draf" })];
    expect(
      adaTumpangTindih(draf, {
        tanggalMulai: tgl("2026-06-01"),
        tanggalBerakhir: tgl("2026-08-01"),
      }),
    ).toBe(true);
  });

  it("memperlakukan kontrak jual sebagai pengikat tanpa batas waktu", () => {
    const jual = [kontrak({ id: "k1", jenis: "jual", tanggalBerakhir: null })];
    expect(
      adaTumpangTindih(jual, {
        tanggalMulai: tgl("2099-01-01"),
        tanggalBerakhir: tgl("2099-12-31"),
      }),
    ).toBe(true);
  });

  it("mengecualikan kontrak yang sedang disunting", () => {
    expect(
      adaTumpangTindih(
        [sewa2026],
        { tanggalMulai: tgl("2026-03-01"), tanggalBerakhir: tgl("2026-09-01") },
        "k1",
      ),
    ).toBe(false);
  });

  it("menganggap rentang yang bersentuhan di ujung sebagai tumpang tindih", () => {
    expect(
      adaTumpangTindih([sewa2026], {
        tanggalMulai: tgl("2026-12-31"),
        tanggalBerakhir: tgl("2027-06-30"),
      }),
    ).toBe(true);
  });
});

describe("hitungStatusKavling", () => {
  const kini = tgl("2026-06-01");

  it("tersedia bila tidak ada kontrak", () => {
    expect(hitungStatusKavling([], kini)).toBe("tersedia");
  });

  it("disewa bila ada sewa aktif yang sedang berjalan", () => {
    expect(hitungStatusKavling([kontrak({ id: "k1" })], kini)).toBe("disewa");
  });

  it("terjual bila ada kontrak jual aktif", () => {
    const jual = kontrak({ id: "k1", jenis: "jual", tanggalBerakhir: null });
    expect(hitungStatusKavling([jual], kini)).toBe("terjual");
  });

  it("jual mengalahkan sewa bila keduanya aktif", () => {
    const daftar = [
      kontrak({ id: "k1" }),
      kontrak({ id: "k2", jenis: "jual", tanggalBerakhir: null }),
    ];
    expect(hitungStatusKavling(daftar, kini)).toBe("terjual");
  });

  it("dipesan bila hanya ada kontrak draf", () => {
    expect(hitungStatusKavling([kontrak({ id: "k1", status: "draf" })], kini)).toBe("dipesan");
  });

  it("kembali tersedia setelah masa sewa lewat", () => {
    const lampau = kontrak({
      id: "k1",
      tanggalMulai: tgl("2025-01-01"),
      tanggalBerakhir: tgl("2025-12-31"),
    });
    expect(hitungStatusKavling([lampau], kini)).toBe("tersedia");
  });

  it("belum disewa bila masa kontrak belum dimulai", () => {
    const nanti = kontrak({
      id: "k1",
      tanggalMulai: tgl("2027-01-01"),
      tanggalBerakhir: tgl("2027-12-31"),
    });
    expect(hitungStatusKavling([nanti], kini)).toBe("tersedia");
  });
});

describe("periksaTanggal", () => {
  it("mewajibkan tanggal berakhir untuk sewa", () => {
    expect(periksaTanggal("sewa", tgl("2026-01-01"), null)).toBe("tanggalBerakhirWajib");
  });

  it("mengizinkan jual tanpa tanggal berakhir", () => {
    expect(periksaTanggal("jual", tgl("2026-01-01"), null)).toBeNull();
  });

  it("menolak tanggal berakhir sebelum atau sama dengan tanggal mulai", () => {
    expect(periksaTanggal("sewa", tgl("2026-06-01"), tgl("2026-01-01"))).toBe(
      "tanggalTerbalik",
    );
    expect(periksaTanggal("sewa", tgl("2026-06-01"), tgl("2026-06-01"))).toBe(
      "tanggalTerbalik",
    );
  });

  it("menerima rentang yang wajar", () => {
    expect(periksaTanggal("sewa", tgl("2026-01-01"), tgl("2026-12-31"))).toBeNull();
  });
});

describe("bolehUbahStatus", () => {
  it("mengizinkan draf menjadi aktif atau batal", () => {
    expect(bolehUbahStatus("draf", "aktif")).toBe(true);
    expect(bolehUbahStatus("draf", "batal")).toBe(true);
  });

  it("mengizinkan aktif menjadi berakhir atau batal", () => {
    expect(bolehUbahStatus("aktif", "berakhir")).toBe(true);
    expect(bolehUbahStatus("aktif", "batal")).toBe(true);
  });

  it("menolak kontrak aktif dikembalikan menjadi draf", () => {
    expect(bolehUbahStatus("aktif", "draf")).toBe(false);
  });

  it("menolak kontrak yang sudah berakhir atau batal dihidupkan kembali", () => {
    expect(bolehUbahStatus("berakhir", "aktif")).toBe(false);
    expect(bolehUbahStatus("batal", "aktif")).toBe(false);
    expect(bolehUbahStatus("batal", "draf")).toBe(false);
  });
});
