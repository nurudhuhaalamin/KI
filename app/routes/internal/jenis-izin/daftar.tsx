import { Form, Link, useNavigation } from "react-router";

import {
  AreaTeks,
  Kolom,
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
import { bacaDefinisi } from "~/modules/perizinan/formulir";
import { buatJenisIzin, daftarJenisIzin } from "~/modules/perizinan/query";
import { skemaJenisIzin } from "~/modules/perizinan/validasi";
import { daftarUnitKerja } from "~/modules/organisasi/query";
import { useDataRoot } from "~/root";

import type { Route } from "./+types/daftar";

export async function loader({ request, context }: Route.LoaderArgs) {
  const { env } = context.get(cloudflareContext);
  await wajibMasuk(env, request, ["admin"]);
  const db = buatDb(env);

  const [jenis, unit] = await Promise.all([daftarJenisIzin(db), daftarUnitKerja(db)]);
  return { jenis, unit };
}

export async function action({ request, context }: Route.ActionArgs) {
  const { env } = context.get(cloudflareContext);
  const pengguna = await wajibMasuk(env, request, ["admin"]);
  const db = buatDb(env);

  const hasil = skemaJenisIzin.safeParse(Object.fromEntries(await request.formData()));
  if (!hasil.success) return { galat: hasil.error.issues[0]?.message ?? "Data tidak valid" };

  // Definisi kolom harus terbaca; menyimpan JSON rusak berarti formulir
  // pengajuan tampil kosong tanpa ada yang tahu penyebabnya.
  if (hasil.data.definisiKolom && bacaDefinisi(hasil.data.definisiKolom).length === 0) {
    return { galat: "galatDefinisiKolom" as const };
  }

  const id = await buatJenisIzin(db, hasil.data);
  await catatAudit(db, {
    userId: pengguna.id,
    aksi: "buat",
    entitas: "jenis_izin",
    entitasId: id,
    ringkasan: `Jenis izin ${hasil.data.kode} dibuat`,
    request,
  });

  return { berhasil: true as const };
}

export default function DaftarJenisIzin({ loaderData, actionData }: Route.ComponentProps) {
  const { t } = useDataRoot();
  const navigation = useNavigation();
  const sedangKirim = navigation.state === "submitting";
  const { jenis, unit } = loaderData;

  const kodeGalat = actionData && "galat" in actionData ? actionData.galat : null;
  const pesanGalat =
    kodeGalat === "galatDefinisiKolom" ? t.perizinan.galatDefinisiKolom : kodeGalat;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold" data-testid="judul-halaman">
          {t.perizinan.judulJenis}
        </h1>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
          {t.perizinan.keteranganJenis}
        </p>
      </div>

      <details className="rounded-md border border-slate-200 p-4 dark:border-slate-800">
        <summary className="cursor-pointer text-sm font-medium" data-testid="buka-form-tambah">
          {t.perizinan.tambahJenis}
        </summary>

        <Form method="post" className="mt-4 flex flex-col gap-4">
          <PesanGalat pesan={pesanGalat} />

          <div className="grid gap-4 sm:grid-cols-2">
            <Kolom label={t.perizinan.kode}>
              <Teks name="kode" required maxLength={20} data-testid="input-kode" />
            </Kolom>
            <Kolom label={t.perizinan.namaIzin}>
              <Teks name="nama" required maxLength={120} data-testid="input-nama" />
            </Kolom>
            <Kolom label={t.umum.namaInggris}>
              <Teks name="namaEn" maxLength={120} />
            </Kolom>
            <Kolom label={t.perizinan.unitPemroses}>
              <Pilihan name="unitKerjaId" defaultValue="" data-testid="input-unit">
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
                defaultValue={5}
                data-testid="input-sla"
              />
            </Kolom>
          </div>

          <Kolom label={t.perizinan.definisiKolom} petunjuk={t.perizinan.definisiPetunjuk}>
            <AreaTeks name="definisiKolom" rows={4} data-testid="input-definisi" />
          </Kolom>

          <div>
            <Tombol type="submit" disabled={sedangKirim} data-testid="tombol-simpan">
              {sedangKirim ? t.umum.sedangMenyimpan : t.umum.simpan}
            </Tombol>
          </div>
        </Form>
      </details>

      <Tabel
        testId="tabel-jenis-izin"
        judulKolom={[
          t.perizinan.kode,
          t.perizinan.namaIzin,
          t.perizinan.slaHari,
          t.umum.status,
          t.umum.aksi,
        ]}
      >
        {jenis.length === 0 ? (
          <BarisKosong kolom={5} pesan={t.umum.tidakAdaData} />
        ) : (
          jenis.map((j) => (
            <tr key={j.id}>
              <Sel>
                <code className="text-xs">{j.kode}</code>
              </Sel>
              <Sel>{j.nama}</Sel>
              <Sel>{j.slaHari}</Sel>
              <Sel>
                <span data-testid={`aktif-${j.id}`}>
                  {j.aktif ? t.umum.aktif : t.umum.nonaktif}
                </span>
              </Sel>
              <Sel>
                <Link
                  to={`/internal/jenis-izin/${j.id}`}
                  className="text-sky-700 underline dark:text-sky-400"
                  data-testid={`buka-${j.id}`}
                >
                  {t.umum.ubah}
                </Link>
              </Sel>
            </tr>
          ))
        )}
      </Tabel>
    </div>
  );
}
