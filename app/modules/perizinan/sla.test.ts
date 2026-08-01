import { describe, expect, it } from "vitest";

import { permohonanMendesak, type PermohonanTenggat } from "./sla";

/** Pembantu baca: 2026-08-03 adalah hari Senin. */
const tgl = (teks: string) => new Date(`${teks}T00:00:00Z`);
const SENIN = "2026-08-03";

describe("permohonanMendesak", () => {
  const daftar: PermohonanTenggat[] = [
    {
      id: "a",
      nomor: "IK/001/2026",
      judul: "Izin kerja",
      tenggat: tgl("2026-08-04"),
      status: "diajukan",
    },
    {
      id: "b",
      nomor: "IB/001/2026",
      judul: "Izin bangun",
      tenggat: tgl(SENIN),
      status: "diproses",
    },
    {
      id: "c",
      nomor: "IK/002/2026",
      judul: "Sudah terbit",
      tenggat: tgl(SENIN),
      status: "terbit",
    },
    {
      id: "d",
      nomor: "IK/003/2026",
      judul: "Masih longgar",
      tenggat: tgl("2026-08-31"),
      status: "diajukan",
    },
    { id: "e", nomor: "IK/004/2026", judul: "Belum diajukan", tenggat: null, status: "draf" },
  ];

  it("hanya memuat yang masih berjalan dan tenggatnya mendesak", () => {
    const hasil = permohonanMendesak(daftar, tgl("2026-08-04"));
    expect(hasil.map((p) => p.id)).toEqual(["b", "a"]);
  });

  it("tidak mengingatkan permohonan yang sudah selesai", () => {
    const hasil = permohonanMendesak(daftar, tgl("2026-08-31"));
    expect(hasil.some((p) => p.status === "terbit")).toBe(false);
  });

  it("mengurutkan yang paling mendesak di atas", () => {
    const hasil = permohonanMendesak(daftar, tgl("2026-08-31"));
    const waktu = hasil.map((p) => p.tenggat!.getTime());
    expect([...waktu].sort((x, y) => x - y)).toEqual(waktu);
  });
});
