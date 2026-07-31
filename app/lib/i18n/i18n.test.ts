import { describe, expect, it } from "vitest";

import { en } from "./en";
import { id } from "./id";
import { adalahLocale, ambilLocale, cookieLokale, pesan } from "./index";

function permintaan(url: string, headers: Record<string, string> = {}) {
  return new Request(url, { headers });
}

describe("adalahLocale", () => {
  it("hanya menerima bahasa yang didukung", () => {
    expect(adalahLocale("id")).toBe(true);
    expect(adalahLocale("en")).toBe(true);
    expect(adalahLocale("fr")).toBe(false);
    expect(adalahLocale(null)).toBe(false);
  });
});

describe("ambilLocale", () => {
  it("mengutamakan parameter ?lang=", () => {
    const req = permintaan("https://contoh.test/?lang=en", { Cookie: "lokale=id" });
    expect(ambilLocale(req)).toBe("en");
  });

  it("memakai cookie bila tidak ada parameter", () => {
    const req = permintaan("https://contoh.test/", { Cookie: "lokale=en" });
    expect(ambilLocale(req)).toBe("en");
  });

  it("memakai Accept-Language bila tidak ada parameter dan cookie", () => {
    const req = permintaan("https://contoh.test/", { "Accept-Language": "en-US,en;q=0.9" });
    expect(ambilLocale(req)).toBe("en");
  });

  it("jatuh ke bahasa bawaan kawasan bila tidak ada petunjuk apa pun", () => {
    expect(ambilLocale(permintaan("https://contoh.test/"), "id")).toBe("id");
  });

  it("mengabaikan bahasa yang tidak didukung", () => {
    const req = permintaan("https://contoh.test/?lang=fr", { "Accept-Language": "fr-FR" });
    expect(ambilLocale(req, "id")).toBe("id");
  });
});

describe("cookieLokale", () => {
  it("menyusun cookie dengan Path dan SameSite", () => {
    const cookie = cookieLokale("en");
    expect(cookie).toContain("lokale=en");
    expect(cookie).toContain("Path=/");
    expect(cookie).toContain("SameSite=Lax");
  });
});

describe("kelengkapan terjemahan", () => {
  it("mengembalikan kamus sesuai bahasa", () => {
    expect(pesan("id")).toBe(id);
    expect(pesan("en")).toBe(en);
  });

  it("bahasa Inggris memuat seluruh kunci bahasa Indonesia", () => {
    expect(kunciBersarang(en)).toEqual(kunciBersarang(id));
  });

  it("tidak ada teks terjemahan yang kosong", () => {
    for (const [jalur, nilai] of daftarNilai(en)) {
      expect(nilai, `terjemahan kosong pada ${jalur}`).not.toBe("");
    }
  });
});

function kunciBersarang(objek: object, awalan = ""): string[] {
  const hasil: string[] = [];
  for (const [kunci, nilai] of Object.entries(objek)) {
    const jalur = awalan ? `${awalan}.${kunci}` : kunci;
    if (typeof nilai === "object" && nilai !== null)
      hasil.push(...kunciBersarang(nilai, jalur));
    else hasil.push(jalur);
  }
  return hasil.sort();
}

function daftarNilai(objek: object, awalan = ""): [string, unknown][] {
  const hasil: [string, unknown][] = [];
  for (const [kunci, nilai] of Object.entries(objek)) {
    const jalur = awalan ? `${awalan}.${kunci}` : kunci;
    if (typeof nilai === "object" && nilai !== null) hasil.push(...daftarNilai(nilai, jalur));
    else hasil.push([jalur, nilai]);
  }
  return hasil;
}
