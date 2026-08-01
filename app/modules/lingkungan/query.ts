import { and, asc, desc, eq, inArray } from "drizzle-orm";

import type { Db } from "~/lib/db";
import { users } from "~/lib/db/schema/auth";
import { kavling } from "~/lib/db/schema/kavling";
import {
  anggotaTimPemeriksa,
  berkasLingkungan,
  catatanPemeriksaan,
  dokumenLingkungan,
  keputusanLingkungan,
  kewajibanPemantauan,
  laporanPemantauan,
  timPemeriksa,
  type FrekuensiPemantauan,
  type HasilKeputusanLingkungan,
  type JenisDokumenLingkungan,
  type PeranAnggota,
  type PeranBerkasLingkungan,
  type StatusLingkungan,
  type TahapPemeriksaan,
} from "~/lib/db/schema/lingkungan";
import { pengaturan } from "~/lib/db/schema/sistem";
import { tenant } from "~/lib/db/schema/tenant";
import { POLA_BAWAAN, susunNomor, urutBerikutnya } from "~/lib/penomoran";
import { bacaKalenderLibur } from "~/lib/waktu-kerja/pengaturan";

import { BATAS_BAWAAN, tenggatTahap, type BatasHari } from "./tahapan";
import { jadwalPemantauan, periodeBelumTercatat } from "./pemantauan";

function buatId(awalan: string): string {
  return `${awalan}_${crypto.randomUUID().replaceAll("-", "").slice(0, 20)}`;
}

export const KUNCI_POLA_NOMOR = "lingkungan.pola_nomor";
export const KUNCI_POLA_KEPUTUSAN = "lingkungan.pola_keputusan";
export const KUNCI_HARI_ADMINISTRASI = "lingkungan.hari_administrasi";
export const KUNCI_HARI_SUBSTANSI = "lingkungan.hari_substansi";

/** Singkatan seri per jenis dokumen, dipakai menyusun nomornya. */
export const SERI_JENIS: Record<JenisDokumenLingkungan, string> = {
  "rkl-rpl-rinci": "RKL",
  "ukl-upl": "UKL",
  "rintek-air-limbah": "RTA",
  "rintek-emisi": "RTE",
  sppl: "SPPL",
};

export type PengaturanLingkungan = {
  pola: string;
  polaKeputusan: string;
  batas: BatasHari;
  hariLibur: string[];
};

/**
 * Seluruh pengaturan modul sekaligus.
 *
 * Batas 3 dan 10 hari kerja ikut menjadi pengaturan, bukan angka mati di kode:
 * aturannya berubah dari waktu ke waktu, dan kawasan pembeli tidak boleh perlu
 * menunggu rilis kode untuk menyesuaikannya.
 */
export async function bacaPengaturanLingkungan(db: Db): Promise<PengaturanLingkungan> {
  const [baris, hariLibur] = await Promise.all([
    db
      .select()
      .from(pengaturan)
      .where(
        inArray(pengaturan.kunci, [
          KUNCI_POLA_NOMOR,
          KUNCI_POLA_KEPUTUSAN,
          KUNCI_HARI_ADMINISTRASI,
          KUNCI_HARI_SUBSTANSI,
        ]),
      ),
    bacaKalenderLibur(db),
  ]);

  const cari = (kunci: string) => baris.find((b) => b.kunci === kunci)?.nilai?.trim();
  const angka = (kunci: string, bawaan: number) => {
    const nilai = Number(cari(kunci));
    return Number.isFinite(nilai) && nilai > 0 ? Math.floor(nilai) : bawaan;
  };

  return {
    pola: cari(KUNCI_POLA_NOMOR) || POLA_BAWAAN,
    polaKeputusan: cari(KUNCI_POLA_KEPUTUSAN) || "SK-LH/{urut}/{tahun}",
    batas: {
      administrasi: angka(KUNCI_HARI_ADMINISTRASI, BATAS_BAWAAN.administrasi),
      substansi: angka(KUNCI_HARI_SUBSTANSI, BATAS_BAWAAN.substansi),
    },
    hariLibur,
  };
}

// ------------------------------------------------------------------- dokumen

const KOLOM_DAFTAR = {
  id: dokumenLingkungan.id,
  nomor: dokumenLingkungan.nomor,
  judul: dokumenLingkungan.judul,
  jenis: dokumenLingkungan.jenis,
  status: dokumenLingkungan.status,
  tenggatAdministrasi: dokumenLingkungan.tenggatAdministrasi,
  tenggatSubstansi: dokumenLingkungan.tenggatSubstansi,
  tanggalDiajukan: dokumenLingkungan.tanggalDiajukan,
  tenantId: dokumenLingkungan.tenantId,
  namaTenant: tenant.namaPerusahaan,
  kodeKavling: kavling.kode,
};

export function daftarDokumenLingkungan(db: Db) {
  return db
    .select(KOLOM_DAFTAR)
    .from(dokumenLingkungan)
    .innerJoin(tenant, eq(dokumenLingkungan.tenantId, tenant.id))
    .leftJoin(kavling, eq(dokumenLingkungan.kavlingId, kavling.id))
    .orderBy(desc(dokumenLingkungan.createdAt));
}

/** Milik satu perusahaan saja — dipakai portal tenant. */
export function dokumenLingkunganTenant(db: Db, tenantId: string) {
  return db
    .select(KOLOM_DAFTAR)
    .from(dokumenLingkungan)
    .innerJoin(tenant, eq(dokumenLingkungan.tenantId, tenant.id))
    .leftJoin(kavling, eq(dokumenLingkungan.kavlingId, kavling.id))
    .where(eq(dokumenLingkungan.tenantId, tenantId))
    .orderBy(desc(dokumenLingkungan.createdAt));
}

export async function ambilDokumenLingkungan(db: Db, id: string) {
  const [baris] = await db
    .select({
      dokumen: dokumenLingkungan,
      namaTenant: tenant.namaPerusahaan,
      kodeKavling: kavling.kode,
    })
    .from(dokumenLingkungan)
    .innerJoin(tenant, eq(dokumenLingkungan.tenantId, tenant.id))
    .leftJoin(kavling, eq(dokumenLingkungan.kavlingId, kavling.id))
    .where(eq(dokumenLingkungan.id, id))
    .limit(1);

  return baris ?? null;
}

function urutTerpakai(db: Db) {
  return db
    .select({
      seri: dokumenLingkungan.jenis,
      tahun: dokumenLingkungan.tahun,
      urut: dokumenLingkungan.urut,
    })
    .from(dokumenLingkungan);
}

export async function buatDokumenLingkungan(
  db: Db,
  data: {
    tenantId: string;
    kavlingId?: string;
    diajukanOleh: string;
    jenis: JenisDokumenLingkungan;
    judul: string;
    ringkasanKegiatan?: string;
  },
  tahun: number = new Date().getUTCFullYear(),
) {
  const [{ pola }, terpakai] = await Promise.all([
    bacaPengaturanLingkungan(db),
    urutTerpakai(db),
  ]);

  const urut = urutBerikutnya(terpakai, data.jenis, tahun);
  const nomor = susunNomor(pola, { seri: SERI_JENIS[data.jenis], urut, tahun });
  const id = buatId("dlh");

  await db.insert(dokumenLingkungan).values({
    id,
    nomor,
    urut,
    tahun,
    tenantId: data.tenantId,
    kavlingId: data.kavlingId ?? null,
    diajukanOleh: data.diajukanOleh,
    jenis: data.jenis,
    judul: data.judul,
    ringkasanKegiatan: data.ringkasanKegiatan ?? null,
  });

  return { id, nomor };
}

export async function ubahDokumenLingkungan(
  db: Db,
  id: string,
  data: { judul: string; kavlingId?: string; ringkasanKegiatan?: string },
) {
  await db
    .update(dokumenLingkungan)
    .set({
      judul: data.judul,
      kavlingId: data.kavlingId ?? null,
      ringkasanKegiatan: data.ringkasanKegiatan ?? null,
      updatedAt: new Date(),
    })
    .where(eq(dokumenLingkungan.id, id));
}

/**
 * Mengajukan atau mengajukan ulang.
 *
 * Tenggat administrasi selalu dihitung ulang dari sekarang: pemeriksa baru
 * menerima berkas yang sudah dilengkapi, jadi jatah 3 hari kerjanya utuh lagi.
 * Tenggat substansi dikosongkan karena tahap itu belum dimulai.
 */
export async function ajukanDokumenLingkungan(db: Db, id: string) {
  const { batas, hariLibur } = await bacaPengaturanLingkungan(db);
  const sekarang = new Date();

  await db
    .update(dokumenLingkungan)
    .set({
      status: "diajukan",
      tanggalDiajukan: sekarang,
      tenggatAdministrasi: tenggatTahap("administrasi", sekarang, batas, hariLibur),
      tenggatSubstansi: null,
      updatedAt: sekarang,
    })
    .where(eq(dokumenLingkungan.id, id));
}

/**
 * Menyimpan hasil satu tindakan pemeriksa.
 *
 * Saat berkas dinyatakan lengkap, jam substansi baru dimulai di sini — bukan
 * saat pengajuan pertama, karena waktu yang dipakai tenant melengkapi berkasnya
 * bukan jatah kawasan.
 */
export async function ubahStatusLingkungan(
  db: Db,
  id: string,
  statusBaru: StatusLingkungan,
  opsi: { mulaiSubstansi?: boolean; selesai?: boolean } = {},
) {
  const sekarang = new Date();
  const nilai: Record<string, unknown> = { status: statusBaru, updatedAt: sekarang };

  if (opsi.mulaiSubstansi) {
    const { batas, hariLibur } = await bacaPengaturanLingkungan(db);
    nilai.tenggatSubstansi = tenggatTahap("substansi", sekarang, batas, hariLibur);
  }
  if (opsi.selesai) nilai.tanggalSelesai = sekarang;

  await db.update(dokumenLingkungan).set(nilai).where(eq(dokumenLingkungan.id, id));
}

// ----------------------------------------------------------------------- tim

export async function ambilTim(db: Db, dokumenLingkunganId: string) {
  const [tim] = await db
    .select()
    .from(timPemeriksa)
    .where(eq(timPemeriksa.dokumenLingkunganId, dokumenLingkunganId))
    .limit(1);
  return tim ?? null;
}

export function daftarAnggota(db: Db, timId: string) {
  return db
    .select({
      id: anggotaTimPemeriksa.id,
      userId: anggotaTimPemeriksa.userId,
      peran: anggotaTimPemeriksa.peran,
      nama: users.name,
    })
    .from(anggotaTimPemeriksa)
    .innerJoin(users, eq(anggotaTimPemeriksa.userId, users.id))
    .where(eq(anggotaTimPemeriksa.timId, timId))
    .orderBy(asc(anggotaTimPemeriksa.createdAt));
}

/** Tim dibuat sekali per dokumen, lalu anggotanya ditambah satu per satu. */
export async function pastikanTim(db: Db, dokumenLingkunganId: string, dibentukOleh: string) {
  const ada = await ambilTim(db, dokumenLingkunganId);
  if (ada) return ada.id;

  const id = buatId("tim");
  await db.insert(timPemeriksa).values({ id, dokumenLingkunganId, dibentukOleh });
  return id;
}

export async function tambahAnggota(
  db: Db,
  timId: string,
  data: { userId: string; peran: PeranAnggota },
) {
  const id = buatId("agt");
  await db
    .insert(anggotaTimPemeriksa)
    .values({ id, timId, userId: data.userId, peran: data.peran })
    .onConflictDoUpdate({
      target: [anggotaTimPemeriksa.timId, anggotaTimPemeriksa.userId],
      set: { peran: data.peran },
    });
  return id;
}

export async function hapusAnggota(db: Db, anggotaId: string) {
  await db.delete(anggotaTimPemeriksa).where(eq(anggotaTimPemeriksa.id, anggotaId));
}

/**
 * Pengelola yang perlu diberi tahu saat dokumen lingkungan masuk.
 *
 * Sengaja seluruh pengelola aktif, bukan hanya calon pemeriksa: pada saat
 * pengajuan tiba, tim pemeriksanya memang belum dibentuk.
 */
export function penggunaBerperanLingkungan(db: Db) {
  return db
    .select({ id: users.id })
    .from(users)
    .where(and(eq(users.aktif, true), inArray(users.peran, ["admin", "manajemen", "staf"])));
}

/** Calon anggota tim: pengelola aktif, bukan pengguna tenant. */
export function calonAnggota(db: Db) {
  return db
    .select({ id: users.id, nama: users.name, peran: users.peran })
    .from(users)
    .where(and(eq(users.aktif, true), inArray(users.peran, ["admin", "manajemen", "staf"])))
    .orderBy(asc(users.name));
}

// ------------------------------------------------------------------- catatan

export function daftarCatatan(db: Db, dokumenLingkunganId: string) {
  return db
    .select({
      id: catatanPemeriksaan.id,
      tahap: catatanPemeriksaan.tahap,
      aspek: catatanPemeriksaan.aspek,
      temuan: catatanPemeriksaan.temuan,
      rekomendasi: catatanPemeriksaan.rekomendasi,
      createdAt: catatanPemeriksaan.createdAt,
      namaPemeriksa: users.name,
    })
    .from(catatanPemeriksaan)
    .leftJoin(users, eq(catatanPemeriksaan.olehId, users.id))
    .where(eq(catatanPemeriksaan.dokumenLingkunganId, dokumenLingkunganId))
    .orderBy(desc(catatanPemeriksaan.createdAt));
}

export async function tambahCatatan(
  db: Db,
  dokumenLingkunganId: string,
  data: {
    olehId: string;
    tahap: TahapPemeriksaan;
    aspek: string;
    temuan: string;
    rekomendasi?: string;
  },
) {
  const id = buatId("ctn");
  await db.insert(catatanPemeriksaan).values({
    id,
    dokumenLingkunganId,
    olehId: data.olehId,
    tahap: data.tahap,
    aspek: data.aspek,
    temuan: data.temuan,
    rekomendasi: data.rekomendasi ?? null,
  });
  return id;
}

// ----------------------------------------------------------------- keputusan

export async function ambilKeputusan(db: Db, dokumenLingkunganId: string) {
  const [baris] = await db
    .select()
    .from(keputusanLingkungan)
    .where(eq(keputusanLingkungan.dokumenLingkunganId, dokumenLingkunganId))
    .limit(1);
  return baris ?? null;
}

export async function catatKeputusanLingkungan(
  db: Db,
  dokumenLingkunganId: string,
  data: {
    hasil: HasilKeputusanLingkungan;
    diputusOleh: string;
    jabatanId?: string;
    berlakuSampai: Date | null;
    pertimbangan?: string;
  },
  tahun: number = new Date().getUTCFullYear(),
) {
  const [{ polaKeputusan }, terpakai] = await Promise.all([
    bacaPengaturanLingkungan(db),
    db
      .select({ tahun: keputusanLingkungan.tahun, urut: keputusanLingkungan.urut })
      .from(keputusanLingkungan),
  ]);

  // Nomor keputusan satu deret untuk seluruh kawasan, bukan per jenis dokumen —
  // surat keputusan memang satu seri di buku agenda.
  const urut = urutBerikutnya(
    terpakai.map((k) => ({ seri: "sk", tahun: k.tahun, urut: k.urut })),
    "sk",
    tahun,
  );
  const nomorKeputusan = susunNomor(polaKeputusan, { seri: "SK-LH", urut, tahun });

  const id = buatId("skl");
  await db.insert(keputusanLingkungan).values({
    id,
    dokumenLingkunganId,
    nomorKeputusan,
    urut,
    tahun,
    hasil: data.hasil,
    diputusOleh: data.diputusOleh,
    jabatanId: data.jabatanId ?? null,
    berlakuSampai: data.berlakuSampai,
    pertimbangan: data.pertimbangan ?? null,
  });

  return { id, nomorKeputusan };
}

// -------------------------------------------------------------------- berkas

export function daftarBerkasLingkungan(db: Db, dokumenLingkunganId: string) {
  return db
    .select({
      id: berkasLingkungan.id,
      peran: berkasLingkungan.peran,
      namaBerkas: berkasLingkungan.namaBerkas,
      ukuran: berkasLingkungan.ukuran,
      createdAt: berkasLingkungan.createdAt,
    })
    .from(berkasLingkungan)
    .where(eq(berkasLingkungan.dokumenLingkunganId, dokumenLingkunganId))
    .orderBy(asc(berkasLingkungan.createdAt));
}

export async function tambahBerkasLingkungan(
  db: Db,
  dokumenLingkunganId: string,
  data: {
    peran: PeranBerkasLingkungan;
    namaBerkas: string;
    kunciR2: string;
    ukuran: number;
    tipeMime: string;
    diunggahOleh: string;
  },
) {
  const id = buatId("blh");
  await db.insert(berkasLingkungan).values({ id, dokumenLingkunganId, ...data });
  return id;
}

// ---------------------------------------------------------------- pemantauan

export function daftarKewajiban(db: Db, dokumenLingkunganId: string) {
  return db
    .select()
    .from(kewajibanPemantauan)
    .where(eq(kewajibanPemantauan.dokumenLingkunganId, dokumenLingkunganId))
    .orderBy(asc(kewajibanPemantauan.createdAt));
}

export async function tambahKewajiban(
  db: Db,
  dokumenLingkunganId: string,
  data: { nama: string; namaEn?: string; frekuensi: FrekuensiPemantauan; mulai: Date },
) {
  const id = buatId("kwj");
  await db.insert(kewajibanPemantauan).values({
    id,
    dokumenLingkunganId,
    nama: data.nama,
    namaEn: data.namaEn ?? null,
    frekuensi: data.frekuensi,
    mulai: data.mulai,
  });
  return id;
}

export function daftarLaporan(db: Db, kewajibanIds: readonly string[]) {
  if (kewajibanIds.length === 0) {
    return Promise.resolve(
      [] as {
        id: string;
        kewajibanId: string;
        periode: string;
        jatuhTempo: Date;
        status: "belum" | "terkirim" | "diterima" | "ditolak";
        berkasId: string | null;
        tanggalKirim: Date | null;
        catatan: string | null;
      }[],
    );
  }

  return db
    .select({
      id: laporanPemantauan.id,
      kewajibanId: laporanPemantauan.kewajibanId,
      periode: laporanPemantauan.periode,
      jatuhTempo: laporanPemantauan.jatuhTempo,
      status: laporanPemantauan.status,
      berkasId: laporanPemantauan.berkasId,
      tanggalKirim: laporanPemantauan.tanggalKirim,
      catatan: laporanPemantauan.catatan,
    })
    .from(laporanPemantauan)
    .where(inArray(laporanPemantauan.kewajibanId, kewajibanIds))
    .orderBy(desc(laporanPemantauan.jatuhTempo));
}

/**
 * Membuat baris laporan untuk periode yang sudah tiba tetapi belum tercatat.
 *
 * Dipanggil saat halaman dibuka, bukan seluruhnya di muka: kewajiban tahunan
 * yang berlaku sepuluh tahun tidak perlu membuat baris kosong sampai 2036 pada
 * hari persetujuannya terbit.
 */
export async function segarkanLaporan(
  db: Db,
  kewajiban: readonly {
    id: string;
    frekuensi: FrekuensiPemantauan;
    mulai: Date;
    aktif: boolean;
  }[],
  sekarang: Date = new Date(),
): Promise<void> {
  for (const k of kewajiban) {
    if (!k.aktif) continue;

    const sudahAda = await db
      .select({ periode: laporanPemantauan.periode })
      .from(laporanPemantauan)
      .where(eq(laporanPemantauan.kewajibanId, k.id));

    const jadwal = jadwalPemantauan(k.frekuensi, k.mulai, sekarang);
    const kurang = periodeBelumTercatat(
      jadwal,
      sudahAda.map((b) => b.periode),
    );
    if (kurang.length === 0) continue;

    await db.insert(laporanPemantauan).values(
      kurang.map((p) => ({
        id: buatId("lpm"),
        kewajibanId: k.id,
        periode: p.periode,
        jatuhTempo: p.jatuhTempo,
      })),
    );
  }
}

export async function kirimLaporan(
  db: Db,
  laporanId: string,
  data: { berkasId: string; dikirimOleh: string; catatan?: string },
) {
  await db
    .update(laporanPemantauan)
    .set({
      status: "terkirim",
      berkasId: data.berkasId,
      dikirimOleh: data.dikirimOleh,
      tanggalKirim: new Date(),
      catatan: data.catatan ?? null,
    })
    .where(eq(laporanPemantauan.id, laporanId));
}

/** Seluruh laporan yang masih tertunggak, dipakai kartu dasbor pengelola. */
export function laporanBerjalan(db: Db) {
  return db
    .select({
      id: laporanPemantauan.id,
      periode: laporanPemantauan.periode,
      jatuhTempo: laporanPemantauan.jatuhTempo,
      status: laporanPemantauan.status,
      namaKewajiban: kewajibanPemantauan.nama,
      dokumenLingkunganId: kewajibanPemantauan.dokumenLingkunganId,
      namaTenant: tenant.namaPerusahaan,
    })
    .from(laporanPemantauan)
    .innerJoin(kewajibanPemantauan, eq(laporanPemantauan.kewajibanId, kewajibanPemantauan.id))
    .innerJoin(
      dokumenLingkungan,
      eq(kewajibanPemantauan.dokumenLingkunganId, dokumenLingkungan.id),
    )
    .innerJoin(tenant, eq(dokumenLingkungan.tenantId, tenant.id))
    .orderBy(asc(laporanPemantauan.jatuhTempo));
}
