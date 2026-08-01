import { Form, Link, redirect, useNavigation, useSearchParams } from "react-router";

import {
  AreaTeks,
  Centang,
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
import { PERAN_PEMUTUS } from "~/lib/db/schema/perizinan";
import { bacaDefinisi } from "~/modules/perizinan/formulir";
import {
  ambilJenisIzin,
  daftarTahap,
  hapusTahap,
  tambahTahap,
  ubahJenisIzin,
} from "~/modules/perizinan/query";
import { skemaJenisIzin, skemaTahap } from "~/modules/perizinan/validasi";
import { daftarUnitKerja } from "~/modules/organisasi/query";
import { useDataRoot } from "~/root";

import type { Route } from "./+types/ubah";

export async function loader({ request, params, context }: Route.LoaderArgs) {
  const { env } = context.get(cloudflareContext);
  await wajibMasuk(env, request, ["admin"]);
  const db = buatDb(env);

  const jenis = await ambilJenisIzin(db, params.id);
  if (!jenis) throw new Response("Tidak ditemukan", { status: 404 });

  const [tahap, unit] = await Promise.all([daftarTahap(db, params.id), daftarUnitKerja(db)]);
  return { jenis, tahap, unit };
}

export async function action({ request, params, context }: Route.ActionArgs) {
  const { env } = context.get(cloudflareContext);
  const pengguna = await wajibMasuk(env, request, ["admin"]);
  const db = buatDb(env);

  const jenis = await ambilJenisIzin(db, params.id);
  if (!jenis) throw new Response("Tidak ditemukan", { status: 404 });

  const formulir = await request.formData();
  const maksud = formulir.get("maksud");

  if (maksud === "tambah-tahap") {
    const hasil = skemaTahap.safeParse(Object.fromEntries(formulir));
    if (!hasil.success) return { galat: hasil.error.issues[0]?.message ?? "Data tidak valid" };

    await tambahTahap(db, params.id, hasil.data);
    await catatAudit(db, {
      userId: pengguna.id,
      aksi: "buat",
      entitas: "tahap_persetujuan",
      entitasId: params.id,
      ringkasan: `Tahap "${hasil.data.nama}" ditambahkan pada jenis izin ${jenis.kode}`,
      request,
    });
    return redirect(`/internal/jenis-izin/${params.id}?tahap=1`);
  }

  if (maksud === "hapus-tahap") {
    const tahapId = String(formulir.get("tahapId") ?? "");
    if (tahapId) {
      await hapusTahap(db, params.id, tahapId);
      await catatAudit(db, {
        userId: pengguna.id,
        aksi: "hapus",
        entitas: "tahap_persetujuan",
        entitasId: params.id,
        ringkasan: `Satu tahap dihapus dari jenis izin ${jenis.kode}`,
        request,
      });
    }
    return redirect(`/internal/jenis-izin/${params.id}?tahap=1`);
  }

  const hasil = skemaJenisIzin.safeParse(Object.fromEntries(formulir));
  if (!hasil.success) return { galat: hasil.error.issues[0]?.message ?? "Data tidak valid" };

  if (hasil.data.definisiKolom && bacaDefinisi(hasil.data.definisiKolom).length === 0) {
    return { galat: "galatDefinisiKolom" as const };
  }

  await ubahJenisIzin(db, params.id, hasil.data);
  await catatAudit(db, {
    userId: pengguna.id,
    aksi: "ubah",
    entitas: "jenis_izin",
    entitasId: params.id,
    ringkasan: `Jenis izin ${jenis.kode} diubah`,
    request,
  });

  return redirect(`/internal/jenis-izin/${params.id}?tersimpan=1`);
}

export default function UbahJenisIzin({ loaderData, actionData }: Route.ComponentProps) {
  const { t } = useDataRoot();
  const navigation = useNavigation();
  const sedangKirim = navigation.state === "submitting";
  const { jenis, tahap, unit } = loaderData;
  const [paramPencarian] = useSearchParams();

  const kodeGalat = actionData && "galat" in actionData ? actionData.galat : null;
  const pesanGalat =
    kodeGalat === "galatDefinisiKolom" ? t.perizinan.galatDefinisiKolom : kodeGalat;

  const labelPeran: Record<string, string> = {
    staf: t.pengguna.peranStaf,
    manajemen: t.pengguna.peranManajemen,
    admin: t.pengguna.peranAdmin,
  };

  return (
    <div className="flex flex-col gap-8">
      <div>
        <Link
          to="/internal/jenis-izin"
          className="text-sm text-sky-700 underline dark:text-sky-400"
        >
          ← {t.perizinan.judulJenis}
        </Link>
        <h1 className="mt-2 text-2xl font-semibold" data-testid="judul-halaman">
          {jenis.nama}
        </h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          <code data-testid="kode-jenis">{jenis.kode}</code>
        </p>
      </div>

      <PesanGalat pesan={pesanGalat} />
      {paramPencarian.has("tersimpan") && !pesanGalat ? (
        <PesanBerhasil pesan={t.umum.berhasilDisimpan} />
      ) : null}

      <Form method="post" className="flex max-w-2xl flex-col gap-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Kolom label={t.perizinan.kode}>
            <Teks name="kode" required defaultValue={jenis.kode} readOnly />
          </Kolom>
          <Kolom label={t.perizinan.namaIzin}>
            <Teks name="nama" required defaultValue={jenis.nama} data-testid="input-nama" />
          </Kolom>
          <Kolom label={t.umum.namaInggris}>
            <Teks name="namaEn" defaultValue={jenis.namaEn ?? ""} />
          </Kolom>
          <Kolom label={t.perizinan.unitPemroses}>
            <Pilihan name="unitKerjaId" defaultValue={jenis.unitKerjaId ?? ""}>
              <option value="">{t.perizinan.tanpaUnit}</option>
              {unit.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.kode} — {u.nama}
                </option>
              ))}
            </Pilihan>
          </Kolom>
          <Kolom label={t.perizinan.slaHari} petunjuk={t.perizinan.slaPetunjuk}>
            <Teks
              type="number"
              name="slaHari"
              min={0}
              max={365}
              defaultValue={jenis.slaHari}
              data-testid="input-sla"
            />
          </Kolom>
        </div>

        <Kolom label={t.umum.keterangan}>
          <AreaTeks name="keterangan" defaultValue={jenis.keterangan ?? ""} maxLength={1000} />
        </Kolom>

        <Kolom label={t.perizinan.definisiKolom} petunjuk={t.perizinan.definisiPetunjuk}>
          <AreaTeks
            name="definisiKolom"
            rows={5}
            defaultValue={jenis.definisiKolom}
            data-testid="input-definisi"
          />
        </Kolom>

        <Centang
          name="aktif"
          label={t.umum.aktif}
          defaultChecked={jenis.aktif}
          data-testid="input-aktif"
        />

        <div>
          <Tombol type="submit" disabled={sedangKirim} data-testid="tombol-simpan">
            {sedangKirim ? t.umum.sedangMenyimpan : t.umum.simpanPerubahan}
          </Tombol>
        </div>
      </Form>

      {/* ---------------------------------------------------------- tahap */}
      <section className="max-w-2xl border-t border-slate-200 pt-6 dark:border-slate-800">
        <h2 className="text-lg font-medium">{t.perizinan.tahap}</h2>
        <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">
          {t.perizinan.tahapPetunjuk}
        </p>

        <Form method="post" className="mt-3 flex flex-wrap items-end gap-4">
          <input type="hidden" name="maksud" value="tambah-tahap" />
          <Kolom label={t.perizinan.namaTahap}>
            <Teks name="nama" required maxLength={120} data-testid="input-nama-tahap" />
          </Kolom>
          <Kolom label={t.perizinan.peranPemutus}>
            <Pilihan name="peranPemutus" defaultValue="staf" data-testid="input-peran-tahap">
              {PERAN_PEMUTUS.map((p) => (
                <option key={p} value={p}>
                  {labelPeran[p]}
                </option>
              ))}
            </Pilihan>
          </Kolom>
          <Tombol type="submit" variasi="kedua" data-testid="tombol-tambah-tahap">
            {t.perizinan.tambahTahap}
          </Tombol>
        </Form>

        <div className="mt-4">
          <Tabel
            testId="tabel-tahap"
            judulKolom={[
              t.umum.urutan,
              t.perizinan.namaTahap,
              t.perizinan.peranPemutus,
              t.umum.aksi,
            ]}
          >
            {tahap.length === 0 ? (
              <BarisKosong kolom={4} pesan={t.perizinan.belumAdaTahap} />
            ) : (
              tahap.map((s) => (
                <tr key={s.id}>
                  <Sel>{s.urutan}</Sel>
                  <Sel>{s.nama}</Sel>
                  <Sel>{labelPeran[s.peranPemutus]}</Sel>
                  <Sel>
                    <Form method="post">
                      <input type="hidden" name="maksud" value="hapus-tahap" />
                      <input type="hidden" name="tahapId" value={s.id} />
                      <button
                        type="submit"
                        className="text-sm text-rose-700 underline dark:text-rose-400"
                        data-testid={`hapus-tahap-${s.urutan}`}
                      >
                        {t.perizinan.hapusTahap}
                      </button>
                    </Form>
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
