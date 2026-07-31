import { describe, expect, it } from "vitest";

import { UKURAN_MAKSIMUM, buatKunci, periksaBerkas, rapikanNamaTampilan } from "./r2";

function berkasPalsu(nama: string, tipe: string, ukuran: number): File {
  const isi = new Uint8Array(ukuran);
  return new File([isi], nama, { type: tipe });
}

describe("periksaBerkas", () => {
  it("menerima PDF, JPG, dan PNG dalam batas ukuran", () => {
    expect(periksaBerkas(berkasPalsu("kontrak.pdf", "application/pdf", 1024))).toBeNull();
    expect(periksaBerkas(berkasPalsu("foto.jpg", "image/jpeg", 1024))).toBeNull();
    expect(periksaBerkas(berkasPalsu("denah.png", "image/png", 1024))).toBeNull();
  });

  it("menolak tipe di luar daftar izin", () => {
    expect(periksaBerkas(berkasPalsu("virus.exe", "application/x-msdownload", 10))).toBe(
      "tipeTidakDiizinkan",
    );
    expect(periksaBerkas(berkasPalsu("makro.docx", "application/msword", 10))).toBe(
      "tipeTidakDiizinkan",
    );
  });

  it("menolak berkas kosong", () => {
    expect(periksaBerkas(berkasPalsu("kosong.pdf", "application/pdf", 0))).toBe("kosong");
  });

  it("menolak berkas melebihi 10 MB", () => {
    expect(
      periksaBerkas(berkasPalsu("besar.pdf", "application/pdf", UKURAN_MAKSIMUM + 1)),
    ).toBe("terlaluBesar");
  });
});

describe("buatKunci", () => {
  it("membuang nama asli dan memakai ekstensi dari tipe MIME", () => {
    const kunci = buatKunci("kontrak", "abc123", "application/pdf");
    expect(kunci).toMatch(/^kontrak\/abc123\/[0-9a-f-]{36}\.pdf$/);
  });

  it("tidak dapat ditembus penelusuran folder lewat awalan atau id", () => {
    const kunci = buatKunci("../../etc", "../rahasia", "image/png");
    expect(kunci).not.toContain("..");
    expect(kunci).not.toContain("//");
    expect(kunci.split("/")).toHaveLength(3);
  });

  it("menolak tipe yang tidak diizinkan", () => {
    expect(() => buatKunci("kontrak", "abc", "application/x-msdownload")).toThrow();
  });

  it("menghasilkan kunci berbeda untuk unggahan berulang", () => {
    const a = buatKunci("kontrak", "abc", "application/pdf");
    const b = buatKunci("kontrak", "abc", "application/pdf");
    expect(a).not.toBe(b);
  });
});

describe("rapikanNamaTampilan", () => {
  it("membuang tanda kutip dan baris baru yang bisa menyuntikkan header", () => {
    const hasil = rapikanNamaTampilan('kontrak".pdf\r\nX-Jahat: 1');
    expect(hasil).not.toContain('"');
    expect(hasil).not.toContain("\r");
    expect(hasil).not.toContain("\n");
  });

  it("mengganti pemisah folder", () => {
    expect(rapikanNamaTampilan("../../etc/passwd")).not.toContain("/");
    expect(rapikanNamaTampilan("folder\\berkas.pdf")).not.toContain("\\");
  });

  it("memberi nama cadangan bila hasilnya kosong", () => {
    expect(rapikanNamaTampilan('"""')).toBe("berkas");
    expect(rapikanNamaTampilan("   ")).toBe("berkas");
  });

  it("memotong nama yang terlalu panjang", () => {
    expect(rapikanNamaTampilan("a".repeat(500)).length).toBe(120);
  });

  it("mempertahankan nama yang wajar", () => {
    expect(rapikanNamaTampilan("Kontrak Sewa A-01.pdf")).toBe("Kontrak Sewa A-01.pdf");
  });
});
