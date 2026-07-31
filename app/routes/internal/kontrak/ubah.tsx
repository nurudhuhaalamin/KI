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
import { buatKunci, periksaBerkas, unggahBerkas } from "~/lib/berkas/r2";
import { cloudflareContext } from "~/lib/context";
import { buatDb } from "~/lib/db";
import { JENIS_KONTRAK, STATUS_KONTRAK } from "~/lib/db/schema/kontrak";
import { daftarKavling, segarkanStatusKavling } from "~/modules/kavling/query";
import { adaTumpangTindih, bolehUbahStatus, periksaTanggal } from "~/modules/kontrak/aturan";
import {
  ambilKontrak,
  catatLampiran,
  daftarLampiran,
  masaKontrakKavling,
  ubahKontrak,
} from "~/modules/kontrak/query";
import { skemaKontrakUbah } from "~/modules/kontrak/validasi";
import { daftarTenantRingkas } from "~/modules/tenant/query";
import { useDataRoot } from "~/root";

import type { Route } from "./+types/ubah";

export async function loader({ request, params, context }: Route.LoaderArgs) {
  const { env } = context.get(cloudflareContext);
  await wajibMasuk(env, request, ["admin"]);
  const db = buatDb(env);

  const data = await ambilKontrak(db, params.id);
  if (!data) throw new Response("Tidak ditemukan", { status: 404 });

  const [tenant, kavling, lampiran] = await Promise.all([
    daftarTenantRingkas(db),
    daftarKavling(db),
    daftarLampiran(db, params.id),
  ]);

  return { kontrak: data, tenant, kavling, lampiran };
}

export async function action({ request, params, context }: Route.ActionArgs) {
  const { env } = context.get(cloudflareContext);
  const pengguna = await wajibMasuk(env, request, ["admin"]);
  const db = buatDb(env);

  const sebelum = await ambilKontrak(db, params.id);
  if (!sebelum) throw new Response("Tidak ditemukan", { status: 404 });

  const formulir = await request.formData();

  // --- unggah lampiran ---
  if (formulir.get("maksud") === "lampiran") {
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

    // Kunci dibuat sistem; nama asli hanya disimpan sebagai metadata tampilan.
    const kunci = buatKunci("kontrak", params.id, berkas.type);
    const hasilUnggah = await unggahBerkas(env, kunci, berkas);

    await catatLampiran(db, {
      kontrakId: params.id,
      namaBerkas: berkas.name,
      kunciR2: hasilUnggah.kunci,
      ukuran: hasilUnggah.ukuran,
      tipeMime: hasilUnggah.tipeMime,
      diunggahOleh: pengguna.id,
    });

    await catatAudit(db, {
      userId: pengguna.id,
      aksi: "buat",
      entitas: "lampiran_kontrak",
      entitasId: params.id,
      ringkasan: `Lampiran ditambahkan pada kontrak ${sebelum.nomor}`,
      request,
    });

    return redirect(`/internal/kontrak/${params.id}?lampiran=1`);
  }

  // --- ubah data kontrak ---
  const hasil = skemaKontrakUbah.safeParse(Object.fromEntries(formulir));
  if (!hasil.success) return { galat: hasil.error.issues[0]?.message ?? "Data tidak valid" };

  if (!bolehUbahStatus(sebelum.status, hasil.data.status)) {
    return { galat: "statusTidakBoleh" as const };
  }

  const galatTanggal = periksaTanggal(
    hasil.data.jenis,
    hasil.data.tanggalMulai,
    hasil.data.tanggalBerakhir,
  );
  if (galatTanggal) return { galat: galatTanggal };

  const kontrakLain = await masaKontrakKavling(db, hasil.data.kavlingId);
  if (adaTumpangTindih(kontrakLain, hasil.data, params.id)) {
    return { galat: "tumpangTindih" as const };
  }

  await ubahKontrak(db, params.id, hasil.data);

  // Status kavling adalah turunan kontrak; segarkan yang lama dan yang baru
  // bila kavlingnya dipindahkan.
  await segarkanStatusKavling(db, hasil.data.kavlingId);
  if (sebelum.kavlingId !== hasil.data.kavlingId) {
    await segarkanStatusKavling(db, sebelum.kavlingId);
  }

  await catatAudit(db, {
    userId: pengguna.id,
    aksi: "ubah",
    entitas: "kontrak",
    entitasId: params.id,
    ringkasan: `Kontrak ${sebelum.nomor}; status ${sebelum.status} → ${hasil.data.status}`,
    request,
  });

  return redirect(`/internal/kontrak/${params.id}?tersimpan=1`);
}

function keTanggalInput(nilai: Date | null): string {
  return nilai ? new Date(nilai).toISOString().slice(0, 10) : "";
}

export default function UbahKontrak({ loaderData, actionData }: Route.ComponentProps) {
  const { t, locale } = useDataRoot();
  const navigation = useNavigation();
  const sedangKirim = navigation.state === "submitting";
  const { kontrak, tenant, kavling, lampiran } = loaderData;

  const [paramPencarian] = useSearchParams();
  const tersimpan = paramPencarian.has("tersimpan");
  const lampiranBaru = paramPencarian.has("lampiran");

  const labelJenis: Record<string, string> = {
    jual: t.kontrak.jenisJual,
    sewa: t.kontrak.jenisSewa,
  };
  const labelStatus: Record<string, string> = {
    draf: t.kontrak.statusDraf,
    aktif: t.kontrak.statusAktif,
    berakhir: t.kontrak.statusBerakhir,
    batal: t.kontrak.statusBatal,
  };

  const pesanGalat = (() => {
    const kode = actionData?.galat;
    if (!kode) return null;
    const peta: Record<string, string> = {
      tumpangTindih: t.kontrak.tumpangTindih,
      tanggalBerakhirWajib: t.kontrak.tanggalBerakhirWajib,
      tanggalTerbalik: t.kontrak.tanggalTerbalik,
      statusTidakBoleh: t.kontrak.statusTidakBoleh,
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
    <div className="flex flex-col gap-6">
      <div>
        <Link
          to="/internal/kontrak"
          className="text-sm text-sky-700 underline dark:text-sky-400"
        >
          ← {t.kontrak.judul}
        </Link>
        <h1 className="mt-2 text-2xl font-semibold" data-testid="judul-halaman">
          {t.kontrak.ubahJudul}
        </h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          <code>{kontrak.nomor}</code>
        </p>
      </div>

      <Form method="post" className="flex max-w-2xl flex-col gap-4">
        <PesanGalat pesan={pesanGalat} />
        {tersimpan && !pesanGalat ? <PesanBerhasil pesan={t.umum.berhasilDisimpan} /> : null}

        <div className="grid gap-4 sm:grid-cols-2">
          <Kolom label={t.kontrak.jenis}>
            <Pilihan name="jenis" defaultValue={kontrak.jenis} data-testid="input-jenis">
              {JENIS_KONTRAK.map((j) => (
                <option key={j} value={j}>
                  {labelJenis[j]}
                </option>
              ))}
            </Pilihan>
          </Kolom>
          <Kolom label={t.kontrak.status}>
            <Pilihan name="status" defaultValue={kontrak.status} data-testid="input-status">
              {STATUS_KONTRAK.map((s) => (
                <option key={s} value={s}>
                  {labelStatus[s]}
                </option>
              ))}
            </Pilihan>
          </Kolom>
          <Kolom label={t.kontrak.tenant}>
            <Pilihan name="tenantId" defaultValue={kontrak.tenantId}>
              {tenant.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.kode} — {p.namaPerusahaan}
                </option>
              ))}
            </Pilihan>
          </Kolom>
          <Kolom label={t.kontrak.kavling}>
            <Pilihan name="kavlingId" defaultValue={kontrak.kavlingId}>
              {kavling.map((k) => (
                <option key={k.id} value={k.id}>
                  {k.kode}
                </option>
              ))}
            </Pilihan>
          </Kolom>
          <Kolom label={t.kontrak.tanggalMulai}>
            <Teks
              type="date"
              name="tanggalMulai"
              required
              defaultValue={keTanggalInput(kontrak.tanggalMulai)}
            />
          </Kolom>
          <Kolom label={t.kontrak.tanggalBerakhir} petunjuk={t.kontrak.tanggalBerakhirPetunjuk}>
            <Teks
              type="date"
              name="tanggalBerakhir"
              defaultValue={keTanggalInput(kontrak.tanggalBerakhir)}
            />
          </Kolom>
          <Kolom label={t.kontrak.nilai}>
            <Teks type="number" name="nilai" min={0} defaultValue={kontrak.nilai} />
          </Kolom>
        </div>

        <div className="flex gap-3">
          <Tombol type="submit" disabled={sedangKirim} data-testid="tombol-simpan">
            {sedangKirim ? t.umum.sedangMenyimpan : t.umum.simpanPerubahan}
          </Tombol>
          <Link to="/internal/kontrak">
            <Tombol type="button" variasi="kedua">
              {t.umum.batal}
            </Tombol>
          </Link>
        </div>
      </Form>

      <div className="max-w-2xl border-t border-slate-200 pt-6 dark:border-slate-800">
        <h2 className="text-lg font-medium">{t.kontrak.lampiran}</h2>
        {lampiranBaru ? <PesanBerhasil pesan={t.umum.berhasilDitambahkan} /> : null}

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
              {t.kontrak.unggahLampiran}
            </Tombol>
          </div>
        </Form>

        <div className="mt-4">
          <Tabel
            testId="tabel-lampiran"
            judulKolom={[t.kontrak.berkas, t.kontrak.ukuran, t.jejakAudit.waktu, t.umum.aksi]}
          >
            {lampiran.length === 0 ? (
              <BarisKosong kolom={4} pesan={t.kontrak.tanpaLampiran} />
            ) : (
              lampiran.map((l) => (
                <tr key={l.id}>
                  <Sel>{l.namaBerkas}</Sel>
                  <Sel>
                    {Math.max(1, Math.round(l.ukuran / 1024)).toLocaleString("id-ID")} KB
                  </Sel>
                  <Sel>
                    <span className="whitespace-nowrap text-xs">
                      {tanggal.format(l.createdAt)}
                    </span>
                  </Sel>
                  <Sel>
                    <a
                      href={`/internal/berkas/lampiran-kontrak/${l.id}`}
                      className="text-sky-700 underline dark:text-sky-400"
                      data-testid={`unduh-${l.id}`}
                    >
                      {t.kontrak.unduh}
                    </a>
                  </Sel>
                </tr>
              ))
            )}
          </Tabel>
        </div>
      </div>
    </div>
  );
}
