import { Form, Link, useNavigation } from "react-router";

import {
  AreaTeks,
  Kolom,
  PesanGalat,
  Pilihan,
  Teks,
  Tombol,
} from "~/components/internal/kolom";
import { BarisKosong, Lencana, Sel, Tabel } from "~/components/internal/tabel";
import { catatAudit } from "~/lib/audit";
import { wajibMasuk } from "~/lib/auth/sesi";
import { cloudflareContext } from "~/lib/context";
import { buatDb } from "~/lib/db";
import { buatUnitKerja, daftarUnitKerja } from "~/modules/organisasi/query";
import { skemaUnitKerjaBaru } from "~/modules/organisasi/validasi";
import { useDataRoot } from "~/root";

import type { Route } from "./+types/daftar";

const PERAN_LIHAT = ["admin", "manajemen", "staf"] as const;

export async function loader({ request, context }: Route.LoaderArgs) {
  const { env } = context.get(cloudflareContext);
  const pengguna = await wajibMasuk(env, request, PERAN_LIHAT);
  const db = buatDb(env);

  return {
    daftar: await daftarUnitKerja(db),
    bolehUbah: pengguna.peran === "admin",
  };
}

export async function action({ request, context }: Route.ActionArgs) {
  const { env } = context.get(cloudflareContext);
  const pengguna = await wajibMasuk(env, request, ["admin"]);
  const db = buatDb(env);

  const formulir = Object.fromEntries(await request.formData());
  const hasil = skemaUnitKerjaBaru.safeParse(formulir);
  if (!hasil.success) {
    return { galat: hasil.error.issues[0]?.message ?? "Data tidak valid" };
  }

  const sudahAda = await daftarUnitKerja(db);
  if (sudahAda.some((u) => u.kode === hasil.data.kode)) {
    return { galat: "kodeSudahDipakai" as const };
  }

  const id = await buatUnitKerja(db, hasil.data);
  await catatAudit(db, {
    userId: pengguna.id,
    aksi: "buat",
    entitas: "unit_kerja",
    entitasId: id,
    ringkasan: `Unit kerja ${hasil.data.kode} dibuat`,
    request,
  });

  return { berhasil: true as const };
}

export default function DaftarUnitKerja({ loaderData, actionData }: Route.ComponentProps) {
  const { t } = useDataRoot();
  const navigation = useNavigation();
  const sedangKirim = navigation.state === "submitting";
  const { daftar, bolehUbah } = loaderData;

  const pesanGalat =
    actionData && "galat" in actionData
      ? actionData.galat === "kodeSudahDipakai"
        ? t.unitKerja.kodeSudahDipakai
        : actionData.galat
      : null;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold" data-testid="judul-halaman">
          {t.unitKerja.judul}
        </h1>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
          {t.unitKerja.keterangan}
        </p>
      </div>

      {bolehUbah ? (
        <details className="rounded-md border border-slate-200 p-4 dark:border-slate-800">
          <summary
            className="cursor-pointer text-sm font-medium"
            data-testid="buka-form-tambah"
          >
            {t.unitKerja.tambahJudul}
          </summary>

          <Form
            method="post"
            className="mt-4 flex flex-col gap-4"
            data-testid="form-unit-kerja"
          >
            <PesanGalat pesan={pesanGalat} />

            <div className="grid gap-4 sm:grid-cols-2">
              <Kolom label={t.umum.kode} petunjuk={t.unitKerja.kodePetunjuk}>
                <Teks name="kode" required maxLength={16} data-testid="input-kode" />
              </Kolom>
              <Kolom label={t.umum.nama}>
                <Teks name="nama" required maxLength={120} data-testid="input-nama" />
              </Kolom>
              <Kolom label={t.umum.namaInggris}>
                <Teks name="namaEn" maxLength={120} data-testid="input-nama-en" />
              </Kolom>
              <Kolom label={t.unitKerja.induk}>
                <Pilihan name="indukId" defaultValue="" data-testid="input-induk">
                  <option value="">{t.unitKerja.tanpaInduk}</option>
                  {daftar.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.kode} — {u.nama}
                    </option>
                  ))}
                </Pilihan>
              </Kolom>
              <Kolom label={t.umum.urutan} petunjuk={t.umum.urutanPetunjuk}>
                <Teks type="number" name="urutan" defaultValue={0} min={0} max={9999} />
              </Kolom>
            </div>

            <Kolom label={t.unitKerja.fungsi}>
              <AreaTeks name="fungsi" maxLength={2000} />
            </Kolom>

            <div>
              <Tombol type="submit" disabled={sedangKirim} data-testid="tombol-simpan">
                {sedangKirim ? t.umum.sedangMenyimpan : t.umum.simpan}
              </Tombol>
            </div>
          </Form>
        </details>
      ) : (
        <p className="text-sm text-slate-500 dark:text-slate-400">{t.umum.hanyaBaca}</p>
      )}

      <Tabel
        testId="tabel-unit-kerja"
        judulKolom={[
          t.umum.kode,
          t.umum.nama,
          t.unitKerja.induk,
          t.umum.urutan,
          t.umum.status,
          t.umum.aksi,
        ]}
      >
        {daftar.length === 0 ? (
          <BarisKosong kolom={6} pesan={t.umum.tidakAdaData} />
        ) : (
          daftar.map((u) => {
            const induk = daftar.find((i) => i.id === u.indukId);
            return (
              <tr key={u.id}>
                <Sel>
                  <code className="text-xs">{u.kode}</code>
                </Sel>
                <Sel>{u.nama}</Sel>
                <Sel>{induk ? induk.kode : t.umum.tidakAda}</Sel>
                <Sel>{u.urutan}</Sel>
                <Sel>
                  <Lencana
                    aktif={u.aktif}
                    teksAktif={t.umum.aktif}
                    teksNonaktif={t.umum.nonaktif}
                  />
                </Sel>
                <Sel>
                  {bolehUbah ? (
                    <Link
                      to={`/internal/unit-kerja/${u.id}`}
                      className="text-sky-700 underline dark:text-sky-400"
                      data-testid={`ubah-${u.kode}`}
                    >
                      {t.umum.ubah}
                    </Link>
                  ) : (
                    t.umum.tidakAda
                  )}
                </Sel>
              </tr>
            );
          })
        )}
      </Tabel>
    </div>
  );
}
