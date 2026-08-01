import { describe, expect, it } from "vitest";

import {
  HARI_TENGGANG,
  jadwalPemantauan,
  keadaanLaporan,
  laporanTertunggak,
  periodeBelumTercatat,
  type LaporanRingkas,
} from "./pemantauan";

const tgl = (teks: string) => new Date(`${teks}T00:00:00Z`);

describe("jadwalPemantauan", () => {
  it("membuat satu periode per bulan untuk kewajiban bulanan", () => {
    const jadwal = jadwalPemantauan("bulanan", tgl("2026-01-15"), tgl("2026-03-20"));
    expect(jadwal.map((p) => p.periode)).toEqual(["2026-01", "2026-02", "2026-03"]);
  });

  it("memberi label triwulan dan semester yang bisa diurutkan sebagai teks", () => {
    const triwulan = jadwalPemantauan("triwulanan", tgl("2026-01-01"), tgl("2026-12-31"));
    expect(triwulan.map((p) => p.periode)).toEqual([
      "2026-TW1",
      "2026-TW2",
      "2026-TW3",
      "2026-TW4",
    ]);

    const semester = jadwalPemantauan("semesteran", tgl("2026-01-01"), tgl("2026-12-31"));
    expect(semester.map((p) => p.periode)).toEqual(["2026-S1", "2026-S2"]);
  });

  it("memakai tahun saja sebagai label kewajiban tahunan", () => {
    const jadwal = jadwalPemantauan("tahunan", tgl("2026-01-01"), tgl("2028-06-01"));
    expect(jadwal.map((p) => p.periode)).toEqual(["2026", "2027", "2028"]);
  });

  it("melintasi pergantian tahun tanpa mengulang label", () => {
    const jadwal = jadwalPemantauan("triwulanan", tgl("2026-10-01"), tgl("2027-04-01"));
    expect(jadwal.map((p) => p.periode)).toEqual(["2026-TW4", "2027-TW1", "2027-TW2"]);
  });

  it("menutup periode tepat sebelum periode berikutnya dimulai", () => {
    const [pertama] = jadwalPemantauan("semesteran", tgl("2026-01-01"), tgl("2026-01-31"));
    expect(pertama?.mulai).toEqual(tgl("2026-01-01"));
    expect(pertama?.akhir).toEqual(tgl("2026-06-30"));
  });

  it("memberi tenggang pelaporan setelah periode berakhir", () => {
    // Laporan tidak mungkin dikirim pada hari terakhir periode yang dilaporkannya.
    const [pertama] = jadwalPemantauan("bulanan", tgl("2026-01-01"), tgl("2026-01-31"));
    expect(pertama?.akhir).toEqual(tgl("2026-01-31"));
    expect(pertama?.jatuhTempo).toEqual(
      new Date(tgl("2026-01-31").getTime() + HARI_TENGGANG * 24 * 60 * 60 * 1000),
    );
  });

  it("memuat periode yang sedang berjalan, bukan hanya yang sudah lewat", () => {
    const jadwal = jadwalPemantauan("bulanan", tgl("2026-08-01"), tgl("2026-08-15"));
    expect(jadwal).toHaveLength(1);
    expect(jadwal[0]?.periode).toBe("2026-08");
  });

  it("kosong bila tanggal mulainya masih di depan", () => {
    expect(jadwalPemantauan("bulanan", tgl("2027-01-01"), tgl("2026-08-01"))).toEqual([]);
  });

  it("tidak menghasilkan daftar tak berujung untuk tanggal mulai yang salah ketik", () => {
    const jadwal = jadwalPemantauan("bulanan", tgl("1900-01-01"), tgl("2026-08-01"));
    expect(jadwal.length).toBeLessThanOrEqual(200);
  });
});

describe("keadaanLaporan", () => {
  const dasar = { id: "l1", periode: "2026-S1", jatuhTempo: tgl("2026-08-10") };

  it("menandai selesai untuk yang sudah dikirim maupun diterima", () => {
    expect(keadaanLaporan({ ...dasar, status: "terkirim" }, tgl("2026-09-01"))).toBe("selesai");
    expect(keadaanLaporan({ ...dasar, status: "diterima" }, tgl("2026-09-01"))).toBe("selesai");
  });

  it("menandai terlambat, mendekati, dan aman untuk yang belum dikirim", () => {
    expect(keadaanLaporan({ ...dasar, status: "belum" }, tgl("2026-08-11"))).toBe("terlambat");
    expect(keadaanLaporan({ ...dasar, status: "belum" }, tgl("2026-08-05"))).toBe("mendekati");
    expect(keadaanLaporan({ ...dasar, status: "belum" }, tgl("2026-07-01"))).toBe("aman");
  });

  it("menganggap laporan yang ditolak masih menjadi tunggakan", () => {
    // Ditolak berarti belum ada laporan yang sah untuk periode itu.
    expect(keadaanLaporan({ ...dasar, status: "ditolak" }, tgl("2026-08-11"))).toBe(
      "terlambat",
    );
  });
});

describe("laporanTertunggak", () => {
  const daftar: LaporanRingkas[] = [
    { id: "a", periode: "2026-S1", jatuhTempo: tgl("2026-08-01"), status: "belum" },
    { id: "b", periode: "2026-TW1", jatuhTempo: tgl("2026-07-01"), status: "belum" },
    { id: "c", periode: "2026-TW2", jatuhTempo: tgl("2026-07-15"), status: "terkirim" },
    { id: "d", periode: "2027-S1", jatuhTempo: tgl("2027-08-01"), status: "belum" },
  ];

  it("memuat yang lewat tempo dan yang hampir, terurut paling mendesak di atas", () => {
    const hasil = laporanTertunggak(daftar, tgl("2026-08-05"));
    expect(hasil.map((l) => l.id)).toEqual(["b", "a"]);
  });

  it("tidak menagih laporan yang sudah dikirim", () => {
    const hasil = laporanTertunggak(daftar, tgl("2026-12-31"));
    expect(hasil.map((l) => l.id)).not.toContain("c");
  });

  it("tidak menagih periode yang masih jauh", () => {
    const hasil = laporanTertunggak(daftar, tgl("2026-08-05"));
    expect(hasil.map((l) => l.id)).not.toContain("d");
  });
});

describe("periodeBelumTercatat", () => {
  it("hanya menghasilkan periode yang belum punya baris", () => {
    const jadwal = jadwalPemantauan("triwulanan", tgl("2026-01-01"), tgl("2026-12-31"));
    const hasil = periodeBelumTercatat(jadwal, ["2026-TW1", "2026-TW3"]);
    expect(hasil.map((p) => p.periode)).toEqual(["2026-TW2", "2026-TW4"]);
  });

  it("kosong bila seluruh periode sudah tercatat", () => {
    const jadwal = jadwalPemantauan("semesteran", tgl("2026-01-01"), tgl("2026-12-31"));
    expect(periodeBelumTercatat(jadwal, ["2026-S1", "2026-S2"])).toEqual([]);
  });
});
