import { describe, expect, it } from "vitest";

import { skemaDokumenBaru, skemaDokumenUbah } from "./validasi";

/**
 * Skema diuji memakai persis kumpulan kolom yang dikirim formulir. Pernah
 * terjadi skema mensyaratkan kolom yang tidak ada di formulir, akibatnya seluruh
 * penyimpanan gagal diam-diam dengan pesan validasi. Test ini yang menjaganya.
 */
describe("skemaDokumenBaru", () => {
  const isianFormulirTambah = {
    judul: "SOP Penerimaan Tenant",
    judulEn: "",
    kategori: "sop-pelayanan",
    unitKerjaId: "",
    tanggalTinjauUlang: "",
    ringkasan: "",
  };

  it("menerima isian formulir tambah apa adanya", () => {
    const hasil = skemaDokumenBaru.safeParse(isianFormulirTambah);
    expect(hasil.success).toBe(true);
  });

  it("mengubah kolom opsional yang kosong menjadi tidak terisi", () => {
    const hasil = skemaDokumenBaru.parse(isianFormulirTambah);
    expect(hasil.judulEn).toBeUndefined();
    expect(hasil.unitKerjaId).toBeUndefined();
    expect(hasil.tanggalTinjauUlang).toBeNull();
  });

  it("menolak judul yang terlalu pendek dan kategori di luar daftar", () => {
    expect(skemaDokumenBaru.safeParse({ ...isianFormulirTambah, judul: "ab" }).success).toBe(
      false,
    );
    expect(
      skemaDokumenBaru.safeParse({ ...isianFormulirTambah, kategori: "entah" }).success,
    ).toBe(false);
  });

  it("tidak mengenal kolom nomor sehingga tidak bisa diketik manual", () => {
    const hasil = skemaDokumenBaru.parse({ ...isianFormulirTambah, nomor: "TK/001/2026" });
    expect(hasil).not.toHaveProperty("nomor");
  });
});

describe("skemaDokumenUbah", () => {
  const isianFormulirUbah = {
    judul: "SOP Penerimaan Tenant",
    judulEn: "Tenant Onboarding SOP",
    unitKerjaId: "unit-ops",
    status: "ditinjau",
    tanggalTerbit: "",
    tanggalTinjauUlang: "2027-01-31",
    ringkasan: "Ringkasan singkat",
  };

  it("menerima isian formulir ubah tanpa kolom kategori", () => {
    const hasil = skemaDokumenUbah.safeParse(isianFormulirUbah);
    expect(hasil.success).toBe(true);
  });

  it("tidak menerima perubahan kategori karena nomor sudah memuatnya", () => {
    const hasil = skemaDokumenUbah.parse({ ...isianFormulirUbah, kategori: "k3" });
    expect(hasil).not.toHaveProperty("kategori");
  });

  it("membaca tanggal dan menolak status di luar daftar", () => {
    const hasil = skemaDokumenUbah.parse(isianFormulirUbah);
    expect(hasil.tanggalTerbit).toBeNull();
    expect(hasil.tanggalTinjauUlang?.toISOString().slice(0, 10)).toBe("2027-01-31");
    expect(skemaDokumenUbah.safeParse({ ...isianFormulirUbah, status: "beku" }).success).toBe(
      false,
    );
  });
});
