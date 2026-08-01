import { Form, Link, redirect, useNavigation, useSearchParams } from "react-router";

import {
  AreaTeks,
  Kolom,
  PesanBerhasil,
  PesanGalat,
  Teks,
  Tombol,
} from "~/components/internal/kolom";
import { BarisKosong, Sel, Tabel } from "~/components/internal/tabel";
import { catatAudit } from "~/lib/audit";
import { wajibMasuk } from "~/lib/auth/sesi";
import { buatKunci, periksaBerkas, unggahBerkas } from "~/lib/berkas/r2";
import { cloudflareContext } from "~/lib/context";
import { buatDb } from "~/lib/db";
import { kirimNotifikasi } from "~/lib/notifikasi";
import { keadaanLaporan } from "~/modules/lingkungan/pemantauan";
import {
  ajukanDokumenLingkungan,
  ambilDokumenLingkungan,
  ambilKeputusan,
  daftarBerkasLingkungan,
  daftarCatatan,
  daftarKewajiban,
  daftarLaporan,
  kirimLaporan,
  penggunaBerperanLingkungan,
  segarkanLaporan,
  tambahBerkasLingkungan,
  ubahDokumenLingkungan,
} from "~/modules/lingkungan/query";
import { bolehDiajukan, bolehSuntingPengajuan } from "~/modules/lingkungan/tahapan";
import { skemaDokumenLingkunganUbah, skemaLaporan } from "~/modules/lingkungan/validasi";
import { useDataRoot } from "~/root";

import type { Route } from "./+types/rincian";

/**
 * Dokumen milik perusahaan lain dijawab 404, bukan 403 — supaya keberadaannya
 * tidak bisa disimpulkan dari kode statusnya.
 */
async function ambilMilikSendiri(
  db: ReturnType<typeof buatDb>,
  id: string,
  tenantId: string | null,
) {
  const data = await ambilDokumenLingkungan(db, id);
  if (!data || !tenantId || data.dokumen.tenantId !== tenantId) {
    throw new Response("Tidak ditemukan", { status: 404 });
  }
  return data;
}

export async function loader({ request, params, context }: Route.LoaderArgs) {
  const { env } = context.get(cloudflareContext);
  const pengguna = await wajibMasuk(env, request, ["tenant"]);
  const db = buatDb(env);

  const data = await ambilMilikSendiri(db, params.id, pengguna.tenantId);
  const kewajiban = await daftarKewajiban(db, params.id);
  await segarkanLaporan(db, kewajiban);

  const [catatan, berkas, keputusan, laporan] = await Promise.all([
    daftarCatatan(db, params.id),
    daftarBerkasLingkungan(db, params.id),
    ambilKeputusan(db, params.id),
    daftarLaporan(
      db,
      kewajiban.map((k) => k.id),
    ),
  ]);

  return {
    data,
    catatan,
    berkas,
    keputusan,
    kewajiban,
    laporan,
    bolehSunting: bolehSuntingPengajuan(data.dokumen.status),
    bolehAjukan: bolehDiajukan(data.dokumen.status),
  };
}

export async function action({ request, params, context }: Route.ActionArgs) {
  const { env } = context.get(cloudflareContext);
  const pengguna = await wajibMasuk(env, request, ["tenant"]);
  const db = buatDb(env);

  const data = await ambilMilikSendiri(db, params.id, pengguna.tenantId);
  const formulir = await request.formData();
  const maksud = String(formulir.get("maksud") ?? "");

  // --- unggah berkas pengajuan atau perbaikan ---
  if (maksud === "berkas") {
    if (!bolehSuntingPengajuan(data.dokumen.status)) {
      return { galat: "terkunciDiperiksa" as const };
    }

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
      // Berkas yang masuk setelah dikembalikan pemeriksa adalah perbaikan,
      // bukan pengajuan awal — pemeriksa perlu bisa membedakannya.
      peran: data.dokumen.status === "draf" ? "pengajuan" : "perbaikan",
      namaBerkas: berkas.name,
      kunciR2: unggahan.kunci,
      ukuran: unggahan.ukuran,
      tipeMime: unggahan.tipeMime,
      diunggahOleh: pengguna.id,
    });

    return redirect(`/portal/lingkungan/${params.id}?berkas=1`);
  }

  // --- kirim laporan pemantauan ---
  if (maksud === "laporan") {
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

    const hasil = skemaLaporan.safeParse(Object.fromEntries(formulir));
    if (!hasil.success) return { galat: hasil.error.issues[0]?.message ?? "Data tidak valid" };

    const kunci = buatKunci("lingkungan", params.id, berkas.type);
    const unggahan = await unggahBerkas(env, kunci, berkas);
    const berkasId = await tambahBerkasLingkungan(db, params.id, {
      peran: "pengajuan",
      namaBerkas: berkas.name,
      kunciR2: unggahan.kunci,
      ukuran: unggahan.ukuran,
      tipeMime: unggahan.tipeMime,
      diunggahOleh: pengguna.id,
    });

    await kirimLaporan(db, hasil.data.laporanId, {
      berkasId,
      dikirimOleh: pengguna.id,
      catatan: hasil.data.catatan,
    });

    return redirect(`/portal/lingkungan/${params.id}?laporan=1`);
  }

  // --- ajukan atau ajukan ulang ---
  if (maksud === "ajukan") {
    if (!bolehDiajukan(data.dokumen.status)) {
      return { galat: "galatStatusTidakBoleh" as const };
    }

    const berkas = await daftarBerkasLingkungan(db, params.id);
    // Tanpa berkas, tidak ada yang bisa diperiksa siapa pun.
    if (berkas.length === 0) return { galat: "galatBelumAdaBerkas" as const };

    await ajukanDokumenLingkungan(db, params.id);
    await catatAudit(db, {
      userId: pengguna.id,
      aksi: "ubah",
      entitas: "dokumen_lingkungan",
      entitasId: params.id,
      ringkasan: `Dokumen lingkungan ${data.dokumen.nomor} diajukan`,
      request,
    });

    const penerima = await penggunaBerperanLingkungan(db);
    await kirimNotifikasi(
      db,
      penerima.map((p) => p.id),
      {
        judul: "Dokumen lingkungan masuk",
        pesan: `${data.dokumen.nomor} — ${data.dokumen.judul} menunggu pemeriksaan.`,
        tautan: `/internal/lingkungan/${params.id}`,
      },
    );

    return redirect(`/portal/lingkungan/${params.id}?diajukan=1`);
  }

  // --- simpan isi ---
  if (!bolehSuntingPengajuan(data.dokumen.status)) {
    return { galat: "terkunciDiperiksa" as const };
  }

  const hasil = skemaDokumenLingkunganUbah.safeParse(Object.fromEntries(formulir));
  if (!hasil.success) return { galat: hasil.error.issues[0]?.message ?? "Data tidak valid" };

  await ubahDokumenLingkungan(db, params.id, hasil.data);
  await catatAudit(db, {
    userId: pengguna.id,
    aksi: "ubah",
    entitas: "dokumen_lingkungan",
    entitasId: params.id,
    ringkasan: `Dokumen lingkungan ${data.dokumen.nomor} diperbaiki pemohon`,
    request,
  });

  return redirect(`/portal/lingkungan/${params.id}?tersimpan=1`);
}

export default function RincianLingkunganTenant({
  loaderData,
  actionData,
}: Route.ComponentProps) {
  const { t, locale } = useDataRoot();
  const navigation = useNavigation();
  const sedangKirim = navigation.state === "submitting";
  const { data, catatan, berkas, keputusan, kewajiban, laporan, bolehSunting, bolehAjukan } =
    loaderData;
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
    terkunciDiperiksa: t.lingkungan.terkunciDiperiksa,
    galatStatusTidakBoleh: t.lingkungan.galatStatusTidakBoleh,
    galatBelumAdaBerkas: t.lingkungan.galatBelumAdaBerkas,
    berkasTipeTidakDiizinkan: t.kontrak.berkasTipeTidakDiizinkan,
    berkasTerlaluBesar: t.kontrak.berkasTerlaluBesar,
    berkasKosong: t.kontrak.berkasKosong,
  };
  const kodeGalat = actionData && "galat" in actionData ? actionData.galat : null;
  const pesanGalat = kodeGalat ? (petaGalat[kodeGalat] ?? kodeGalat) : null;

  const tanggal = new Intl.DateTimeFormat(locale === "en" ? "en-GB" : "id-ID", {
    dateStyle: "medium",
  });

  return (
    <div className="flex flex-col gap-8">
      <div>
        <Link
          to="/portal/lingkungan"
          className="text-sm text-sky-700 underline dark:text-sky-400"
        >
          ← {t.lingkungan.judulTenant}
        </Link>
        <h1 className="mt-2 text-2xl font-semibold" data-testid="judul-halaman">
          {data.dokumen.judul}
        </h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          <code data-testid="nomor-dokumen">{data.dokumen.nomor}</code> ·{" "}
          <span data-testid="status-dokumen">{labelStatus[data.dokumen.status]}</span>
        </p>
      </div>

      <PesanGalat pesan={pesanGalat} />
      {["tersimpan", "berkas", "dibuat", "laporan"].some((k) => paramPencarian.has(k)) &&
      !pesanGalat ? (
        <PesanBerhasil pesan={t.umum.berhasilDisimpan} />
      ) : null}
      {paramPencarian.has("diajukan") ? (
        <PesanBerhasil pesan={t.lingkungan.statusDiajukan} />
      ) : null}

      {data.dokumen.status === "perlu-dilengkapi" ? (
        <p
          className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:bg-amber-950 dark:text-amber-200"
          data-testid="peringatan-lengkapi"
        >
          {t.lingkungan.perluDilengkapi}
        </p>
      ) : null}
      {data.dokumen.status === "perlu-diperbaiki" ? (
        <p
          className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:bg-amber-950 dark:text-amber-200"
          data-testid="peringatan-perbaiki"
        >
          {t.lingkungan.perluDiperbaiki}
        </p>
      ) : null}
      {!bolehSunting ? (
        <p
          className="rounded-md bg-slate-100 px-3 py-2 text-sm text-slate-700 dark:bg-slate-900 dark:text-slate-300"
          data-testid="peringatan-terkunci"
        >
          {t.lingkungan.terkunciDiperiksa}
        </p>
      ) : null}

      {/* ------------------------------------------------------------- isian */}
      <Form method="post" className="flex max-w-2xl flex-col gap-4">
        <Kolom label={t.lingkungan.judulDokumen}>
          <Teks
            name="judul"
            defaultValue={data.dokumen.judul}
            disabled={!bolehSunting}
            maxLength={200}
            data-testid="input-judul"
          />
        </Kolom>
        <Kolom label={t.lingkungan.ringkasanKegiatan}>
          <AreaTeks
            name="ringkasanKegiatan"
            rows={4}
            defaultValue={data.dokumen.ringkasanKegiatan ?? ""}
            disabled={!bolehSunting}
            maxLength={4000}
            data-testid="input-ringkasan"
          />
        </Kolom>
        <div>
          <Tombol
            type="submit"
            disabled={sedangKirim || !bolehSunting}
            data-testid="tombol-simpan"
          >
            {sedangKirim ? t.umum.sedangMenyimpan : t.umum.simpanPerubahan}
          </Tombol>
        </div>
      </Form>

      {bolehAjukan ? (
        <Form method="post" data-testid="form-ajukan">
          <input type="hidden" name="maksud" value="ajukan" />
          <Tombol type="submit" disabled={sedangKirim} data-testid="tombol-ajukan">
            {t.lingkungan.ajukan}
          </Tombol>
        </Form>
      ) : null}

      {/* ------------------------------------------------------------ berkas */}
      <section className="max-w-2xl border-t border-slate-200 pt-6 dark:border-slate-800">
        <h2 className="text-lg font-medium">{t.lingkungan.berkasPengajuan}</h2>

        {bolehSunting ? (
          <Form
            method="post"
            encType="multipart/form-data"
            className="mt-3 flex flex-col gap-4"
            data-testid="form-berkas"
          >
            <input type="hidden" name="maksud" value="berkas" />
            <Kolom label={t.kontrak.berkas} petunjuk={t.kontrak.berkasPetunjuk}>
              <input
                type="file"
                name="berkas"
                required
                accept=".pdf,.jpg,.jpeg,.png"
                data-testid="input-berkas"
                className="w-full text-sm"
              />
            </Kolom>
            <div>
              <Tombol type="submit" variasi="kedua" data-testid="tombol-unggah">
                {t.lingkungan.unggahBerkas}
              </Tombol>
            </div>
          </Form>
        ) : null}

        <div className="mt-4">
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

      {/* ------------------------------------------------------------ temuan */}
      <section className="max-w-2xl border-t border-slate-200 pt-6 dark:border-slate-800">
        <h2 className="text-lg font-medium">{t.lingkungan.temuan}</h2>
        <div className="mt-3">
          <Tabel
            testId="tabel-temuan"
            judulKolom={[
              t.lingkungan.tahapAdministrasi,
              t.lingkungan.aspek,
              t.lingkungan.isiTemuan,
              t.lingkungan.rekomendasi,
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
                    <span className="text-xs">{c.rekomendasi ?? t.umum.tidakAda}</span>
                  </Sel>
                </tr>
              ))
            )}
          </Tabel>
        </div>
      </section>

      {/* --------------------------------------------------------- keputusan */}
      {keputusan ? (
        <section className="max-w-2xl border-t border-slate-200 pt-6 dark:border-slate-800">
          <h2 className="text-lg font-medium">{t.lingkungan.keputusan}</h2>
          <dl className="mt-3 grid gap-3 sm:grid-cols-3">
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
        </section>
      ) : null}

      {/* -------------------------------------------------------- pemantauan */}
      {kewajiban.length > 0 ? (
        <section className="max-w-2xl border-t border-slate-200 pt-6 dark:border-slate-800">
          <h2 className="text-lg font-medium">{t.lingkungan.pemantauan}</h2>
          <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">
            {t.lingkungan.pemantauanPetunjuk}
          </p>

          <div className="mt-4 flex flex-col gap-4">
            {laporan.length === 0 ? (
              <p className="text-sm text-slate-500 dark:text-slate-400">
                {t.lingkungan.belumAdaLaporan}
              </p>
            ) : (
              laporan.map((l) => {
                const induk = kewajiban.find((k) => k.id === l.kewajibanId);
                const keadaan = keadaanLaporan(l, sekarang);
                const belumDikirim = l.status === "belum" || l.status === "ditolak";

                return (
                  <div
                    key={l.id}
                    className="rounded-md border border-slate-200 p-3 dark:border-slate-800"
                    data-testid={`laporan-${l.id}`}
                  >
                    <p className="text-sm font-medium">
                      {induk?.nama ?? t.umum.tidakAda} — {l.periode}
                    </p>
                    <p
                      className={`mt-1 text-xs ${
                        keadaan === "terlambat" ? "text-rose-700 dark:text-rose-400" : ""
                      }`}
                    >
                      {induk ? labelFrekuensi[induk.frekuensi] : ""} · {t.lingkungan.jatuhTempo}
                      : {tanggal.format(l.jatuhTempo)} ·{" "}
                      <span data-testid={`status-laporan-${l.id}`}>
                        {labelLaporan[l.status]}
                      </span>
                    </p>

                    {belumDikirim ? (
                      <Form
                        method="post"
                        encType="multipart/form-data"
                        className="mt-3 flex flex-wrap items-end gap-3"
                      >
                        <input type="hidden" name="maksud" value="laporan" />
                        <input type="hidden" name="laporanId" value={l.id} />
                        <input
                          type="file"
                          name="berkas"
                          required
                          accept=".pdf,.jpg,.jpeg,.png"
                          data-testid={`berkas-laporan-${l.id}`}
                          className="text-sm"
                        />
                        <Tombol
                          type="submit"
                          variasi="kedua"
                          data-testid={`kirim-laporan-${l.id}`}
                        >
                          {t.lingkungan.kirimLaporan}
                        </Tombol>
                      </Form>
                    ) : null}
                  </div>
                );
              })
            )}
          </div>
        </section>
      ) : null}
    </div>
  );
}
