import { describe, expect, it } from "vitest";

import { bacaHariLibur, hariKerja, hitungTenggat, sisaHariKerja, statusSla } from "./index";

/** Pembantu baca: 2026-08-03 adalah hari Senin. */
const tgl = (teks: string) => new Date(`${teks}T00:00:00Z`);
const SENIN = "2026-08-03";
const JUMAT = "2026-08-07";
const SABTU = "2026-08-08";

describe("hariKerja", () => {
  it("menolak Sabtu dan Minggu", () => {
    expect(hariKerja(tgl(JUMAT))).toBe(true);
    expect(hariKerja(tgl(SABTU))).toBe(false);
    expect(hariKerja(tgl("2026-08-09"))).toBe(false);
  });

  it("menolak tanggal yang terdaftar sebagai hari libur", () => {
    expect(hariKerja(tgl("2026-08-17"))).toBe(true);
    expect(hariKerja(tgl("2026-08-17"), ["2026-08-17"])).toBe(false);
  });
});

describe("hitungTenggat", () => {
  it("tidak menghitung hari pengajuan itu sendiri", () => {
    // Masuk Senin, janji 3 hari kerja -> Kamis.
    expect(hitungTenggat(tgl(SENIN), 3)).toEqual(tgl("2026-08-06"));
  });

  it("melompati akhir pekan", () => {
    // Masuk Jumat, janji 1 hari kerja -> Senin berikutnya, bukan Sabtu.
    expect(hitungTenggat(tgl(JUMAT), 1)).toEqual(tgl("2026-08-10"));
    // Masuk Kamis, janji 3 hari kerja -> Selasa.
    expect(hitungTenggat(tgl("2026-08-06"), 3)).toEqual(tgl("2026-08-11"));
  });

  it("melompati hari libur nasional", () => {
    // 17 Agustus 2026 jatuh Senin. Masuk Jumat 14, janji 1 hari kerja -> Selasa 18.
    expect(hitungTenggat(tgl("2026-08-14"), 1, ["2026-08-17"])).toEqual(tgl("2026-08-18"));
  });

  it("mengabaikan jam pengajuan", () => {
    const pagi = new Date("2026-08-03T01:00:00Z");
    const sore = new Date("2026-08-03T16:45:00Z");
    expect(hitungTenggat(pagi, 2)).toEqual(hitungTenggat(sore, 2));
  });

  it("memberi minimal satu hari kerja saat SLA nol atau negatif", () => {
    // "Selesai hari itu juga" tetap harus punya tenggat yang bisa dinilai.
    expect(hitungTenggat(tgl(SENIN), 0)).toEqual(tgl("2026-08-04"));
    expect(hitungTenggat(tgl(SENIN), -3)).toEqual(tgl("2026-08-04"));
  });

  it("menempuh rentang panjang tanpa terjebak akhir pekan", () => {
    // 20 hari kerja dari Senin = empat minggu penuh.
    expect(hitungTenggat(tgl(SENIN), 20)).toEqual(tgl("2026-08-31"));
  });
});

describe("sisaHariKerja", () => {
  it("menghitung maju dalam hari kerja saja", () => {
    expect(sisaHariKerja(tgl("2026-08-06"), tgl(SENIN))).toBe(3);
    // Jumat -> Senin hanya satu hari kerja meski selisih kalendernya tiga.
    expect(sisaHariKerja(tgl("2026-08-10"), tgl(JUMAT))).toBe(1);
  });

  it("bernilai nol pada hari tenggatnya sendiri", () => {
    expect(sisaHariKerja(tgl(JUMAT), tgl(JUMAT))).toBe(0);
  });

  it("bernilai negatif bila sudah terlewat", () => {
    expect(sisaHariKerja(tgl(SENIN), tgl("2026-08-06"))).toBe(-3);
  });
});

describe("statusSla", () => {
  it("menandai terlambat, mendekati, dan aman", () => {
    expect(statusSla(tgl(SENIN), tgl("2026-08-05"))).toBe("terlambat");
    expect(statusSla(tgl("2026-08-05"), tgl("2026-08-04"))).toBe("mendekati");
    expect(statusSla(tgl("2026-08-05"), tgl("2026-08-05"))).toBe("mendekati");
    expect(statusSla(tgl("2026-08-31"), tgl(SENIN))).toBe("aman");
  });

  it("menganggap aman bila tenggatnya belum ada", () => {
    // Permohonan yang masih draf memang belum punya tenggat.
    expect(statusSla(null, tgl(SENIN))).toBe("aman");
  });
});

describe("bacaHariLibur", () => {
  it("menerima pemisah koma, spasi, dan baris baru", () => {
    expect(bacaHariLibur("2026-08-17, 2026-12-25\n2026-01-01")).toEqual([
      "2026-08-17",
      "2026-12-25",
      "2026-01-01",
    ]);
  });

  it("mengabaikan isian yang bukan tanggal tanpa menggagalkan sisanya", () => {
    expect(bacaHariLibur("2026-08-17, entah, 17-08-2026")).toEqual(["2026-08-17"]);
    expect(bacaHariLibur("")).toEqual([]);
    expect(bacaHariLibur(null)).toEqual([]);
  });
});
