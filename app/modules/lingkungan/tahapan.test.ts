import { describe, expect, it } from "vitest";

import {
  BATAS_BAWAAN,
  bolehBerpindah,
  bolehDiajukan,
  bolehMencatatTemuan,
  bolehMenyimpulkan,
  bolehSuntingPengajuan,
  keadaanTenggat,
  lingkunganMendesak,
  menungguTenant,
  periksaTindakan,
  tahapBerjalan,
  tenggatTahap,
  type Anggota,
  type DokumenTenggat,
} from "./tahapan";

/** Pembantu baca: 2026-08-03 hari Senin, 2026-08-17 hari Senin (libur nasional). */
const tgl = (teks: string) => new Date(`${teks}T00:00:00Z`);
const SENIN = "2026-08-03";
const KAMIS = "2026-08-06";
const JUMAT = "2026-08-07";

const TIM: Anggota[] = [
  { userId: "u-ketua", peran: "ketua" },
  { userId: "u-anggota", peran: "anggota" },
  { userId: "u-ahli", peran: "ahli" },
];

describe("bolehSuntingPengajuan dan bolehDiajukan", () => {
  it("mengizinkan draf dan dokumen yang dikembalikan kepada tenant", () => {
    for (const status of ["draf", "perlu-dilengkapi", "perlu-diperbaiki"] as const) {
      expect(bolehSuntingPengajuan(status)).toBe(true);
      expect(bolehDiajukan(status)).toBe(true);
    }
  });

  it("mengunci dokumen yang sedang diperiksa atau sudah selesai", () => {
    for (const status of [
      "diajukan",
      "pemeriksaan-administrasi",
      "pemeriksaan-substansi",
      "disetujui",
      "ditolak",
      "batal",
    ] as const) {
      expect(bolehSuntingPengajuan(status)).toBe(false);
    }
  });
});

describe("tahapBerjalan dan menungguTenant", () => {
  it("mengenali tahap yang jamnya sedang berjalan", () => {
    expect(tahapBerjalan("diajukan")).toBe("administrasi");
    expect(tahapBerjalan("pemeriksaan-administrasi")).toBe("administrasi");
    expect(tahapBerjalan("pemeriksaan-substansi")).toBe("substansi");
  });

  it("menyatakan tidak ada jam berjalan saat bola di tangan tenant atau perkara selesai", () => {
    for (const status of ["draf", "perlu-dilengkapi", "perlu-diperbaiki"] as const) {
      expect(tahapBerjalan(status)).toBeNull();
      expect(menungguTenant(status)).toBe(true);
    }
    for (const status of ["disetujui", "ditolak", "batal"] as const) {
      expect(tahapBerjalan(status)).toBeNull();
      expect(menungguTenant(status)).toBe(false);
    }
  });
});

describe("tenggatTahap", () => {
  it("memberi 3 hari kerja untuk administrasi", () => {
    // Masuk Senin -> Kamis.
    expect(tenggatTahap("administrasi", tgl(SENIN))).toEqual(tgl(KAMIS));
  });

  it("memberi 10 hari kerja untuk substansi", () => {
    // Masuk Senin -> dua minggu kerja berikutnya, Senin 17 dilewati bila libur.
    expect(tenggatTahap("substansi", tgl(SENIN))).toEqual(tgl("2026-08-17"));
    expect(tenggatTahap("substansi", tgl(SENIN), BATAS_BAWAAN, ["2026-08-17"])).toEqual(
      tgl("2026-08-18"),
    );
  });

  it("melompati akhir pekan pada tahap administrasi", () => {
    // Masuk Kamis, 3 hari kerja -> Selasa, bukan Minggu.
    expect(tenggatTahap("administrasi", tgl(KAMIS))).toEqual(tgl("2026-08-11"));
  });

  it("menghormati batas hari yang disesuaikan kawasan", () => {
    expect(
      tenggatTahap("administrasi", tgl(SENIN), { administrasi: 5, substansi: 20 }),
    ).toEqual(tgl("2026-08-10"));
  });

  it("menghitung substansi dari saat berkas dinyatakan lengkap, bukan pengajuan pertama", () => {
    // Diajukan Senin, dinyatakan lengkap Jumat: jatah 10 hari kerja mulai Jumat.
    const dariPengajuan = tenggatTahap("substansi", tgl(SENIN));
    const dariLengkap = tenggatTahap("substansi", tgl(JUMAT));
    expect(dariLengkap.getTime()).toBeGreaterThan(dariPengajuan.getTime());
    expect(dariLengkap).toEqual(tgl("2026-08-21"));
  });
});

describe("bolehBerpindah", () => {
  it("menjalankan urutan yang wajar", () => {
    expect(bolehBerpindah("draf", "ajukan")).toBe("diajukan");
    expect(bolehBerpindah("diajukan", "mulai-administrasi")).toBe("pemeriksaan-administrasi");
    expect(bolehBerpindah("pemeriksaan-administrasi", "nyatakan-lengkap")).toBe(
      "pemeriksaan-substansi",
    );
    expect(bolehBerpindah("pemeriksaan-substansi", "setujui")).toBe("disetujui");
  });

  it("TIDAK mengizinkan persetujuan tanpa pemeriksaan substansi", () => {
    // Lubang yang paling mahal: dokumen lolos hanya karena administrasinya rapi.
    expect(bolehBerpindah("pemeriksaan-administrasi", "setujui")).toBeNull();
    expect(bolehBerpindah("diajukan", "setujui")).toBeNull();
    expect(bolehBerpindah("draf", "setujui")).toBeNull();
  });

  it("mengembalikan dokumen kepada tenant dari tahap yang sesuai", () => {
    expect(bolehBerpindah("pemeriksaan-administrasi", "minta-lengkapi")).toBe(
      "perlu-dilengkapi",
    );
    expect(bolehBerpindah("pemeriksaan-substansi", "minta-perbaikan")).toBe("perlu-diperbaiki");
    // Minta perbaikan substansi tidak masuk akal saat masih tahap administrasi.
    expect(bolehBerpindah("pemeriksaan-administrasi", "minta-perbaikan")).toBeNull();
  });

  it("mengizinkan pengajuan ulang setelah dikembalikan", () => {
    expect(bolehBerpindah("perlu-dilengkapi", "ajukan")).toBe("diajukan");
    expect(bolehBerpindah("perlu-diperbaiki", "ajukan")).toBe("diajukan");
  });

  it("tidak mengizinkan apa pun setelah perkara selesai", () => {
    for (const tindakan of ["ajukan", "setujui", "tolak", "batalkan"] as const) {
      expect(bolehBerpindah("disetujui", tindakan)).toBeNull();
      expect(bolehBerpindah("ditolak", tindakan)).toBeNull();
    }
  });
});

describe("wewenang tim pemeriksa", () => {
  it("mengizinkan seluruh anggota mencatat temuan", () => {
    expect(bolehMencatatTemuan({ id: "u-anggota", peran: "staf" }, TIM)).toBe(true);
    expect(bolehMencatatTemuan({ id: "u-ahli", peran: "staf" }, TIM)).toBe(true);
  });

  it("menolak orang di luar tim", () => {
    expect(bolehMencatatTemuan({ id: "u-lain", peran: "staf" }, TIM)).toBe(false);
    expect(bolehMenyimpulkan({ id: "u-lain", peran: "manajemen" }, TIM)).toBe(false);
  });

  it("hanya ketua yang boleh menyimpulkan tahap", () => {
    expect(bolehMenyimpulkan({ id: "u-ketua", peran: "staf" }, TIM)).toBe(true);
    expect(bolehMenyimpulkan({ id: "u-anggota", peran: "staf" }, TIM)).toBe(false);
    expect(bolehMenyimpulkan({ id: "u-ahli", peran: "staf" }, TIM)).toBe(false);
  });

  it("mengizinkan administrator bertindak sebagai ketua", () => {
    // Tanpa ini pemeriksaan macet permanen saat ketuanya berhalangan.
    expect(bolehMenyimpulkan({ id: "u-admin", peran: "admin" }, TIM)).toBe(true);
    expect(bolehMencatatTemuan({ id: "u-admin", peran: "admin" }, [])).toBe(true);
  });
});

describe("periksaTindakan", () => {
  it("mengizinkan ketua menyimpulkan tahap yang sedang berjalan", () => {
    expect(
      periksaTindakan(
        "pemeriksaan-administrasi",
        "nyatakan-lengkap",
        { id: "u-ketua", peran: "staf" },
        TIM,
      ),
    ).toEqual({ boleh: true, statusBaru: "pemeriksaan-substansi" });
  });

  it("menolak anggota biasa", () => {
    expect(
      periksaTindakan(
        "pemeriksaan-substansi",
        "setujui",
        { id: "u-anggota", peran: "staf" },
        TIM,
      ),
    ).toEqual({ boleh: false, galat: "bukanKetua" });
  });

  it("menolak perpindahan yang tidak sah lebih dulu daripada memeriksa wewenang", () => {
    expect(
      periksaTindakan(
        "pemeriksaan-administrasi",
        "setujui",
        { id: "u-admin", peran: "admin" },
        TIM,
      ),
    ).toEqual({ boleh: false, galat: "statusTidakBoleh" });
  });

  it("menolak bila tim belum dibentuk", () => {
    expect(
      periksaTindakan(
        "pemeriksaan-administrasi",
        "nyatakan-lengkap",
        { id: "u-ketua", peran: "staf" },
        [],
      ),
    ).toEqual({ boleh: false, galat: "belumAdaTim" });
  });
});

describe("keadaanTenggat", () => {
  const tenggatAdm = tgl("2026-08-05");
  const tenggatSub = tgl("2026-08-20");

  it("menilai jam administrasi saat tahap administrasi berjalan", () => {
    const hasil = keadaanTenggat(
      "pemeriksaan-administrasi",
      tenggatAdm,
      null,
      tgl("2026-08-07"),
    );
    expect(hasil).toEqual({ tahap: "administrasi", tenggat: tenggatAdm, status: "terlambat" });
  });

  it("berpindah menilai jam substansi setelah berkas dinyatakan lengkap", () => {
    const hasil = keadaanTenggat(
      "pemeriksaan-substansi",
      tenggatAdm,
      tenggatSub,
      tgl("2026-08-07"),
    );
    expect(hasil.tahap).toBe("substansi");
    expect(hasil.tenggat).toEqual(tenggatSub);
    expect(hasil.status).toBe("aman");
  });

  it("tidak menyatakan terlambat saat bola ada di tangan tenant", () => {
    // Tenggat administrasinya memang sudah lewat, tetapi kawasan sudah menjawab.
    const hasil = keadaanTenggat("perlu-dilengkapi", tenggatAdm, null, tgl("2026-09-01"));
    expect(hasil).toEqual({ tahap: null, tenggat: null, status: "aman" });
  });

  it("tidak menyatakan terlambat setelah perkara selesai", () => {
    const hasil = keadaanTenggat("disetujui", tenggatAdm, tenggatSub, tgl("2026-12-01"));
    expect(hasil.status).toBe("aman");
  });
});

describe("lingkunganMendesak", () => {
  const daftar: DokumenTenggat[] = [
    {
      id: "a",
      nomor: "RKL/001/2026",
      judul: "Substansi hampir lewat",
      status: "pemeriksaan-substansi",
      tenggatAdministrasi: tgl("2026-08-04"),
      tenggatSubstansi: tgl("2026-08-06"),
    },
    {
      id: "b",
      nomor: "RKL/002/2026",
      judul: "Administrasi sudah lewat",
      status: "pemeriksaan-administrasi",
      tenggatAdministrasi: tgl("2026-08-04"),
      tenggatSubstansi: null,
    },
    {
      id: "c",
      nomor: "RKL/003/2026",
      judul: "Menunggu tenant",
      status: "perlu-dilengkapi",
      tenggatAdministrasi: tgl("2026-07-01"),
      tenggatSubstansi: null,
    },
    {
      id: "d",
      nomor: "RKL/004/2026",
      judul: "Sudah disetujui",
      status: "disetujui",
      tenggatAdministrasi: tgl("2026-07-01"),
      tenggatSubstansi: tgl("2026-07-20"),
    },
    {
      id: "e",
      nomor: "RKL/005/2026",
      judul: "Masih longgar",
      status: "pemeriksaan-substansi",
      tenggatAdministrasi: null,
      tenggatSubstansi: tgl("2026-09-30"),
    },
  ];

  it("hanya memuat yang jamnya berjalan dan tenggatnya mendesak", () => {
    const hasil = lingkunganMendesak(daftar, tgl("2026-08-05"));
    expect(hasil.map((d) => d.id)).toEqual(["b", "a"]);
  });

  it("tidak mengingatkan yang menunggu tenant maupun yang sudah selesai", () => {
    const hasil = lingkunganMendesak(daftar, tgl("2026-09-30"));
    expect(hasil.map((d) => d.id)).not.toContain("c");
    expect(hasil.map((d) => d.id)).not.toContain("d");
  });

  it("mengurutkan yang paling mendesak di atas", () => {
    const hasil = lingkunganMendesak(daftar, tgl("2026-09-30"));
    const nomor = hasil.map((d) => d.nomor);
    expect(nomor[0]).toBe("RKL/002/2026");
  });
});
