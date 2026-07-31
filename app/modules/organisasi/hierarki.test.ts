import { describe, expect, it } from "vitest";

import {
  akanMembentukGelung,
  bolehMenurunkanAdmin,
  keturunanDari,
  type PenggunaRingkas,
  type Simpul,
} from "./hierarki";

// Struktur contoh: DIR -> OPS -> TEKNIK, dan DIR -> KEU
const struktur: Simpul[] = [
  { id: "DIR", indukId: null },
  { id: "OPS", indukId: "DIR" },
  { id: "TEKNIK", indukId: "OPS" },
  { id: "KEU", indukId: "DIR" },
  { id: "LEPAS", indukId: null },
];

describe("akanMembentukGelung", () => {
  it("mengizinkan induk yang tidak berkaitan", () => {
    expect(akanMembentukGelung(struktur, "LEPAS", "OPS")).toBe(false);
    expect(akanMembentukGelung(struktur, "KEU", "OPS")).toBe(false);
  });

  it("mengizinkan induk kosong", () => {
    expect(akanMembentukGelung(struktur, "OPS", null)).toBe(false);
    expect(akanMembentukGelung(struktur, "OPS", undefined)).toBe(false);
    expect(akanMembentukGelung(struktur, "OPS", "")).toBe(false);
  });

  it("menolak unit menjadi induk dirinya sendiri", () => {
    expect(akanMembentukGelung(struktur, "OPS", "OPS")).toBe(true);
  });

  it("menolak induk yang merupakan anak langsung", () => {
    expect(akanMembentukGelung(struktur, "OPS", "TEKNIK")).toBe(true);
  });

  it("menolak induk yang merupakan keturunan jauh", () => {
    expect(akanMembentukGelung(struktur, "DIR", "TEKNIK")).toBe(true);
  });

  it("tidak berputar tanpa henti bila data sudah rusak", () => {
    const rusak: Simpul[] = [
      { id: "A", indukId: "B" },
      { id: "B", indukId: "A" },
      { id: "C", indukId: null },
    ];
    expect(akanMembentukGelung(rusak, "C", "A")).toBe(false);
  });
});

describe("keturunanDari", () => {
  it("mengumpulkan seluruh keturunan sampai tingkat terdalam", () => {
    expect(keturunanDari(struktur, "DIR").sort()).toEqual(["KEU", "OPS", "TEKNIK"]);
  });

  it("mengembalikan daftar kosong untuk simpul tanpa anak", () => {
    expect(keturunanDari(struktur, "TEKNIK")).toEqual([]);
    expect(keturunanDari(struktur, "LEPAS")).toEqual([]);
  });
});

describe("bolehMenurunkanAdmin", () => {
  const pengguna: PenggunaRingkas[] = [
    { id: "a1", peran: "admin", aktif: true },
    { id: "a2", peran: "admin", aktif: true },
    { id: "s1", peran: "staf", aktif: true },
  ];

  it("mengizinkan bila masih ada administrator aktif lain", () => {
    expect(bolehMenurunkanAdmin(pengguna, "a1", "staf", true)).toBe(true);
    expect(bolehMenurunkanAdmin(pengguna, "a1", "admin", false)).toBe(true);
  });

  it("menolak menurunkan administrator aktif yang terakhir", () => {
    const satuAdmin: PenggunaRingkas[] = [
      { id: "a1", peran: "admin", aktif: true },
      { id: "a2", peran: "admin", aktif: false },
      { id: "s1", peran: "staf", aktif: true },
    ];
    expect(bolehMenurunkanAdmin(satuAdmin, "a1", "staf", true)).toBe(false);
  });

  it("menolak menonaktifkan administrator aktif yang terakhir", () => {
    const satuAdmin: PenggunaRingkas[] = [{ id: "a1", peran: "admin", aktif: true }];
    expect(bolehMenurunkanAdmin(satuAdmin, "a1", "admin", false)).toBe(false);
  });

  it("mengizinkan administrator terakhir tetap menjadi admin aktif", () => {
    const satuAdmin: PenggunaRingkas[] = [{ id: "a1", peran: "admin", aktif: true }];
    expect(bolehMenurunkanAdmin(satuAdmin, "a1", "admin", true)).toBe(true);
  });

  it("mengizinkan bila pengguna tidak ditemukan", () => {
    expect(bolehMenurunkanAdmin(pengguna, "entah", "staf", true)).toBe(true);
  });
});
