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
import { PERUNTUKAN } from "~/lib/db/schema/kavling";
import { buatKavling, daftarKavling } from "~/modules/kavling/query";
import { skemaKavlingBaru } from "~/modules/kavling/validasi";
import { useDataRoot } from "~/root";

import type { Route } from "./+types/daftar";

export async function loader({ request, context }: Route.LoaderArgs) {
  const { env } = context.get(cloudflareContext);
  const pengguna = await wajibMasuk(env, request, ["admin", "manajemen", "staf"]);
  const db = buatDb(env);

  return { daftar: await daftarKavling(db), bolehUbah: pengguna.peran === "admin" };
}

export async function action({ request, context }: Route.ActionArgs) {
  const { env } = context.get(cloudflareContext);
  const pengguna = await wajibMasuk(env, request, ["admin"]);
  const db = buatDb(env);

  const hasil = skemaKavlingBaru.safeParse(Object.fromEntries(await request.formData()));
  if (!hasil.success) return { galat: hasil.error.issues[0]?.message ?? "Data tidak valid" };

  const sudahAda = await daftarKavling(db);
  if (sudahAda.some((k) => k.kode === hasil.data.kode)) {
    return { galat: "kodeSudahDipakai" as const };
  }

  const id = await buatKavling(db, hasil.data);
  await catatAudit(db, {
    userId: pengguna.id,
    aksi: "buat",
    entitas: "kavling",
    entitasId: id,
    ringkasan: `Kavling ${hasil.data.kode} dibuat`,
    request,
  });

  return { berhasil: true as const };
}

export default function DaftarKavling({ loaderData, actionData }: Route.ComponentProps) {
  const { t } = useDataRoot();
  const navigation = useNavigation();
  const sedangKirim = navigation.state === "submitting";
  const { daftar, bolehUbah } = loaderData;

  const labelPeruntukan: Record<string, string> = {
    industri: t.kavling.peruntukanIndustri,
    komersial: t.kavling.peruntukanKomersial,
    fasilitas: t.kavling.peruntukanFasilitas,
    rth: t.kavling.peruntukanRth,
  };
  const labelStatus: Record<string, string> = {
    tersedia: t.kavling.statusTersedia,
    dipesan: t.kavling.statusDipesan,
    disewa: t.kavling.statusDisewa,
    terjual: t.kavling.statusTerjual,
  };

  const pesanGalat =
    actionData && "galat" in actionData
      ? actionData.galat === "kodeSudahDipakai"
        ? t.kavling.kodeSudahDipakai
        : actionData.galat
      : null;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold" data-testid="judul-halaman">
          {t.kavling.judul}
        </h1>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
          {t.kavling.keterangan}
        </p>
      </div>

      {bolehUbah ? (
        <details className="rounded-md border border-slate-200 p-4 dark:border-slate-800">
          <summary
            className="cursor-pointer text-sm font-medium"
            data-testid="buka-form-tambah"
          >
            {t.kavling.tambahJudul}
          </summary>

          <Form method="post" className="mt-4 flex flex-col gap-4">
            <PesanGalat pesan={pesanGalat} />

            <div className="grid gap-4 sm:grid-cols-3">
              <Kolom label={t.umum.kode}>
                <Teks name="kode" required maxLength={16} data-testid="input-kode" />
              </Kolom>
              <Kolom label={t.kavling.blok}>
                <Teks name="blok" required maxLength={20} data-testid="input-blok" />
              </Kolom>
              <Kolom label={t.kavling.nomor}>
                <Teks name="nomor" required maxLength={20} data-testid="input-nomor" />
              </Kolom>
              <Kolom label={t.kavling.luas}>
                <Teks type="number" name="luasM2" required min={1} data-testid="input-luas" />
              </Kolom>
              <Kolom label={t.kavling.peruntukan}>
                <Pilihan name="peruntukan" defaultValue="industri">
                  {PERUNTUKAN.map((p) => (
                    <option key={p} value={p}>
                      {labelPeruntukan[p]}
                    </option>
                  ))}
                </Pilihan>
              </Kolom>
              <Kolom label={t.kavling.hargaDasar}>
                <Teks type="number" name="hargaDasar" min={0} />
              </Kolom>
            </div>

            <Kolom label={t.kavling.keterangan2}>
              <AreaTeks name="keterangan" maxLength={1000} />
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
        testId="tabel-kavling"
        judulKolom={[
          t.umum.kode,
          t.kavling.blok,
          t.kavling.luas,
          t.kavling.peruntukan,
          t.umum.status,
          t.umum.aksi,
        ]}
      >
        {daftar.length === 0 ? (
          <BarisKosong kolom={6} pesan={t.umum.tidakAdaData} />
        ) : (
          daftar.map((k) => (
            <tr key={k.id}>
              <Sel>
                <code className="text-xs">{k.kode}</code>
              </Sel>
              <Sel>
                {k.blok}-{k.nomor}
              </Sel>
              <Sel>{k.luasM2.toLocaleString("id-ID")}</Sel>
              <Sel>{labelPeruntukan[k.peruntukan]}</Sel>
              <Sel>
                <span data-testid={`status-${k.kode}`}>{labelStatus[k.status]}</span>
              </Sel>
              <Sel>
                {bolehUbah ? (
                  <Link
                    to={`/internal/kavling/${k.id}`}
                    className="text-sky-700 underline dark:text-sky-400"
                    data-testid={`ubah-${k.kode}`}
                  >
                    {t.umum.ubah}
                  </Link>
                ) : (
                  t.umum.tidakAda
                )}
              </Sel>
            </tr>
          ))
        )}
      </Tabel>
    </div>
  );
}
