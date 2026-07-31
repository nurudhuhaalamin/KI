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
import { buatJabatan, daftarJabatan, daftarUnitKerja } from "~/modules/organisasi/query";
import { skemaJabatanBaru } from "~/modules/organisasi/validasi";
import { useDataRoot } from "~/root";

import type { Route } from "./+types/daftar";

const PERAN_LIHAT = ["admin", "manajemen", "staf"] as const;

export async function loader({ request, context }: Route.LoaderArgs) {
  const { env } = context.get(cloudflareContext);
  const pengguna = await wajibMasuk(env, request, PERAN_LIHAT);
  const db = buatDb(env);

  const [jabatan, unit] = await Promise.all([daftarJabatan(db), daftarUnitKerja(db)]);
  return { jabatan, unit, bolehUbah: pengguna.peran === "admin" };
}

export async function action({ request, context }: Route.ActionArgs) {
  const { env } = context.get(cloudflareContext);
  const pengguna = await wajibMasuk(env, request, ["admin"]);
  const db = buatDb(env);

  const formulir = Object.fromEntries(await request.formData());
  const hasil = skemaJabatanBaru.safeParse(formulir);
  if (!hasil.success) {
    return { galat: hasil.error.issues[0]?.message ?? "Data tidak valid" };
  }

  const sudahAda = await daftarJabatan(db);
  if (sudahAda.some((j) => j.kode === hasil.data.kode)) {
    return { galat: "kodeSudahDipakai" as const };
  }

  const id = await buatJabatan(db, hasil.data);
  await catatAudit(db, {
    userId: pengguna.id,
    aksi: "buat",
    entitas: "jabatan",
    entitasId: id,
    ringkasan: `Jabatan ${hasil.data.kode} dibuat`,
    request,
  });

  return { berhasil: true as const };
}

export default function DaftarJabatan({ loaderData, actionData }: Route.ComponentProps) {
  const { t } = useDataRoot();
  const navigation = useNavigation();
  const sedangKirim = navigation.state === "submitting";
  const { jabatan, unit, bolehUbah } = loaderData;

  const pesanGalat =
    actionData && "galat" in actionData
      ? actionData.galat === "kodeSudahDipakai"
        ? t.jabatan.kodeSudahDipakai
        : actionData.galat
      : null;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold" data-testid="judul-halaman">
          {t.jabatan.judul}
        </h1>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
          {t.jabatan.keterangan}
        </p>
      </div>

      {!bolehUbah ? (
        <p className="text-sm text-slate-500 dark:text-slate-400">{t.umum.hanyaBaca}</p>
      ) : unit.length === 0 ? (
        <p
          className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:bg-amber-950 dark:text-amber-200"
          data-testid="peringatan-unit-kosong"
        >
          {t.jabatan.belumAdaUnitKerja}
        </p>
      ) : (
        <details className="rounded-md border border-slate-200 p-4 dark:border-slate-800">
          <summary
            className="cursor-pointer text-sm font-medium"
            data-testid="buka-form-tambah"
          >
            {t.jabatan.tambahJudul}
          </summary>

          <Form method="post" className="mt-4 flex flex-col gap-4" data-testid="form-jabatan">
            <PesanGalat pesan={pesanGalat} />

            <div className="grid gap-4 sm:grid-cols-2">
              <Kolom label={t.umum.kode} petunjuk={t.unitKerja.kodePetunjuk}>
                <Teks name="kode" required maxLength={16} data-testid="input-kode" />
              </Kolom>
              <Kolom label={t.umum.nama}>
                <Teks name="nama" required maxLength={120} data-testid="input-nama" />
              </Kolom>
              <Kolom label={t.umum.namaInggris}>
                <Teks name="namaEn" maxLength={120} />
              </Kolom>
              <Kolom label={t.jabatan.unitKerja}>
                <Pilihan name="unitKerjaId" required data-testid="input-unit-kerja">
                  {unit.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.kode} — {u.nama}
                    </option>
                  ))}
                </Pilihan>
              </Kolom>
              <Kolom label={t.jabatan.atasan}>
                <Pilihan name="atasanId" defaultValue="">
                  <option value="">{t.jabatan.tanpaAtasan}</option>
                  {jabatan.map((j) => (
                    <option key={j.id} value={j.id}>
                      {j.kode} — {j.nama}
                    </option>
                  ))}
                </Pilihan>
              </Kolom>
            </div>

            <Kolom label={t.jabatan.ringkasanTugas}>
              <AreaTeks name="ringkasanTugas" maxLength={2000} />
            </Kolom>

            <div>
              <Tombol type="submit" disabled={sedangKirim} data-testid="tombol-simpan">
                {sedangKirim ? t.umum.sedangMenyimpan : t.umum.simpan}
              </Tombol>
            </div>
          </Form>
        </details>
      )}

      <Tabel
        testId="tabel-jabatan"
        judulKolom={[
          t.umum.kode,
          t.umum.nama,
          t.jabatan.unitKerja,
          t.jabatan.atasan,
          t.umum.status,
          t.umum.aksi,
        ]}
      >
        {jabatan.length === 0 ? (
          <BarisKosong kolom={6} pesan={t.umum.tidakAdaData} />
        ) : (
          jabatan.map((j) => {
            const unitnya = unit.find((u) => u.id === j.unitKerjaId);
            const atasan = jabatan.find((a) => a.id === j.atasanId);
            return (
              <tr key={j.id}>
                <Sel>
                  <code className="text-xs">{j.kode}</code>
                </Sel>
                <Sel>{j.nama}</Sel>
                <Sel>{unitnya ? unitnya.kode : t.umum.tidakAda}</Sel>
                <Sel>{atasan ? atasan.kode : t.umum.tidakAda}</Sel>
                <Sel>
                  <Lencana
                    aktif={j.aktif}
                    teksAktif={t.umum.aktif}
                    teksNonaktif={t.umum.nonaktif}
                  />
                </Sel>
                <Sel>
                  {bolehUbah ? (
                    <Link
                      to={`/internal/jabatan/${j.id}`}
                      className="text-sky-700 underline dark:text-sky-400"
                      data-testid={`ubah-${j.kode}`}
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
