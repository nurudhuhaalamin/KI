import { Form, Link, redirect, useNavigation, useSearchParams } from "react-router";

import {
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
import { cloudflareContext } from "~/lib/context";
import { buatDb } from "~/lib/db";
import { KEPUTUSAN } from "~/lib/db/schema/perizinan";
import { kirimNotifikasi } from "~/lib/notifikasi";
import { kemajuan, periksaKeputusan, terapkanKeputusan } from "~/modules/perizinan/alur";
import { bacaDefinisi, bacaIsian, ringkasJawaban } from "~/modules/perizinan/formulir";
import {
  ambilPermohonan,
  catatKeputusan,
  daftarBerkasPermohonan,
  daftarKeputusan,
  daftarTahap,
  ubahStatusPermohonan,
} from "~/modules/perizinan/query";
import { skemaKeputusan } from "~/modules/perizinan/validasi";
import { useDataRoot } from "~/root";

import type { Route } from "./+types/ubah";

export async function loader({ request, params, context }: Route.LoaderArgs) {
  const { env } = context.get(cloudflareContext);
  const pengguna = await wajibMasuk(env, request, ["admin", "manajemen", "staf"]);
  const db = buatDb(env);

  const data = await ambilPermohonan(db, params.id);
  if (!data) throw new Response("Tidak ditemukan", { status: 404 });

  const [tahap, keputusan, berkas] = await Promise.all([
    daftarTahap(db, data.permohonan.jenisIzinId),
    daftarKeputusan(db, params.id),
    daftarBerkasPermohonan(db, params.id),
  ]);

  // Tombol putusan hanya ditampilkan bila memang berwenang — dan diperiksa lagi
  // di action, karena menyembunyikan tombol bukan pengamanan.
  const izin = periksaKeputusan(
    data.permohonan.status,
    data.permohonan.tahapAktif,
    tahap,
    pengguna,
  );

  return {
    data,
    tahap,
    keputusan,
    berkas,
    bolehMemutus: izin.boleh,
    kemajuan: kemajuan(tahap, data.permohonan.tahapAktif, data.permohonan.status),
    jawaban: ringkasJawaban(bacaDefinisi(data.definisiKolom), bacaIsian(data.permohonan.isian)),
  };
}

export async function action({ request, params, context }: Route.ActionArgs) {
  const { env } = context.get(cloudflareContext);
  const pengguna = await wajibMasuk(env, request, ["admin", "manajemen", "staf"]);
  const db = buatDb(env);

  const data = await ambilPermohonan(db, params.id);
  if (!data) throw new Response("Tidak ditemukan", { status: 404 });

  const hasil = skemaKeputusan.safeParse(Object.fromEntries(await request.formData()));
  if (!hasil.success) return { galat: hasil.error.issues[0]?.message ?? "Data tidak valid" };

  const tahap = await daftarTahap(db, data.permohonan.jenisIzinId);
  const izin = periksaKeputusan(
    data.permohonan.status,
    data.permohonan.tahapAktif,
    tahap,
    pengguna,
  );
  if (!izin.boleh) return { galat: izin.galat };

  const lanjut = terapkanKeputusan(hasil.data.keputusan, izin.tahap.urutan, tahap.length);

  await catatKeputusan(db, {
    permohonanId: params.id,
    tahapId: izin.tahap.id,
    urutanTahap: izin.tahap.urutan,
    keputusan: hasil.data.keputusan,
    oleh: pengguna.id,
    catatan: hasil.data.catatan,
  });
  await ubahStatusPermohonan(db, params.id, lanjut.status, lanjut.tahapAktif, lanjut.selesai);

  await catatAudit(db, {
    userId: pengguna.id,
    aksi: "ubah",
    entitas: "permohonan",
    entitasId: params.id,
    ringkasan: `Permohonan ${data.permohonan.nomor} tahap ${izin.tahap.urutan}: ${hasil.data.keputusan}`,
    request,
  });

  // Pemohon perlu tahu keputusannya tanpa harus membuka halaman terus-menerus.
  if (data.permohonan.diajukanOleh) {
    await kirimNotifikasi(db, [data.permohonan.diajukanOleh], {
      judul: "Keputusan permohonan izin",
      pesan: `${data.permohonan.nomor} — ${data.permohonan.judul}: ${hasil.data.keputusan}`,
      tautan: `/portal/permohonan/${params.id}`,
    });
  }

  return redirect(`/internal/permohonan/${params.id}?diputus=1`);
}

export default function UbahPermohonan({ loaderData, actionData }: Route.ComponentProps) {
  const { t, locale } = useDataRoot();
  const navigation = useNavigation();
  const sedangKirim = navigation.state === "submitting";
  const { data, keputusan, berkas, bolehMemutus, kemajuan: langkah, jawaban } = loaderData;
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

  const kodeGalat = actionData && "galat" in actionData ? actionData.galat : null;
  const petaGalat: Record<string, string> = {
    statusTidakBoleh: t.perizinan.galatStatusTidakBoleh,
    bukanWewenang: t.perizinan.galatBukanWewenang,
    tahapTidakDitemukan: t.perizinan.galatTahapTidakDitemukan,
    tanpaTahap: t.perizinan.galatTanpaTahap,
  };
  const pesanGalat = kodeGalat ? (petaGalat[kodeGalat] ?? kodeGalat) : null;

  const tanggal = new Intl.DateTimeFormat(locale === "en" ? "en-GB" : "id-ID", {
    dateStyle: "medium",
  });

  return (
    <div className="flex flex-col gap-8">
      <div>
        <Link
          to="/internal/permohonan"
          className="text-sm text-sky-700 underline dark:text-sky-400"
        >
          ← {t.perizinan.judulPermohonan}
        </Link>
        <h1 className="mt-2 text-2xl font-semibold" data-testid="judul-halaman">
          {data.permohonan.judul}
        </h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          <code data-testid="nomor-permohonan">{data.permohonan.nomor}</code> ·{" "}
          <span data-testid="status-permohonan">{labelStatus[data.permohonan.status]}</span> ·{" "}
          {data.namaTenant}
        </p>
      </div>

      <PesanGalat pesan={pesanGalat} />
      {paramPencarian.has("diputus") && !pesanGalat ? (
        <PesanBerhasil pesan={t.umum.berhasilDisimpan} />
      ) : null}

      {/* --------------------------------------------------------- kemajuan */}
      <section className="max-w-2xl">
        <h2 className="text-lg font-medium">{t.perizinan.tahap}</h2>
        <ol className="mt-3 flex flex-col gap-2" data-testid="daftar-tahap">
          {langkah.length === 0 ? (
            <li className="text-sm text-slate-500 dark:text-slate-400">
              {t.perizinan.galatTanpaTahap}
            </li>
          ) : (
            langkah.map((s) => (
              <li
                key={s.id}
                className="flex items-center justify-between rounded-md border border-slate-200 px-3 py-2 text-sm dark:border-slate-800"
                data-testid={`tahap-${s.urutan}`}
              >
                <span>
                  {s.urutan}. {s.nama}
                </span>
                <span className="text-xs text-slate-600 dark:text-slate-400">
                  {labelKeadaan[s.keadaan]}
                </span>
              </li>
            ))
          )}
        </ol>
      </section>

      {/* ---------------------------------------------------------- jawaban */}
      <section className="max-w-2xl border-t border-slate-200 pt-6 dark:border-slate-800">
        <h2 className="text-lg font-medium">{t.perizinan.judulPengajuan}</h2>
        <dl className="mt-3 grid gap-3 sm:grid-cols-2" data-testid="daftar-jawaban">
          {jawaban.map((j) => (
            <div key={j.label}>
              <dt className="text-xs text-slate-500 dark:text-slate-400">{j.label}</dt>
              <dd className="text-sm">{j.nilai ?? t.umum.tidakAda}</dd>
            </div>
          ))}
        </dl>
      </section>

      {/* --------------------------------------------------------- lampiran */}
      <section className="max-w-2xl border-t border-slate-200 pt-6 dark:border-slate-800">
        <h2 className="text-lg font-medium">{t.perizinan.lampiran}</h2>
        <div className="mt-3">
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

      {/* -------------------------------------------------------- keputusan */}
      {bolehMemutus ? (
        <section className="max-w-2xl border-t border-slate-200 pt-6 dark:border-slate-800">
          <h2 className="text-lg font-medium">{t.perizinan.putuskan}</h2>
          <Form method="post" className="mt-3 flex flex-col gap-4" data-testid="form-keputusan">
            <div className="grid gap-4 sm:grid-cols-2">
              <Kolom label={t.perizinan.putuskan}>
                <Pilihan name="keputusan" defaultValue="setuju" data-testid="input-keputusan">
                  {KEPUTUSAN.map((k) => (
                    <option key={k} value={k}>
                      {labelKeputusan[k]}
                    </option>
                  ))}
                </Pilihan>
              </Kolom>
              <Kolom label={t.perizinan.catatanKeputusan}>
                <Teks name="catatan" maxLength={1000} data-testid="input-catatan" />
              </Kolom>
            </div>
            <div>
              <Tombol type="submit" disabled={sedangKirim} data-testid="tombol-putuskan">
                {sedangKirim ? t.umum.sedangMenyimpan : t.perizinan.putuskan}
              </Tombol>
            </div>
          </Form>
        </section>
      ) : null}

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
