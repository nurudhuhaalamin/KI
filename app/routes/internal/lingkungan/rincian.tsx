import { Form, Link, redirect, useNavigation, useSearchParams } from "react-router";

import {
  AreaTeks,
  Kolom,
  PesanBerhasil,
  PesanGalat,
  Pilihan,
  Teks,
  Tombol,
} from "~/components/internal/kolom";
import { BarisKosong, Sel, Tabel } from "~/components/internal/tabel";
import { catatAudit } from "~/lib/audit";
import { wajibMasuk } from "~/lib/auth/sesi";
import { buatKunci, periksaBerkas, unggahBerkas } from "~/lib/berkas/r2";
import { cloudflareContext } from "~/lib/context";
import { buatDb } from "~/lib/db";
import {
  FREKUENSI_PEMANTAUAN,
  PERAN_ANGGOTA,
  TAHAP_PEMERIKSAAN,
} from "~/lib/db/schema/lingkungan";
import { kirimNotifikasi } from "~/lib/notifikasi";
import { sisaHariKerja } from "~/lib/waktu-kerja";
import { keadaanLaporan } from "~/modules/lingkungan/pemantauan";
import {
  ambilDokumenLingkungan,
  ambilKeputusan,
  ambilTim,
  bacaPengaturanLingkungan,
  calonAnggota,
  catatKeputusanLingkungan,
  daftarAnggota,
  daftarBerkasLingkungan,
  daftarCatatan,
  daftarKewajiban,
  daftarLaporan,
  hapusAnggota,
  pastikanTim,
  segarkanLaporan,
  tambahAnggota,
  tambahBerkasLingkungan,
  tambahCatatan,
  tambahKewajiban,
  ubahStatusLingkungan,
} from "~/modules/lingkungan/query";
import {
  bolehMencatatTemuan,
  keadaanTenggat,
  periksaTindakan,
  type TindakanPemeriksaan,
} from "~/modules/lingkungan/tahapan";
import {
  skemaAnggotaTim,
  skemaCatatan,
  skemaKeputusanLingkungan,
  skemaKewajiban,
} from "~/modules/lingkungan/validasi";
import { daftarJabatan } from "~/modules/organisasi/query";
import { useDataRoot } from "~/root";

import type { Route } from "./+types/rincian";

const TINDAKAN_SAH: readonly TindakanPemeriksaan[] = [
  "mulai-administrasi",
  "minta-lengkapi",
  "nyatakan-lengkap",
  "minta-perbaikan",
  "setujui",
  "tolak",
];

function adalahTindakan(nilai: string): nilai is TindakanPemeriksaan {
  return (TINDAKAN_SAH as readonly string[]).includes(nilai);
}

export async function loader({ request, params, context }: Route.LoaderArgs) {
  const { env } = context.get(cloudflareContext);
  const pengguna = await wajibMasuk(env, request, ["admin", "manajemen", "staf"]);
  const db = buatDb(env);

  const data = await ambilDokumenLingkungan(db, params.id);
  if (!data) throw new Response("Tidak ditemukan", { status: 404 });

  const tim = await ambilTim(db, params.id);
  const anggota = tim ? await daftarAnggota(db, tim.id) : [];
  const kewajiban = await daftarKewajiban(db, params.id);

  // Baris laporan dibuat sesuai kebutuhan saat halaman dibuka.
  await segarkanLaporan(db, kewajiban);

  const [catatan, berkas, keputusan, laporan, calon, jabatan, { hariLibur }] =
    await Promise.all([
      daftarCatatan(db, params.id),
      daftarBerkasLingkungan(db, params.id),
      ambilKeputusan(db, params.id),
      daftarLaporan(
        db,
        kewajiban.map((k) => k.id),
      ),
      calonAnggota(db),
      daftarJabatan(db),
      bacaPengaturanLingkungan(db),
    ]);

  const ringkasAnggota = anggota.map((a) => ({ userId: a.userId, peran: a.peran }));

  return {
    data,
    anggota,
    catatan,
    berkas,
    keputusan,
    kewajiban,
    laporan,
    calon,
    jabatan,
    hariLibur,
    keadaan: keadaanTenggat(
      data.dokumen.status,
      data.dokumen.tenggatAdministrasi,
      data.dokumen.tenggatSubstansi,
      new Date(),
      hariLibur,
    ),
    bolehKelolaTim: pengguna.peran === "admin" || pengguna.peran === "manajemen",
    bolehCatat: bolehMencatatTemuan(pengguna, ringkasAnggota),
  };
}

export async function action({ request, params, context }: Route.ActionArgs) {
  const { env } = context.get(cloudflareContext);
  const pengguna = await wajibMasuk(env, request, ["admin", "manajemen", "staf"]);
  const db = buatDb(env);

  const data = await ambilDokumenLingkungan(db, params.id);
  if (!data) throw new Response("Tidak ditemukan", { status: 404 });

  const formulir = await request.formData();
  const maksud = String(formulir.get("maksud") ?? "");

  const tim = await ambilTim(db, params.id);
  const anggota = tim ? await daftarAnggota(db, tim.id) : [];
  const ringkasAnggota = anggota.map((a) => ({ userId: a.userId, peran: a.peran }));

  // --- susunan tim ---
  if (maksud === "tambah-anggota" || maksud === "hapus-anggota") {
    if (pengguna.peran !== "admin" && pengguna.peran !== "manajemen") {
      throw new Response("Akses ditolak", { status: 403 });
    }

    if (maksud === "hapus-anggota") {
      const anggotaId = String(formulir.get("anggotaId") ?? "");
      if (anggotaId) await hapusAnggota(db, anggotaId);
      return redirect(`/internal/lingkungan/${params.id}?tim=1`);
    }

    const hasil = skemaAnggotaTim.safeParse(Object.fromEntries(formulir));
    if (!hasil.success) return { galat: hasil.error.issues[0]?.message ?? "Data tidak valid" };

    const timId = tim?.id ?? (await pastikanTim(db, params.id, pengguna.id));
    await tambahAnggota(db, timId, hasil.data);
    await catatAudit(db, {
      userId: pengguna.id,
      aksi: "ubah",
      entitas: "tim_pemeriksa",
      entitasId: params.id,
      ringkasan: `Susunan tim pemeriksa ${data.dokumen.nomor} diperbarui`,
      request,
    });
    return redirect(`/internal/lingkungan/${params.id}?tim=1`);
  }

  // --- temuan ---
  if (maksud === "temuan") {
    if (!bolehMencatatTemuan(pengguna, ringkasAnggota)) {
      return { galat: "galatBukanAnggota" as const };
    }

    const hasil = skemaCatatan.safeParse(Object.fromEntries(formulir));
    if (!hasil.success) return { galat: hasil.error.issues[0]?.message ?? "Data tidak valid" };

    await tambahCatatan(db, params.id, { olehId: pengguna.id, ...hasil.data });
    return redirect(`/internal/lingkungan/${params.id}?temuan=1`);
  }

  // --- unggah berkas (mis. surat keputusan yang sudah ditandatangani) ---
  if (maksud === "berkas") {
    const berkas = formulir.get("berkas");
    if (!(berkas instanceof File)) return { galat: "berkasKosong" as const };

    const galatBerkas = periksaBerkas(berkas);
    if (galatBerkas) {
      const peta = {
        tipeTidakDiizinkan: "berkasTipeTidakDiizinkan",
        terlaluBesar: "berkasTerlaluBesar",
        kosong: "berkasKosong",
      } as const;
      return { galat: peta[galatBerkas] };
    }

    const kunci = buatKunci("lingkungan", params.id, berkas.type);
    const unggahan = await unggahBerkas(env, kunci, berkas);
    await tambahBerkasLingkungan(db, params.id, {
      peran: "surat-keputusan",
      namaBerkas: berkas.name,
      kunciR2: unggahan.kunci,
      ukuran: unggahan.ukuran,
      tipeMime: unggahan.tipeMime,
      diunggahOleh: pengguna.id,
    });
    return redirect(`/internal/lingkungan/${params.id}?berkas=1`);
  }

  // --- kewajiban pemantauan ---
  if (maksud === "kewajiban") {
    if (pengguna.peran !== "admin" && pengguna.peran !== "manajemen") {
      throw new Response("Akses ditolak", { status: 403 });
    }

    const hasil = skemaKewajiban.safeParse(Object.fromEntries(formulir));
    if (!hasil.success) return { galat: hasil.error.issues[0]?.message ?? "Data tidak valid" };

    await tambahKewajiban(db, params.id, hasil.data);
    return redirect(`/internal/lingkungan/${params.id}?kewajiban=1`);
  }

  // --- tindakan pemeriksa ---
  if (!adalahTindakan(maksud)) return { galat: "galatStatusTidakBoleh" as const };

  const izin = periksaTindakan(data.dokumen.status, maksud, pengguna, ringkasAnggota);
  if (!izin.boleh)
    return { galat: `galat${izin.galat[0]!.toUpperCase()}${izin.galat.slice(1)}` };

  // Persetujuan dan penolakan sekaligus menerbitkan nomor keputusan.
  if (maksud === "setujui" || maksud === "tolak") {
    if (await ambilKeputusan(db, params.id)) {
      return { galat: "galatSudahAdaKeputusan" as const };
    }

    const hasil = skemaKeputusanLingkungan.safeParse({
      ...Object.fromEntries(formulir),
      hasil: maksud === "setujui" ? "disetujui" : "ditolak",
    });
    if (!hasil.success) return { galat: hasil.error.issues[0]?.message ?? "Data tidak valid" };

    const { nomorKeputusan } = await catatKeputusanLingkungan(db, params.id, {
      ...hasil.data,
      diputusOleh: pengguna.id,
    });
    await ubahStatusLingkungan(db, params.id, izin.statusBaru, { selesai: true });

    await catatAudit(db, {
      userId: pengguna.id,
      aksi: "ubah",
      entitas: "dokumen_lingkungan",
      entitasId: params.id,
      ringkasan: `Dokumen ${data.dokumen.nomor} ${izin.statusBaru}; keputusan ${nomorKeputusan}`,
      request,
    });
  } else {
    await ubahStatusLingkungan(db, params.id, izin.statusBaru, {
      mulaiSubstansi: maksud === "nyatakan-lengkap",
    });
    await catatAudit(db, {
      userId: pengguna.id,
      aksi: "ubah",
      entitas: "dokumen_lingkungan",
      entitasId: params.id,
      ringkasan: `Dokumen ${data.dokumen.nomor}: ${maksud}`,
      request,
    });
  }

  if (data.dokumen.diajukanOleh) {
    await kirimNotifikasi(db, [data.dokumen.diajukanOleh], {
      judul: "Pemeriksaan dokumen lingkungan",
      pesan: `${data.dokumen.nomor} — ${data.dokumen.judul}: ${izin.statusBaru}`,
      tautan: `/portal/lingkungan/${params.id}`,
    });
  }

  return redirect(`/internal/lingkungan/${params.id}?diproses=1`);
}

export default function RincianLingkungan({ loaderData, actionData }: Route.ComponentProps) {
  const { t, locale } = useDataRoot();
  const navigation = useNavigation();
  const sedangKirim = navigation.state === "submitting";
  const {
    data,
    anggota,
    catatan,
    berkas,
    keputusan,
    kewajiban,
    laporan,
    calon,
    jabatan,
    hariLibur,
    keadaan,
    bolehKelolaTim,
    bolehCatat,
  } = loaderData;
  const [paramPencarian] = useSearchParams();
  const sekarang = new Date();

  const labelStatus: Record<string, string> = {
    draf: t.lingkungan.statusDraf,
    diajukan: t.lingkungan.statusDiajukan,
    "pemeriksaan-administrasi": t.lingkungan.statusPemeriksaanAdministrasi,
    "perlu-dilengkapi": t.lingkungan.statusPerluDilengkapi,
    "pemeriksaan-substansi": t.lingkungan.statusPemeriksaanSubstansi,
    "perlu-diperbaiki": t.lingkungan.statusPerluDiperbaiki,
    disetujui: t.lingkungan.statusDisetujui,
    ditolak: t.lingkungan.statusDitolak,
    batal: t.lingkungan.statusBatal,
  };
  const labelPeran: Record<string, string> = {
    ketua: t.lingkungan.peranKetua,
    sekretaris: t.lingkungan.peranSekretaris,
    anggota: t.lingkungan.peranAnggotaBiasa,
    ahli: t.lingkungan.peranAhli,
  };
  const labelTahap: Record<string, string> = {
    administrasi: t.lingkungan.tahapAdministrasi,
    substansi: t.lingkungan.tahapSubstansi,
  };
  const labelFrekuensi: Record<string, string> = {
    bulanan: t.lingkungan.frekuensiBulanan,
    triwulanan: t.lingkungan.frekuensiTriwulanan,
    semesteran: t.lingkungan.frekuensiSemesteran,
    tahunan: t.lingkungan.frekuensiTahunan,
  };
  const labelLaporan: Record<string, string> = {
    belum: t.lingkungan.laporanBelum,
    terkirim: t.lingkungan.laporanTerkirim,
    diterima: t.lingkungan.laporanDiterima,
    ditolak: t.lingkungan.laporanDitolak,
  };
  const labelBerkas: Record<string, string> = {
    pengajuan: t.lingkungan.peranBerkasPengajuan,
    perbaikan: t.lingkungan.peranBerkasPerbaikan,
    "surat-keputusan": t.lingkungan.peranBerkasSurat,
  };

  const petaGalat: Record<string, string> = {
    galatStatusTidakBoleh: t.lingkungan.galatStatusTidakBoleh,
    galatBukanKetua: t.lingkungan.galatBukanKetua,
    galatBukanAnggota: t.lingkungan.galatBukanAnggota,
    galatBelumAdaTim: t.lingkungan.galatBelumAdaTim,
    galatBelumAdaBerkas: t.lingkungan.galatBelumAdaBerkas,
    galatSudahAdaKeputusan: t.lingkungan.galatSudahAdaKeputusan,
    berkasTipeTidakDiizinkan: t.kontrak.berkasTipeTidakDiizinkan,
    berkasTerlaluBesar: t.kontrak.berkasTerlaluBesar,
    berkasKosong: t.kontrak.berkasKosong,
  };
  const kodeGalat = actionData && "galat" in actionData ? actionData.galat : null;
  const pesanGalat = kodeGalat ? (petaGalat[kodeGalat] ?? kodeGalat) : null;

  const tanggal = new Intl.DateTimeFormat(locale === "en" ? "en-GB" : "id-ID", {
    dateStyle: "medium",
  });

  const keteranganTenggat = (() => {
    if (!keadaan.tenggat) return t.lingkungan.menungguTenant;
    const sisa = sisaHariKerja(keadaan.tenggat, sekarang, hariLibur);
    if (sisa < 0) return t.lingkungan.terlambatHari.replace("{n}", String(Math.abs(sisa)));
    if (sisa === 0) return t.lingkungan.tenggatHariIni;
    return t.lingkungan.sisaHari.replace("{n}", String(sisa));
  })();

  /** Tindakan yang masuk akal pada keadaan sekarang. */
  const tindakan: { maksud: TindakanPemeriksaan; label: string; keputusan?: boolean }[] =
    (() => {
      const s = data.dokumen.status;
      if (s === "diajukan") {
        return [
          { maksud: "mulai-administrasi", label: t.lingkungan.mulaiAdministrasi },
          { maksud: "minta-lengkapi", label: t.lingkungan.mintaLengkapi },
          { maksud: "nyatakan-lengkap", label: t.lingkungan.nyatakanLengkap },
        ];
      }
      if (s === "pemeriksaan-administrasi") {
        return [
          { maksud: "nyatakan-lengkap", label: t.lingkungan.nyatakanLengkap },
          { maksud: "minta-lengkapi", label: t.lingkungan.mintaLengkapi },
          { maksud: "tolak", label: t.lingkungan.tolak, keputusan: true },
        ];
      }
      if (s === "pemeriksaan-substansi") {
        return [
          { maksud: "setujui", label: t.lingkungan.setujui, keputusan: true },
          { maksud: "minta-perbaikan", label: t.lingkungan.mintaPerbaikan },
          { maksud: "tolak", label: t.lingkungan.tolak, keputusan: true },
        ];
      }
      return [];
    })();

  return (
    <div className="flex flex-col gap-8">
      <div>
        <Link
          to="/internal/lingkungan"
          className="text-sm text-sky-700 underline dark:text-sky-400"
        >
          ← {t.lingkungan.judul}
        </Link>
        <h1 className="mt-2 text-2xl font-semibold" data-testid="judul-halaman">
          {data.dokumen.judul}
        </h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          <code data-testid="nomor-dokumen">{data.dokumen.nomor}</code> ·{" "}
          <span data-testid="status-dokumen">{labelStatus[data.dokumen.status]}</span> ·{" "}
          {data.namaTenant} ·{" "}
          <span data-testid="tenggat-dokumen">
            {keadaan.tahap ? `${labelTahap[keadaan.tahap]}: ${keteranganTenggat}` : "—"}
          </span>
        </p>
      </div>

      <PesanGalat pesan={pesanGalat} />
      {["tim", "temuan", "diproses", "berkas", "kewajiban"].some((k) =>
        paramPencarian.has(k),
      ) && !pesanGalat ? (
        <PesanBerhasil pesan={t.umum.berhasilDisimpan} />
      ) : null}

      {/* --------------------------------------------------------------- tim */}
      <section className="max-w-3xl">
        <h2 className="text-lg font-medium">{t.lingkungan.tim}</h2>
        <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">
          {t.lingkungan.timPetunjuk}
        </p>

        {bolehKelolaTim ? (
          <Form method="post" className="mt-3 flex flex-wrap items-end gap-4">
            <input type="hidden" name="maksud" value="tambah-anggota" />
            <Kolom label={t.lingkungan.anggota}>
              <Pilihan name="userId" required data-testid="input-anggota">
                {calon.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nama}
                  </option>
                ))}
              </Pilihan>
            </Kolom>
            <Kolom label={t.lingkungan.peranAnggota}>
              <Pilihan name="peran" defaultValue="anggota" data-testid="input-peran-anggota">
                {PERAN_ANGGOTA.map((p) => (
                  <option key={p} value={p}>
                    {labelPeran[p]}
                  </option>
                ))}
              </Pilihan>
            </Kolom>
            <Tombol type="submit" variasi="kedua" data-testid="tombol-tambah-anggota">
              {t.lingkungan.tambahAnggota}
            </Tombol>
          </Form>
        ) : null}

        <div className="mt-4">
          <Tabel
            testId="tabel-tim"
            judulKolom={[t.umum.nama, t.lingkungan.peranAnggota, t.umum.aksi]}
          >
            {anggota.length === 0 ? (
              <BarisKosong kolom={3} pesan={t.lingkungan.belumAdaTim} />
            ) : (
              anggota.map((a) => (
                <tr key={a.id}>
                  <Sel>{a.nama}</Sel>
                  <Sel>
                    <span data-testid={`peran-${a.userId}`}>{labelPeran[a.peran]}</span>
                  </Sel>
                  <Sel>
                    {bolehKelolaTim ? (
                      <Form method="post">
                        <input type="hidden" name="maksud" value="hapus-anggota" />
                        <input type="hidden" name="anggotaId" value={a.id} />
                        <button
                          type="submit"
                          className="text-sm text-rose-700 underline dark:text-rose-400"
                        >
                          {t.lingkungan.hapusAnggota}
                        </button>
                      </Form>
                    ) : (
                      t.umum.tidakAda
                    )}
                  </Sel>
                </tr>
              ))
            )}
          </Tabel>
        </div>
      </section>

      {/* ------------------------------------------------------------ temuan */}
      <section className="max-w-3xl border-t border-slate-200 pt-6 dark:border-slate-800">
        <h2 className="text-lg font-medium">{t.lingkungan.temuan}</h2>

        {bolehCatat ? (
          <Form method="post" className="mt-3 flex flex-col gap-4" data-testid="form-temuan">
            <input type="hidden" name="maksud" value="temuan" />
            <div className="grid gap-4 sm:grid-cols-2">
              <Kolom label={t.lingkungan.tahapAdministrasi}>
                <Pilihan name="tahap" defaultValue="administrasi" data-testid="input-tahap">
                  {TAHAP_PEMERIKSAAN.map((s) => (
                    <option key={s} value={s}>
                      {labelTahap[s]}
                    </option>
                  ))}
                </Pilihan>
              </Kolom>
              <Kolom label={t.lingkungan.aspek}>
                <Teks name="aspek" required maxLength={200} data-testid="input-aspek" />
              </Kolom>
            </div>
            <Kolom label={t.lingkungan.isiTemuan}>
              <AreaTeks name="temuan" required maxLength={4000} data-testid="input-temuan" />
            </Kolom>
            <Kolom label={t.lingkungan.rekomendasi}>
              <AreaTeks name="rekomendasi" maxLength={4000} />
            </Kolom>
            <div>
              <Tombol type="submit" variasi="kedua" data-testid="tombol-catat-temuan">
                {t.lingkungan.catatTemuan}
              </Tombol>
            </div>
          </Form>
        ) : null}

        <div className="mt-4">
          <Tabel
            testId="tabel-temuan"
            judulKolom={[
              t.lingkungan.tahapAdministrasi,
              t.lingkungan.aspek,
              t.lingkungan.isiTemuan,
              t.umum.nama,
            ]}
          >
            {catatan.length === 0 ? (
              <BarisKosong kolom={4} pesan={t.lingkungan.belumAdaTemuan} />
            ) : (
              catatan.map((c) => (
                <tr key={c.id}>
                  <Sel>{labelTahap[c.tahap]}</Sel>
                  <Sel>{c.aspek}</Sel>
                  <Sel>
                    <span className="text-xs">{c.temuan}</span>
                  </Sel>
                  <Sel>
                    <span className="text-xs">{c.namaPemeriksa ?? t.umum.tidakAda}</span>
                  </Sel>
                </tr>
              ))
            )}
          </Tabel>
        </div>
      </section>

      {/* ---------------------------------------------------------- tindakan */}
      {tindakan.length > 0 ? (
        <section className="max-w-3xl border-t border-slate-200 pt-6 dark:border-slate-800">
          <h2 className="text-lg font-medium">{t.lingkungan.tindakan}</h2>

          <div className="mt-3 flex flex-col gap-3">
            {tindakan.map((k) =>
              k.keputusan ? (
                <Form
                  key={k.maksud}
                  method="post"
                  className="flex flex-col gap-3 rounded-md border border-slate-200 p-3 dark:border-slate-800"
                  data-testid={`form-${k.maksud}`}
                >
                  <input type="hidden" name="maksud" value={k.maksud} />
                  <div className="grid gap-3 sm:grid-cols-3">
                    <Kolom label={t.dokumen.pengesahan}>
                      <Pilihan name="jabatanId" defaultValue="">
                        <option value="">{t.umum.tidakAda}</option>
                        {jabatan.map((j) => (
                          <option key={j.id} value={j.id}>
                            {j.nama}
                          </option>
                        ))}
                      </Pilihan>
                    </Kolom>
                    <Kolom label={t.lingkungan.berlakuSampai}>
                      <Teks
                        type="date"
                        name="berlakuSampai"
                        data-testid={`input-berlaku-${k.maksud}`}
                      />
                    </Kolom>
                    <Kolom label={t.lingkungan.pertimbangan}>
                      <Teks name="pertimbangan" maxLength={4000} />
                    </Kolom>
                  </div>
                  <div>
                    <Tombol
                      type="submit"
                      disabled={sedangKirim}
                      data-testid={`tombol-${k.maksud}`}
                    >
                      {k.label}
                    </Tombol>
                  </div>
                </Form>
              ) : (
                <Form key={k.maksud} method="post">
                  <input type="hidden" name="maksud" value={k.maksud} />
                  <Tombol
                    type="submit"
                    variasi="kedua"
                    disabled={sedangKirim}
                    data-testid={`tombol-${k.maksud}`}
                  >
                    {k.label}
                  </Tombol>
                </Form>
              ),
            )}
          </div>
        </section>
      ) : null}

      {/* --------------------------------------------------------- keputusan */}
      <section className="max-w-3xl border-t border-slate-200 pt-6 dark:border-slate-800">
        <h2 className="text-lg font-medium">{t.lingkungan.keputusan}</h2>
        {keputusan ? (
          <dl className="mt-3 grid gap-3 sm:grid-cols-3" data-testid="ringkasan-keputusan">
            <div>
              <dt className="text-xs text-slate-500 dark:text-slate-400">
                {t.lingkungan.nomorKeputusan}
              </dt>
              <dd className="text-sm">
                <code data-testid="nomor-keputusan">{keputusan.nomorKeputusan}</code>
              </dd>
            </div>
            <div>
              <dt className="text-xs text-slate-500 dark:text-slate-400">{t.umum.status}</dt>
              <dd className="text-sm">
                {keputusan.hasil === "disetujui"
                  ? t.lingkungan.hasilDisetujui
                  : t.lingkungan.hasilDitolak}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-slate-500 dark:text-slate-400">
                {t.lingkungan.berlakuSampai}
              </dt>
              <dd className="text-sm">
                {keputusan.berlakuSampai
                  ? tanggal.format(keputusan.berlakuSampai)
                  : t.umum.tidakAda}
              </dd>
            </div>
          </dl>
        ) : (
          <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">
            {t.lingkungan.belumAdaKeputusan}
          </p>
        )}

        {keputusan ? (
          <Form
            method="post"
            encType="multipart/form-data"
            className="mt-4 flex flex-col gap-3"
            data-testid="form-surat"
          >
            <input type="hidden" name="maksud" value="berkas" />
            <Kolom label={t.lingkungan.suratKeputusan} petunjuk={t.kontrak.berkasPetunjuk}>
              <input
                type="file"
                name="berkas"
                required
                accept=".pdf,.jpg,.jpeg,.png"
                data-testid="input-surat"
                className="w-full text-sm"
              />
            </Kolom>
            <div>
              <Tombol type="submit" variasi="kedua" data-testid="tombol-unggah-surat">
                {t.lingkungan.unggahSurat}
              </Tombol>
            </div>
          </Form>
        ) : null}
      </section>

      {/* ------------------------------------------------------------ berkas */}
      <section className="max-w-3xl border-t border-slate-200 pt-6 dark:border-slate-800">
        <h2 className="text-lg font-medium">{t.lingkungan.berkasPengajuan}</h2>
        <div className="mt-3">
          <Tabel
            testId="tabel-berkas"
            judulKolom={[t.kontrak.berkas, t.umum.status, t.jejakAudit.waktu, t.umum.aksi]}
          >
            {berkas.length === 0 ? (
              <BarisKosong kolom={4} pesan={t.umum.tidakAdaData} />
            ) : (
              berkas.map((b) => (
                <tr key={b.id}>
                  <Sel>{b.namaBerkas}</Sel>
                  <Sel>{labelBerkas[b.peran]}</Sel>
                  <Sel>
                    <span className="whitespace-nowrap text-xs">
                      {tanggal.format(b.createdAt)}
                    </span>
                  </Sel>
                  <Sel>
                    <a
                      href={`/internal/berkas/berkas-lingkungan/${b.id}`}
                      className="text-sky-700 underline dark:text-sky-400"
                      data-testid={`unduh-${b.id}`}
                    >
                      {t.kontrak.unduh}
                    </a>
                  </Sel>
                </tr>
              ))
            )}
          </Tabel>
        </div>
      </section>

      {/* -------------------------------------------------------- pemantauan */}
      <section className="max-w-3xl border-t border-slate-200 pt-6 dark:border-slate-800">
        <h2 className="text-lg font-medium">{t.lingkungan.pemantauan}</h2>
        <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">
          {t.lingkungan.pemantauanPetunjuk}
        </p>

        {bolehKelolaTim ? (
          <Form method="post" className="mt-3 flex flex-wrap items-end gap-4">
            <input type="hidden" name="maksud" value="kewajiban" />
            <Kolom label={t.lingkungan.namaKewajiban}>
              <Teks name="nama" required maxLength={200} data-testid="input-nama-kewajiban" />
            </Kolom>
            <Kolom label={t.lingkungan.frekuensi}>
              <Pilihan name="frekuensi" defaultValue="semesteran" data-testid="input-frekuensi">
                {FREKUENSI_PEMANTAUAN.map((f) => (
                  <option key={f} value={f}>
                    {labelFrekuensi[f]}
                  </option>
                ))}
              </Pilihan>
            </Kolom>
            <Kolom label={t.lingkungan.mulaiBerlaku}>
              <Teks type="date" name="mulai" required data-testid="input-mulai-kewajiban" />
            </Kolom>
            <Tombol type="submit" variasi="kedua" data-testid="tombol-tambah-kewajiban">
              {t.lingkungan.tambahKewajiban}
            </Tombol>
          </Form>
        ) : null}

        <div className="mt-4">
          <Tabel
            testId="tabel-kewajiban"
            judulKolom={[
              t.lingkungan.namaKewajiban,
              t.lingkungan.frekuensi,
              t.lingkungan.periode,
              t.lingkungan.jatuhTempo,
              t.umum.status,
            ]}
          >
            {laporan.length === 0 ? (
              <BarisKosong kolom={5} pesan={t.lingkungan.belumAdaLaporan} />
            ) : (
              laporan.map((l) => {
                const induk = kewajiban.find((k) => k.id === l.kewajibanId);
                const keadaanL = keadaanLaporan(l, sekarang);
                return (
                  <tr key={l.id}>
                    <Sel>{induk?.nama ?? t.umum.tidakAda}</Sel>
                    <Sel>{induk ? labelFrekuensi[induk.frekuensi] : t.umum.tidakAda}</Sel>
                    <Sel>{l.periode}</Sel>
                    <Sel>
                      <span className="whitespace-nowrap text-xs">
                        {tanggal.format(l.jatuhTempo)}
                      </span>
                    </Sel>
                    <Sel>
                      <span
                        className={
                          keadaanL === "terlambat" ? "text-rose-700 dark:text-rose-400" : ""
                        }
                        data-testid={`laporan-${l.id}`}
                      >
                        {labelLaporan[l.status]}
                      </span>
                    </Sel>
                  </tr>
                );
              })
            )}
          </Tabel>
        </div>
      </section>
    </div>
  );
}
