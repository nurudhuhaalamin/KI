import { describe, expect, it } from "vitest";

import {
  bolehDiajukan,
  bolehDibatalkan,
  bolehMemutus,
  bolehSuntingPermohonan,
  kemajuan,
  periksaKeputusan,
  terapkanKeputusan,
  type Tahap,
} from "./alur";

const tahapStaf: Tahap = {
  id: "t1",
  urutan: 1,
  nama: "Pemeriksaan teknis",
  peranPemutus: "staf",
  unitKerjaId: null,
};
const tahapManajemen: Tahap = {
  id: "t2",
  urutan: 2,
  nama: "Persetujuan manajemen",
  peranPemutus: "manajemen",
  unitKerjaId: null,
};
const DUA_TAHAP = [tahapStaf, tahapManajemen];

describe("bolehSuntingPermohonan", () => {
  it("mengizinkan draf dan permohonan yang diminta revisi", () => {
    expect(bolehSuntingPermohonan("draf")).toBe(true);
    expect(bolehSuntingPermohonan("perlu-revisi")).toBe(true);
  });

  it("mengunci permohonan yang sudah di meja pengelola atau sudah selesai", () => {
    for (const status of ["diajukan", "diproses", "terbit", "ditolak", "batal"] as const) {
      expect(bolehSuntingPermohonan(status)).toBe(false);
    }
  });
});

describe("bolehDiajukan dan bolehDibatalkan", () => {
  it("hanya mengizinkan pengajuan dari draf atau setelah revisi", () => {
    expect(bolehDiajukan("draf")).toBe(true);
    expect(bolehDiajukan("perlu-revisi")).toBe(true);
    expect(bolehDiajukan("diproses")).toBe(false);
    expect(bolehDiajukan("terbit")).toBe(false);
  });

  it("tidak mengizinkan pembatalan setelah diputus final", () => {
    expect(bolehDibatalkan("diajukan")).toBe(true);
    expect(bolehDibatalkan("terbit")).toBe(false);
    expect(bolehDibatalkan("ditolak")).toBe(false);
  });
});

describe("bolehMemutus", () => {
  it("mengizinkan peran yang persis diminta tahap", () => {
    expect(bolehMemutus({ peran: "staf" }, tahapStaf)).toBe(true);
    expect(bolehMemutus({ peran: "manajemen" }, tahapManajemen)).toBe(true);
  });

  it("tidak menganggap manajemen otomatis boleh memutus tahap staf", () => {
    // Tahap staf berisi pemeriksaan teknis, memang bukan wewenang manajemen.
    expect(bolehMemutus({ peran: "manajemen" }, tahapStaf)).toBe(false);
    expect(bolehMemutus({ peran: "staf" }, tahapManajemen)).toBe(false);
  });

  it("menolak tenant sepenuhnya", () => {
    expect(bolehMemutus({ peran: "tenant" }, tahapStaf)).toBe(false);
  });

  it("mengizinkan administrator memutus tahap apa pun", () => {
    // Tanpa ini permohonan bisa macet permanen saat pemegang perannya tidak ada.
    expect(bolehMemutus({ peran: "admin" }, tahapStaf)).toBe(true);
    expect(bolehMemutus({ peran: "admin" }, tahapManajemen)).toBe(true);
  });

  it("menghormati batasan unit kerja pada tahap", () => {
    const tahapUnit: Tahap = { ...tahapStaf, unitKerjaId: "unit-lk3" };
    expect(bolehMemutus({ peran: "staf", unitKerjaId: "unit-lk3" }, tahapUnit)).toBe(true);
    expect(bolehMemutus({ peran: "staf", unitKerjaId: "unit-ops" }, tahapUnit)).toBe(false);
    expect(bolehMemutus({ peran: "staf", unitKerjaId: null }, tahapUnit)).toBe(false);
  });
});

describe("terapkanKeputusan", () => {
  it("meneruskan ke tahap berikutnya saat disetujui", () => {
    expect(terapkanKeputusan("setuju", 1, 2)).toEqual({
      status: "diproses",
      tahapAktif: 2,
      selesai: false,
    });
  });

  it("menerbitkan izin setelah tahap terakhir disetujui", () => {
    expect(terapkanKeputusan("setuju", 2, 2)).toEqual({
      status: "terbit",
      tahapAktif: 2,
      selesai: true,
    });
    // Alur satu tahap langsung terbit.
    expect(terapkanKeputusan("setuju", 1, 1).status).toBe("terbit");
  });

  it("menghentikan seluruhnya saat ditolak, tidak melanjutkan ke tahap berikutnya", () => {
    expect(terapkanKeputusan("tolak", 1, 3)).toEqual({
      status: "ditolak",
      tahapAktif: 1,
      selesai: true,
    });
  });

  it("mengembalikan ke pemohon dan mengulang dari awal saat diminta revisi", () => {
    // Isinya berubah, jadi pemeriksa tahap satu harus menilai ulang.
    expect(terapkanKeputusan("revisi", 2, 3)).toEqual({
      status: "perlu-revisi",
      tahapAktif: 0,
      selesai: false,
    });
  });
});

describe("periksaKeputusan", () => {
  it("mengizinkan pemutus yang tepat pada tahap yang sedang berjalan", () => {
    const hasil = periksaKeputusan("diajukan", 1, DUA_TAHAP, { peran: "staf" });
    expect(hasil).toEqual({ boleh: true, tahap: tahapStaf });
  });

  it("menolak keputusan pada permohonan yang belum diajukan atau sudah selesai", () => {
    expect(periksaKeputusan("draf", 1, DUA_TAHAP, { peran: "staf" })).toEqual({
      boleh: false,
      galat: "statusTidakBoleh",
    });
    expect(periksaKeputusan("terbit", 2, DUA_TAHAP, { peran: "admin" })).toEqual({
      boleh: false,
      galat: "statusTidakBoleh",
    });
  });

  it("menolak pemutus yang bukan wewenangnya", () => {
    expect(periksaKeputusan("diproses", 2, DUA_TAHAP, { peran: "staf" })).toEqual({
      boleh: false,
      galat: "bukanWewenang",
    });
  });

  it("menolak jenis izin yang belum punya tahap sama sekali", () => {
    expect(periksaKeputusan("diajukan", 1, [], { peran: "admin" })).toEqual({
      boleh: false,
      galat: "tanpaTahap",
    });
  });

  it("menolak bila tahap aktifnya tidak ada di daftar", () => {
    // Terjadi bila tahap dihapus setelah permohonan berjalan.
    expect(periksaKeputusan("diproses", 9, DUA_TAHAP, { peran: "admin" })).toEqual({
      boleh: false,
      galat: "tahapTidakDitemukan",
    });
  });
});

describe("kemajuan", () => {
  it("menandai tahap yang lewat, berjalan, dan menunggu", () => {
    expect(kemajuan(DUA_TAHAP, 2, "diproses").map((t) => t.keadaan)).toEqual([
      "selesai",
      "berjalan",
    ]);
  });

  it("menandai seluruh tahap selesai setelah izin terbit", () => {
    expect(kemajuan(DUA_TAHAP, 2, "terbit").map((t) => t.keadaan)).toEqual([
      "selesai",
      "selesai",
    ]);
  });

  it("tidak menandai tahap mana pun berjalan saat menunggu revisi pemohon", () => {
    expect(kemajuan(DUA_TAHAP, 0, "perlu-revisi").map((t) => t.keadaan)).toEqual([
      "menunggu",
      "menunggu",
    ]);
  });

  it("mengurutkan tahap meski datanya tidak urut", () => {
    expect(kemajuan([tahapManajemen, tahapStaf], 1, "diajukan").map((t) => t.urutan)).toEqual([
      1, 2,
    ]);
  });
});
