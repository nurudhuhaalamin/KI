import { Form, Link, redirect, useNavigation, useSearchParams } from "react-router";

import { Kolom, PesanBerhasil, PesanGalat, Teks, Tombol } from "~/components/internal/kolom";
import { BarisKosong, Sel, Tabel } from "~/components/internal/tabel";
import { KolomDinamis } from "~/components/kolom-dinamis";
import { catatAudit } from "~/lib/audit";
import { wajibMasuk } from "~/lib/auth/sesi";
import { buatKunci, periksaBerkas, unggahBerkas } from "~/lib/berkas/r2";
import { cloudflareContext } from "~/lib/context";
import { buatDb } from "~/lib/db";
import { kirimNotifikasi } from "~/lib/notifikasi";
import { bolehDiajukan, bolehSuntingPermohonan, kemajuan } from "~/modules/perizinan/alur";
import { bacaDefinisi, bacaIsian, validasiIsian } from "~/modules/perizinan/formulir";
import {
  ajukanPermohonan,
  ambilPermohonan,
  daftarBerkasPermohonan,
  daftarKeputusan,
  daftarTahap,
  penggunaBerperan,
  tambahBerkasPermohonan,
  ubahIsiPermohonan,
} from "~/modules/perizinan/query";
import { skemaPermohonanUbah } from "~/modules/perizinan/validasi";
import { useDataRoot } from "~/root";

import type { Route } from "./+types/rincian";

/**
 * Permohonan milik perusahaan lain dijawab 404, bukan 403 — supaya keberadaan
 * permohonan orang lain tidak bisa disimpulkan dari kode statusnya.
 */
async function ambilMilikSendiri(
  db: ReturnType<typeof buatDb>,
  id: string,
  tenantId: string | null,
) {
  const data = await ambilPermohonan(db, id);
  if (!data || !tenantId || data.permohonan.tenantId !== tenantId) {
    throw new Response("Tidak ditemukan", { status: 404 });
  }
  return data;
}

export async function loader({ request, params, context }: Route.LoaderArgs) {
  const { env } = context.get(cloudflareContext);
  const pengguna = await wajibMasuk(env, request, ["tenant"]);
  const db = buatDb(env);

  const data = await ambilMilikSendiri(db, params.id, pengguna.tenantId);
  const [tahap, keputusan, berkas] = await Promise.all([
    daftarTahap(db, data.permohonan.jenisIzinId),
    daftarKeputusan(db, params.id),
    daftarBerkasPermohonan(db, params.id),
  ]);

  return {
    data,
    keputusan,
    berkas,
    kemajuan: kemajuan(tahap, data.permohonan.tahapAktif, data.permohonan.status),
    definisi: bacaDefinisi(data.definisiKolom),
    isian: bacaIsian(data.permohonan.isian),
    bolehSunting: bolehSuntingPermohonan(data.permohonan.status),
    bolehAjukan: bolehDiajukan(data.permohonan.status),
  };
}

export async function action({ request, params, context }: Route.ActionArgs) {
  const { env } = context.get(cloudflareContext);
  const pengguna = await wajibMasuk(env, request, ["tenant"]);
  const db = buatDb(env);

  const data = await ambilMilikSendiri(db, params.id, pengguna.tenantId);
  const formulir = await request.formData();
  const maksud = formulir.get("maksud");

  // --- unggah lampiran ---
  if (maksud === "lampiran") {
    if (!bolehSuntingPermohonan(data.permohonan.status)) {
      return { galat: "terkunciDiproses" as const };
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

    const kunci = buatKunci("permohonan", params.id, berkas.type);
    const unggahan = await unggahBerkas(env, kunci, berkas);
    await tambahBerkasPermohonan(db, params.id, {
      namaBerkas: berkas.name,
      kunciR2: unggahan.kunci,
      ukuran: unggahan.ukuran,
      tipeMime: unggahan.tipeMime,
      diunggahOleh: pengguna.id,
    });

    return redirect(`/portal/permohonan/${params.id}?lampiran=1`);
  }

  // --- ajukan ---
  if (maksud === "ajukan") {
    if (!bolehDiajukan(data.permohonan.status)) {
      return { galat: "galatBelumBolehDiajukan" as const };
    }

    const tahap = await daftarTahap(db, data.permohonan.jenisIzinId);
    // Tanpa tahap, permohonan akan masuk ke antrean yang tidak bisa diputus siapa pun.
    if (tahap.length === 0) return { galat: "tanpaTahap" as const };

    await ajukanPermohonan(db, params.id, data.slaHari);
    await catatAudit(db, {
      userId: pengguna.id,
      aksi: "ubah",
      entitas: "permohonan",
      entitasId: params.id,
      ringkasan: `Permohonan ${data.permohonan.nomor} diajukan`,
      request,
    });

    // Pemutus tahap pertama yang perlu tahu ada berkas masuk.
    const peran = tahap[0]?.peranPemutus ?? "staf";
    const penerima = await penggunaBerperan(db, peran);
    await kirimNotifikasi(
      db,
      penerima.map((p) => p.id),
      {
        judul: "Permohonan izin baru",
        pesan: `${data.permohonan.nomor} — ${data.permohonan.judul} menunggu diproses.`,
        tautan: `/internal/permohonan/${params.id}`,
      },
    );

    return redirect(`/portal/permohonan/${params.id}?diajukan=1`);
  }

  // --- simpan perbaikan ---
  if (!bolehSuntingPermohonan(data.permohonan.status)) {
    return { galat: "terkunciDiproses" as const };
  }

  const isiFormulir = Object.fromEntries(formulir);
  const hasil = skemaPermohonanUbah.safeParse(isiFormulir);
  if (!hasil.success) return { galat: hasil.error.issues[0]?.message ?? "Data tidak valid" };

  const isian = validasiIsian(bacaDefinisi(data.definisiKolom), isiFormulir);
  if (!isian.berhasil) return { galatIsian: isian.galat };

  await ubahIsiPermohonan(db, params.id, { judul: hasil.data.judul, isian: isian.nilai });
  await catatAudit(db, {
    userId: pengguna.id,
    aksi: "ubah",
    entitas: "permohonan",
    entitasId: params.id,
    ringkasan: `Permohonan ${data.permohonan.nomor} diperbaiki pemohon`,
    request,
  });

  return redirect(`/portal/permohonan/${params.id}?tersimpan=1`);
}

export default function RincianPermohonan({ loaderData, actionData }: Route.ComponentProps) {
  const { t, locale } = useDataRoot();
  const navigation = useNavigation();
  const sedangKirim = navigation.state === "submitting";
  const {
    data,
    keputusan,
    berkas,
    kemajuan: langkah,
    definisi,
    isian,
    bolehSunting,
    bolehAjukan,
  } = loaderData;
  const [paramPencarian] = useSearchParams();

  const labelStatus: Record<string, string> = {
    draf: t.perizinan.statusDraf,
    diajukan: t.perizinan.statusDiajukan,
    diproses: t.perizinan.statusDiproses,
    "perlu-revisi": t.perizinan.statusPerluRevisi,
    terbit: t.perizinan.statusTerbit,
    ditolak: t.perizinan.statusDitolak,
    batal: t.perizinan.statusBatal,
  };
  const labelKeputusan: Record<string, string> = {
    setuju: t.perizinan.keputusanSetuju,
    tolak: t.perizinan.keputusanTolak,
    revisi: t.perizinan.keputusanRevisi,
  };
  const labelKeadaan: Record<string, string> = {
    selesai: t.perizinan.keadaanSelesai,
    berjalan: t.perizinan.keadaanBerjalan,
    menunggu: t.perizinan.keadaanMenunggu,
  };

  const petaGalat: Record<string, string> = {
    terkunciDiproses: t.perizinan.terkunciDiproses,
    galatBelumBolehDiajukan: t.perizinan.galatBelumBolehDiajukan,
    tanpaTahap: t.perizinan.galatTanpaTahap,
    berkasTipeTidakDiizinkan: t.kontrak.berkasTipeTidakDiizinkan,
    berkasTerlaluBesar: t.kontrak.berkasTerlaluBesar,
    berkasKosong: t.kontrak.berkasKosong,
  };
  const petaGalatIsian: Record<string, string> = {
    wajib: t.perizinan.galatWajib,
    bukanAngka: t.perizinan.galatBukanAngka,
    bukanTanggal: t.perizinan.galatBukanTanggal,
    diLuarPilihan: t.perizinan.galatDiLuarPilihan,
    terlaluPanjang: t.perizinan.galatTerlaluPanjang,
  };

  const galatIsian = actionData && "galatIsian" in actionData ? actionData.galatIsian : null;
  const kodeGalat = actionData && "galat" in actionData ? actionData.galat : null;
  const pesanGalat = kodeGalat
    ? (petaGalat[kodeGalat] ?? kodeGalat)
    : galatIsian
      ? galatIsian
          .map((g) => {
            const label = definisi.find((d) => d.nama === g.kolom)?.label ?? g.kolom;
            return `${label}: ${petaGalatIsian[g.sebab]}`;
          })
          .join("; ")
      : null;

  const tanggal = new Intl.DateTimeFormat(locale === "en" ? "en-GB" : "id-ID", {
    dateStyle: "medium",
  });

  return (
    <div className="flex flex-col gap-8">
      <div>
        <Link
          to="/portal/permohonan"
          className="text-sm text-sky-700 underline dark:text-sky-400"
        >
          ← {t.perizinan.judulPermohonan}
        </Link>
        <h1 className="mt-2 text-2xl font-semibold" data-testid="judul-halaman">
          {data.permohonan.judul}
        </h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          <code data-testid="nomor-permohonan">{data.permohonan.nomor}</code> ·{" "}
          <span data-testid="status-permohonan">{labelStatus[data.permohonan.status]}</span>
          {data.permohonan.tenggat ? ` · ${tanggal.format(data.permohonan.tenggat)}` : ""}
        </p>
      </div>

      <PesanGalat pesan={pesanGalat} />
      {paramPencarian.has("tersimpan") && !pesanGalat ? (
        <PesanBerhasil pesan={t.umum.berhasilDisimpan} />
      ) : null}
      {paramPencarian.has("diajukan") ? (
        <PesanBerhasil pesan={t.perizinan.statusDiajukan} />
      ) : null}
      {paramPencarian.has("dibuat") ? (
        <PesanBerhasil pesan={t.umum.berhasilDitambahkan} />
      ) : null}
      {paramPencarian.has("lampiran") ? (
        <PesanBerhasil pesan={t.umum.berhasilDisimpan} />
      ) : null}

      {data.permohonan.status === "perlu-revisi" ? (
        <p
          className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:bg-amber-950 dark:text-amber-200"
          data-testid="peringatan-revisi"
        >
          {t.perizinan.perluDiperbaiki}
        </p>
      ) : null}
      {!bolehSunting ? (
        <p
          className="rounded-md bg-slate-100 px-3 py-2 text-sm text-slate-700 dark:bg-slate-900 dark:text-slate-300"
          data-testid="peringatan-terkunci"
        >
          {t.perizinan.terkunciDiproses}
        </p>
      ) : null}

      {/* --------------------------------------------------------- kemajuan */}
      <ol className="flex flex-col gap-2" data-testid="daftar-tahap">
        {langkah.map((s) => (
          <li
            key={s.id}
            className="flex items-center justify-between rounded-md border border-slate-200 px-3 py-2 text-sm dark:border-slate-800"
            data-testid={`tahap-${s.urutan}`}
          >
            <span>
              {s.urutan}. {(locale === "en" && s.namaEn) || s.nama}
            </span>
            <span className="text-xs text-slate-600 dark:text-slate-400">
              {labelKeadaan[s.keadaan]}
            </span>
          </li>
        ))}
      </ol>

      {/* ----------------------------------------------------------- isian */}
      <Form method="post" className="flex max-w-2xl flex-col gap-4">
        <Kolom label={t.perizinan.judulPengajuan}>
          <Teks
            name="judul"
            defaultValue={data.permohonan.judul}
            disabled={!bolehSunting}
            maxLength={200}
            data-testid="input-judul"
          />
        </Kolom>

        <KolomDinamis
          definisi={definisi}
          nilai={isian}
          locale={locale}
          nonaktif={!bolehSunting}
        />

        <div className="flex flex-wrap gap-3">
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
            {t.perizinan.ajukan}
          </Tombol>
        </Form>
      ) : null}

      {/* --------------------------------------------------------- lampiran */}
      <section className="max-w-2xl border-t border-slate-200 pt-6 dark:border-slate-800">
        <h2 className="text-lg font-medium">{t.perizinan.lampiran}</h2>

        {bolehSunting ? (
          <Form
            method="post"
            encType="multipart/form-data"
            className="mt-3 flex flex-col gap-4"
            data-testid="form-lampiran"
          >
            <input type="hidden" name="maksud" value="lampiran" />
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
                {t.perizinan.unggahLampiran}
              </Tombol>
            </div>
          </Form>
        ) : null}

        <div className="mt-4">
          <Tabel
            testId="tabel-lampiran"
            judulKolom={[t.kontrak.berkas, t.jejakAudit.waktu, t.umum.aksi]}
          >
            {berkas.length === 0 ? (
              <BarisKosong kolom={3} pesan={t.umum.tidakAdaData} />
            ) : (
              berkas.map((b) => (
                <tr key={b.id}>
                  <Sel>{b.namaBerkas}</Sel>
                  <Sel>
                    <span className="whitespace-nowrap text-xs">
                      {tanggal.format(b.createdAt)}
                    </span>
                  </Sel>
                  <Sel>
                    <a
                      href={`/internal/berkas/berkas-permohonan/${b.id}`}
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

      {/* ---------------------------------------------------------- riwayat */}
      <section className="max-w-2xl border-t border-slate-200 pt-6 dark:border-slate-800">
        <h2 className="text-lg font-medium">{t.perizinan.riwayatKeputusan}</h2>
        <div className="mt-3">
          <Tabel
            testId="tabel-keputusan"
            judulKolom={[
              t.perizinan.tahapBerjalan,
              t.perizinan.putuskan,
              t.perizinan.catatanKeputusan,
              t.jejakAudit.waktu,
            ]}
          >
            {keputusan.length === 0 ? (
              <BarisKosong kolom={4} pesan={t.perizinan.belumAdaKeputusan} />
            ) : (
              keputusan.map((k) => (
                <tr key={k.id}>
                  <Sel>{k.urutanTahap}</Sel>
                  <Sel>{labelKeputusan[k.keputusan]}</Sel>
                  <Sel>
                    <span className="text-xs">{k.catatan ?? t.umum.tidakAda}</span>
                  </Sel>
                  <Sel>
                    <span className="whitespace-nowrap text-xs">
                      {tanggal.format(k.createdAt)}
                    </span>
                  </Sel>
                </tr>
              ))
            )}
          </Tabel>
        </div>
      </section>
    </div>
  );
}
