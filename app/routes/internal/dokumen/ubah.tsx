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
import { STATUS_DOKUMEN } from "~/lib/db/schema/dokumen";
import {
  bolehDisahkan,
  bolehSuntingIsi,
  bolehUbahStatusDokumen,
} from "~/modules/dokumen/penomoran";
import {
  ambilDokumen,
  catatDistribusi,
  catatPengesahan,
  daftarDistribusi,
  daftarVersi,
  tambahVersi,
  ubahDokumen,
  ubahStatusDokumen,
} from "~/modules/dokumen/query";
import {
  skemaDistribusi,
  skemaDokumenUbah,
  skemaPengesahan,
  skemaRevisi,
} from "~/modules/dokumen/validasi";
import { daftarUnitKerja } from "~/modules/organisasi/query";
import { useDataRoot } from "~/root";

import type { Route } from "./+types/ubah";

export async function loader({ request, params, context }: Route.LoaderArgs) {
  const { env } = context.get(cloudflareContext);
  const pengguna = await wajibMasuk(env, request, ["admin", "manajemen", "staf"]);
  const db = buatDb(env);

  const data = await ambilDokumen(db, params.id);
  if (!data) throw new Response("Tidak ditemukan", { status: 404 });

  const [versi, unit, distribusi] = await Promise.all([
    daftarVersi(db, params.id),
    daftarUnitKerja(db),
    daftarDistribusi(db, params.id),
  ]);

  return {
    dokumen: data,
    versi,
    unit,
    distribusi,
    bolehUbah: pengguna.peran === "admin" || pengguna.peran === "manajemen",
    // Pengesahan adalah kewenangan administrator, bukan seluruh pengelola.
    bolehSahkan: pengguna.peran === "admin",
  };
}

export async function action({ request, params, context }: Route.ActionArgs) {
  const { env } = context.get(cloudflareContext);
  const pengguna = await wajibMasuk(env, request, ["admin", "manajemen"]);
  const db = buatDb(env);

  const sebelum = await ambilDokumen(db, params.id);
  if (!sebelum) throw new Response("Tidak ditemukan", { status: 404 });

  const formulir = await request.formData();
  const maksud = formulir.get("maksud");

  // --- unggah revisi ---
  if (maksud === "revisi") {
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

    const hasil = skemaRevisi.safeParse(Object.fromEntries(formulir));
    if (!hasil.success) return { galat: hasil.error.issues[0]?.message ?? "Data tidak valid" };

    const kunci = buatKunci("dokumen", params.id, berkas.type);
    const unggahan = await unggahBerkas(env, kunci, berkas);
    const versiBaru = sebelum.versiTerkini + 1;

    await tambahVersi(db, params.id, versiBaru, {
      kunciR2: unggahan.kunci,
      namaBerkas: berkas.name,
      ukuran: unggahan.ukuran,
      tipeMime: unggahan.tipeMime,
      catatanRevisi: hasil.data.catatanRevisi,
      diunggahOleh: pengguna.id,
    });

    await catatAudit(db, {
      userId: pengguna.id,
      aksi: "buat",
      entitas: "versi_dokumen",
      entitasId: params.id,
      ringkasan: `Dokumen ${sebelum.nomor} direvisi menjadi versi ${versiBaru}`,
      request,
    });

    return redirect(`/internal/dokumen/${params.id}?revisi=1`);
  }

  // --- pengesahan ---
  if (maksud === "sahkan") {
    if (pengguna.peran !== "admin") throw new Response("Akses ditolak", { status: 403 });

    const galat = bolehDisahkan(sebelum.status, sebelum.versiTerkini);
    if (galat) return { galat };

    const hasil = skemaPengesahan.safeParse(Object.fromEntries(formulir));
    if (!hasil.success) return { galat: hasil.error.issues[0]?.message ?? "Data tidak valid" };

    await catatPengesahan(db, {
      dokumenId: params.id,
      versi: sebelum.versiTerkini,
      disahkanOleh: pengguna.id,
      jabatanId: hasil.data.jabatanId,
      catatan: hasil.data.catatan,
    });
    await ubahStatusDokumen(db, params.id, "disahkan");

    await catatAudit(db, {
      userId: pengguna.id,
      aksi: "ubah",
      entitas: "dokumen",
      entitasId: params.id,
      ringkasan: `Dokumen ${sebelum.nomor} versi ${sebelum.versiTerkini} disahkan`,
      request,
    });

    return redirect(`/internal/dokumen/${params.id}?disahkan=1`);
  }

  // --- distribusi ---
  if (maksud === "distribusi") {
    const hasil = skemaDistribusi.safeParse(Object.fromEntries(formulir));
    if (!hasil.success) return { galat: hasil.error.issues[0]?.message ?? "Data tidak valid" };

    await catatDistribusi(db, params.id, hasil.data.unitKerjaId, sebelum.versiTerkini);
    await catatAudit(db, {
      userId: pengguna.id,
      aksi: "buat",
      entitas: "distribusi_dokumen",
      entitasId: params.id,
      ringkasan: `Salinan terkendali ${sebelum.nomor} didistribusikan`,
      request,
    });

    return redirect(`/internal/dokumen/${params.id}?distribusi=1`);
  }

  // --- ubah data dokumen ---
  const hasil = skemaDokumenUbah.safeParse(Object.fromEntries(formulir));
  if (!hasil.success) return { galat: hasil.error.issues[0]?.message ?? "Data tidak valid" };

  // Dokumen yang sudah disahkan tidak boleh berubah isinya; hanya lewat revisi.
  if (!bolehSuntingIsi(sebelum.status)) return { galat: "sudahDisahkan" as const };

  if (!bolehUbahStatusDokumen(sebelum.status, hasil.data.status)) {
    return { galat: "statusTidakBoleh" as const };
  }

  await ubahDokumen(db, params.id, hasil.data);
  await catatAudit(db, {
    userId: pengguna.id,
    aksi: "ubah",
    entitas: "dokumen",
    entitasId: params.id,
    ringkasan: `Dokumen ${sebelum.nomor}; status ${sebelum.status} → ${hasil.data.status}`,
    request,
  });

  return redirect(`/internal/dokumen/${params.id}?tersimpan=1`);
}

function keTanggalInput(nilai: Date | null): string {
  return nilai ? new Date(nilai).toISOString().slice(0, 10) : "";
}

export default function UbahDokumen({ loaderData, actionData }: Route.ComponentProps) {
  const { t, locale } = useDataRoot();
  const navigation = useNavigation();
  const sedangKirim = navigation.state === "submitting";
  const { dokumen, versi, unit, distribusi, bolehUbah, bolehSahkan } = loaderData;

  const [paramPencarian] = useSearchParams();
  const terkunci = !bolehSuntingIsi(dokumen.status);

  const labelStatus: Record<string, string> = {
    draf: t.dokumen.statusDraf,
    ditinjau: t.dokumen.statusDitinjau,
    disahkan: t.dokumen.statusDisahkan,
    kedaluwarsa: t.dokumen.statusKedaluwarsa,
    ditarik: t.dokumen.statusDitarik,
  };

  const pesanGalat = (() => {
    const kode = actionData?.galat;
    if (!kode) return null;
    const peta: Record<string, string> = {
      sudahDisahkan: t.dokumen.sudahDisahkan,
      statusTidakBoleh: t.dokumen.statusTidakBoleh,
      belumAdaBerkas: t.dokumen.belumAdaBerkas,
      belumDitinjau: t.dokumen.belumDitinjau,
      berkasTipeTidakDiizinkan: t.kontrak.berkasTipeTidakDiizinkan,
      berkasTerlaluBesar: t.kontrak.berkasTerlaluBesar,
      berkasKosong: t.kontrak.berkasKosong,
    };
    return peta[kode] ?? kode;
  })();

  const tanggal = new Intl.DateTimeFormat(locale === "en" ? "en-GB" : "id-ID", {
    dateStyle: "medium",
  });

  return (
    <div className="flex flex-col gap-8">
      <div>
        <Link
          to="/internal/dokumen"
          className="text-sm text-sky-700 underline dark:text-sky-400"
        >
          ← {t.dokumen.judul}
        </Link>
        <h1 className="mt-2 text-2xl font-semibold" data-testid="judul-halaman">
          {dokumen.judul}
        </h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          <code data-testid="nomor-dokumen">{dokumen.nomor}</code> ·{" "}
          <span data-testid="status-dokumen">{labelStatus[dokumen.status]}</span> ·{" "}
          {dokumen.versiTerkini > 0 ? `v${dokumen.versiTerkini}` : t.dokumen.belumAdaVersi}
        </p>
      </div>

      <PesanGalat pesan={pesanGalat} />
      {paramPencarian.has("tersimpan") && !pesanGalat ? (
        <PesanBerhasil pesan={t.umum.berhasilDisimpan} />
      ) : null}
      {paramPencarian.has("revisi") ? (
        <PesanBerhasil pesan={t.dokumen.revisiTersimpan} />
      ) : null}
      {paramPencarian.has("disahkan") ? (
        <PesanBerhasil pesan={t.dokumen.berhasilDisahkan} />
      ) : null}
      {paramPencarian.has("distribusi") ? (
        <PesanBerhasil pesan={t.dokumen.berhasilDidistribusikan} />
      ) : null}

      {terkunci ? (
        <p
          className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:bg-amber-950 dark:text-amber-200"
          data-testid="peringatan-terkunci"
        >
          {t.dokumen.terkunci}
        </p>
      ) : null}

      {bolehUbah ? (
        <Form method="post" className="flex max-w-2xl flex-col gap-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Kolom label={t.dokumen.judulDokumen}>
              <Teks
                name="judul"
                required
                disabled={terkunci}
                defaultValue={dokumen.judul}
                data-testid="input-judul"
              />
            </Kolom>
            <Kolom label={t.umum.namaInggris}>
              <Teks name="judulEn" disabled={terkunci} defaultValue={dokumen.judulEn ?? ""} />
            </Kolom>
            <Kolom label={t.dokumen.unitPemilik}>
              <Pilihan
                name="unitKerjaId"
                disabled={terkunci}
                defaultValue={dokumen.unitKerjaId ?? ""}
              >
                <option value="">{t.dokumen.tanpaUnit}</option>
                {unit.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.kode} — {u.nama}
                  </option>
                ))}
              </Pilihan>
            </Kolom>
            <Kolom label={t.umum.status}>
              <Pilihan
                name="status"
                disabled={terkunci}
                defaultValue={dokumen.status}
                data-testid="input-status"
              >
                {STATUS_DOKUMEN.map((s) => (
                  <option key={s} value={s}>
                    {labelStatus[s]}
                  </option>
                ))}
              </Pilihan>
            </Kolom>
            <Kolom label={t.dokumen.tanggalTerbit}>
              <Teks
                type="date"
                name="tanggalTerbit"
                disabled={terkunci}
                defaultValue={keTanggalInput(dokumen.tanggalTerbit)}
              />
            </Kolom>
            <Kolom label={t.dokumen.tanggalTinjauUlang}>
              <Teks
                type="date"
                name="tanggalTinjauUlang"
                disabled={terkunci}
                defaultValue={keTanggalInput(dokumen.tanggalTinjauUlang)}
              />
            </Kolom>
          </div>

          <Kolom label={t.dokumen.ringkasan}>
            <AreaTeks
              name="ringkasan"
              disabled={terkunci}
              defaultValue={dokumen.ringkasan ?? ""}
              maxLength={2000}
            />
          </Kolom>

          <div>
            <Tombol
              type="submit"
              disabled={sedangKirim || terkunci}
              data-testid="tombol-simpan"
            >
              {sedangKirim ? t.umum.sedangMenyimpan : t.umum.simpanPerubahan}
            </Tombol>
          </div>
        </Form>
      ) : null}

      {/* ------------------------------------------------------------ versi */}
      <section className="max-w-2xl border-t border-slate-200 pt-6 dark:border-slate-800">
        <h2 className="text-lg font-medium">{t.dokumen.riwayatVersi}</h2>
        <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">
          {t.dokumen.versiPetunjuk}
        </p>

        {bolehUbah ? (
          <Form
            method="post"
            encType="multipart/form-data"
            className="mt-3 flex flex-col gap-4"
            data-testid="form-revisi"
          >
            <input type="hidden" name="maksud" value="revisi" />
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
            <Kolom label={t.dokumen.catatanRevisi}>
              <Teks name="catatanRevisi" maxLength={500} data-testid="input-catatan" />
            </Kolom>
            <div>
              <Tombol type="submit" variasi="kedua" data-testid="tombol-unggah">
                {t.dokumen.unggahRevisi}
              </Tombol>
            </div>
          </Form>
        ) : null}

        <div className="mt-4">
          <Tabel
            testId="tabel-versi"
            judulKolom={[
              t.dokumen.versi,
              t.kontrak.berkas,
              t.dokumen.catatanRevisi,
              t.jejakAudit.waktu,
              t.umum.aksi,
            ]}
          >
            {versi.length === 0 ? (
              <BarisKosong kolom={5} pesan={t.dokumen.belumAdaVersi} />
            ) : (
              versi.map((v) => (
                <tr key={v.id}>
                  <Sel>v{v.versi}</Sel>
                  <Sel>{v.namaBerkas}</Sel>
                  <Sel>
                    <span className="text-xs">{v.catatanRevisi ?? t.umum.tidakAda}</span>
                  </Sel>
                  <Sel>
                    <span className="whitespace-nowrap text-xs">
                      {tanggal.format(v.createdAt)}
                    </span>
                  </Sel>
                  <Sel>
                    <a
                      href={`/internal/berkas/versi-dokumen/${v.id}`}
                      className="text-sky-700 underline dark:text-sky-400"
                      data-testid={`unduh-v${v.versi}`}
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

      {/* ------------------------------------------------------- pengesahan */}
      {bolehSahkan ? (
        <section className="max-w-2xl border-t border-slate-200 pt-6 dark:border-slate-800">
          <h2 className="text-lg font-medium">{t.dokumen.pengesahan}</h2>
          <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">
            {t.dokumen.pengesahanPetunjuk}
          </p>
          <Form method="post" className="mt-3 flex flex-col gap-4">
            <input type="hidden" name="maksud" value="sahkan" />
            <Kolom label={t.dokumen.catatanPengesahan}>
              <Teks name="catatan" maxLength={500} />
            </Kolom>
            <div>
              <Tombol type="submit" disabled={sedangKirim} data-testid="tombol-sahkan">
                {t.dokumen.sahkan}
              </Tombol>
            </div>
          </Form>
        </section>
      ) : null}

      {/* ------------------------------------------------------- distribusi */}
      {bolehUbah ? (
        <section className="max-w-2xl border-t border-slate-200 pt-6 dark:border-slate-800">
          <h2 className="text-lg font-medium">{t.dokumen.distribusi}</h2>
          <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">
            {t.dokumen.distribusiPetunjuk}
          </p>

          <Form method="post" className="mt-3 flex flex-wrap items-end gap-4">
            <input type="hidden" name="maksud" value="distribusi" />
            <Kolom label={t.dokumen.unitPenerima}>
              <Pilihan name="unitKerjaId" required data-testid="input-unit-distribusi">
                {unit.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.kode} — {u.nama}
                  </option>
                ))}
              </Pilihan>
            </Kolom>
            <Tombol type="submit" variasi="kedua" data-testid="tombol-distribusi">
              {t.dokumen.catatDistribusi}
            </Tombol>
          </Form>

          <div className="mt-4">
            <Tabel
              testId="tabel-distribusi"
              judulKolom={[t.dokumen.unitPenerima, t.dokumen.versi, t.jejakAudit.waktu]}
            >
              {distribusi.length === 0 ? (
                <BarisKosong kolom={3} pesan={t.umum.tidakAdaData} />
              ) : (
                distribusi.map((d) => (
                  <tr key={d.id}>
                    <Sel>
                      {d.kodeUnit} — {d.namaUnit}
                    </Sel>
                    <Sel>v{d.versi}</Sel>
                    <Sel>
                      <span className="whitespace-nowrap text-xs">
                        {tanggal.format(d.createdAt)}
                      </span>
                    </Sel>
                  </tr>
                ))
              )}
            </Tabel>
          </div>
        </section>
      ) : null}
    </div>
  );
}
