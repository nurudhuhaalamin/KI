import { describe, expect, it } from "vitest";

import { tujuanAman } from "./navigasi";

describe("tujuanAman", () => {
  it("meneruskan path internal apa adanya", () => {
    expect(tujuanAman("/internal")).toBe("/internal");
    expect(tujuanAman("/internal/perizinan?status=baru")).toBe(
      "/internal/perizinan?status=baru",
    );
  });

  it("memakai tujuan bawaan bila kosong", () => {
    expect(tujuanAman(null)).toBe("/internal");
    expect(tujuanAman(undefined)).toBe("/internal");
    expect(tujuanAman("")).toBe("/internal");
  });

  it("menolak URL absolut ke situs luar", () => {
    expect(tujuanAman("https://contoh-jahat.test")).toBe("/internal");
    expect(tujuanAman("http://contoh-jahat.test/masuk")).toBe("/internal");
  });

  it("menolak URL tanpa skema yang mengarah ke luar", () => {
    expect(tujuanAman("//contoh-jahat.test")).toBe("/internal");
    expect(tujuanAman("/\\contoh-jahat.test")).toBe("/internal");
  });

  it("menolak path yang mengandung karakter kendali atau spasi", () => {
    expect(tujuanAman("/internal\n/palsu")).toBe("/internal");
    expect(tujuanAman("/ javascript:alert(1)")).toBe("/internal");
  });

  it("menghormati tujuan bawaan yang diberikan", () => {
    expect(tujuanAman(null, "/")).toBe("/");
  });
});
