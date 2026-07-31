import { Form, Link, useNavigation } from "react-router";

import { Kolom, PesanGalat, Pilihan, Teks, Tombol } from "~/components/internal/kolom";
import { BarisKosong, Lencana, Sel, Tabel } from "~/components/internal/tabel";
import { catatAudit } from "~/lib/audit";
import { wajibMasuk } from "~/lib/auth/sesi";
import { cloudflareContext } from "~/lib/context";
import { buatDb } from "~/lib/db";
import { PERAN } from "~/lib/db/schema/auth";
import {
  buatPengguna,
  daftarJabatan,
  daftarPengguna,
  daftarUnitKerja,
  surelSudahDipakai,
} from "~/modules/organisasi/query";
import { skemaPenggunaBaru } from "~/modules/organisasi/validasi";
import { useDataRoot } from "~/root";

import type { Route } from "./+types/daftar";

export async function loader({ request, context }: Route.LoaderArgs) {
  const { env } = context.get(cloudflareContext);
  const pengguna = await wajibMasuk(env, request, ["admin", "manajemen"]);
  const db = buatDb(env);

  const [daftar, unit, jabatan] = await Promise.all([
    daftarPengguna(db),
    daftarUnitKerja(db),
    daftarJabatan(db),
  ]);

  return { daftar, unit, jabatan, bolehUbah: pengguna.peran === "admin" };
}

export async function action({ request, context }: Route.ActionArgs) {
  const { env } = context.get(cloudflareContext);
  const pengguna = await wajibMasuk(env, request, ["admin"]);
  const db = buatDb(env);

  const formulir = Object.fromEntries(await request.formData());
  const hasil = skemaPenggunaBaru.safeParse(formulir);
  if (!hasil.success) {
    return { galat: hasil.error.issues[0]?.message ?? "Data tidak valid" };
  }

  if (await surelSudahDipakai(db, hasil.data.surel)) {
    return { galat: "surelSudahDipakai" as const };
  }

  const id = await buatPengguna(db, hasil.data);

  // Ringkasan sengaja hanya menyebut peran, bukan surel atau nama, agar jejak
  // audit tidak menjadi tempat terkumpulnya data pribadi.
  await catatAudit(db, {
    userId: pengguna.id,
    aksi: "buat",
    entitas: "pengguna",
    entitasId: id,
    ringkasan: `Pengguna baru dengan peran ${hasil.data.peran}`,
    request,
  });

  return { berhasil: true as const };
}

export default function DaftarPengguna({ loaderData, actionData }: Route.ComponentProps) {
  const { t } = useDataRoot();
  const navigation = useNavigation();
  const sedangKirim = navigation.state === "submitting";
  const { daftar, unit, jabatan, bolehUbah } = loaderData;

  const labelPeran: Record<string, string> = {
    admin: t.pengguna.peranAdmin,
    manajemen: t.pengguna.peranManajemen,
    staf: t.pengguna.peranStaf,
    tenant: t.pengguna.peranTenant,
  };

  const pesanGalat =
    actionData && "galat" in actionData
      ? actionData.galat === "surelSudahDipakai"
        ? t.pengguna.surelSudahDipakai
        : actionData.galat
      : null;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold" data-testid="judul-halaman">
          {t.pengguna.judul}
        </h1>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
          {t.pengguna.keterangan}
        </p>
      </div>

      {bolehUbah ? (
        <details className="rounded-md border border-slate-200 p-4 dark:border-slate-800">
          <summary
            className="cursor-pointer text-sm font-medium"
            data-testid="buka-form-tambah"
          >
            {t.pengguna.tambahJudul}
          </summary>

          <Form method="post" className="mt-4 flex flex-col gap-4" data-testid="form-pengguna">
            <PesanGalat pesan={pesanGalat} />

            <div className="grid gap-4 sm:grid-cols-2">
              <Kolom label={t.umum.nama}>
                <Teks name="nama" required maxLength={120} data-testid="input-nama" />
              </Kolom>
              <Kolom label={t.pengguna.surel} petunjuk={t.pengguna.surelPetunjuk}>
                <Teks type="email" name="surel" required data-testid="input-surel" />
              </Kolom>
              <Kolom label={t.pengguna.kataSandi} petunjuk={t.pengguna.kataSandiPetunjuk}>
                <Teks
                  type="password"
                  name="kataSandi"
                  required
                  minLength={12}
                  autoComplete="new-password"
                  data-testid="input-kata-sandi"
                />
              </Kolom>
              <Kolom label={t.pengguna.peran}>
                <Pilihan name="peran" defaultValue="staf" data-testid="input-peran">
                  {PERAN.map((p) => (
                    <option key={p} value={p}>
                      {labelPeran[p]}
                    </option>
                  ))}
                </Pilihan>
              </Kolom>
              <Kolom label={t.pengguna.unitKerja}>
                <Pilihan name="unitKerjaId" defaultValue="">
                  <option value="">{t.pengguna.tanpaUnitKerja}</option>
                  {unit.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.kode} — {u.nama}
                    </option>
                  ))}
                </Pilihan>
              </Kolom>
              <Kolom label={t.pengguna.jabatan}>
                <Pilihan name="jabatanId" defaultValue="">
                  <option value="">{t.pengguna.tanpaJabatan}</option>
                  {jabatan.map((j) => (
                    <option key={j.id} value={j.id}>
                      {j.kode} — {j.nama}
                    </option>
                  ))}
                </Pilihan>
              </Kolom>
            </div>

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
        testId="tabel-pengguna"
        judulKolom={[
          t.umum.nama,
          t.pengguna.surel,
          t.pengguna.peran,
          t.pengguna.unitKerja,
          t.umum.status,
          t.umum.aksi,
        ]}
      >
        {daftar.length === 0 ? (
          <BarisKosong kolom={6} pesan={t.umum.tidakAdaData} />
        ) : (
          daftar.map((p) => {
            const unitnya = unit.find((u) => u.id === p.unitKerjaId);
            return (
              <tr key={p.id}>
                <Sel>{p.nama}</Sel>
                <Sel>
                  <span className="text-xs">{p.surel}</span>
                </Sel>
                <Sel>{labelPeran[p.peran] ?? p.peran}</Sel>
                <Sel>{unitnya ? unitnya.kode : t.umum.tidakAda}</Sel>
                <Sel>
                  <Lencana
                    aktif={p.aktif}
                    teksAktif={t.umum.aktif}
                    teksNonaktif={t.umum.nonaktif}
                  />
                </Sel>
                <Sel>
                  {bolehUbah ? (
                    <Link
                      to={`/internal/pengguna/${p.id}`}
                      className="text-sky-700 underline dark:text-sky-400"
                      data-testid={`ubah-${p.surel}`}
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
