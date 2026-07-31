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
import { catatAudit, ringkasPerubahan } from "~/lib/audit";
import { wajibMasuk } from "~/lib/auth/sesi";
import { cloudflareContext } from "~/lib/context";
import { buatDb } from "~/lib/db";
import { akanMembentukGelung } from "~/modules/organisasi/hierarki";
import { ambilUnitKerja, daftarUnitKerja, ubahUnitKerja } from "~/modules/organisasi/query";
import { skemaUnitKerjaUbah } from "~/modules/organisasi/validasi";
import { useDataRoot } from "~/root";

import type { Route } from "./+types/ubah";

export async function loader({ request, params, context }: Route.LoaderArgs) {
  const { env } = context.get(cloudflareContext);
  await wajibMasuk(env, request, ["admin"]);
  const db = buatDb(env);

  const unit = await ambilUnitKerja(db, params.id);
  if (!unit) throw new Response("Tidak ditemukan", { status: 404 });

  return { unit, semua: await daftarUnitKerja(db) };
}

export async function action({ request, params, context }: Route.ActionArgs) {
  const { env } = context.get(cloudflareContext);
  const pengguna = await wajibMasuk(env, request, ["admin"]);
  const db = buatDb(env);

  const sebelum = await ambilUnitKerja(db, params.id);
  if (!sebelum) throw new Response("Tidak ditemukan", { status: 404 });

  const formulir = Object.fromEntries(await request.formData());
  const hasil = skemaUnitKerjaUbah.safeParse({
    ...formulir,
    aktif: formulir.aktif === "on",
  });
  if (!hasil.success) {
    return { galat: hasil.error.issues[0]?.message ?? "Data tidak valid" };
  }

  // Gelung membuat penelusuran struktur berputar tanpa henti. Diperiksa di
  // server, bukan hanya disembunyikan dari daftar pilihan.
  const semua = await daftarUnitKerja(db);
  if (akanMembentukGelung(semua, params.id, hasil.data.indukId)) {
    return { galat: "gelung" as const };
  }

  await ubahUnitKerja(db, params.id, hasil.data);
  await catatAudit(db, {
    userId: pengguna.id,
    aksi: "ubah",
    entitas: "unit_kerja",
    entitasId: params.id,
    ringkasan: ringkasPerubahan(
      {
        nama: sebelum.nama,
        indukId: sebelum.indukId,
        urutan: sebelum.urutan,
        aktif: sebelum.aktif,
      },
      {
        nama: hasil.data.nama,
        indukId: hasil.data.indukId ?? null,
        urutan: hasil.data.urutan,
        aktif: hasil.data.aktif,
      },
    ),
    request,
  });

  return redirect(`/internal/unit-kerja/${params.id}?tersimpan=1`);
}

export default function UbahUnitKerja({ loaderData, actionData }: Route.ComponentProps) {
  const { t } = useDataRoot();
  const navigation = useNavigation();
  const sedangKirim = navigation.state === "submitting";
  const { unit, semua } = loaderData;

  // Dibaca lewat useSearchParams, bukan window.location, agar hasil render di
  // server dan di peramban sama persis.
  const [paramPencarian] = useSearchParams();
  const tersimpan = paramPencarian.has("tersimpan");

  const pesanGalat = actionData?.galat
    ? actionData.galat === "gelung"
      ? t.unitKerja.gelung
      : actionData.galat
    : null;

  // Diri sendiri tidak boleh menjadi pilihan induk.
  const calonInduk = semua.filter((u) => u.id !== unit.id);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link
          to="/internal/unit-kerja"
          className="text-sm text-sky-700 underline dark:text-sky-400"
        >
          ← {t.unitKerja.judul}
        </Link>
        <h1 className="mt-2 text-2xl font-semibold" data-testid="judul-halaman">
          {t.unitKerja.ubahJudul}
        </h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          <code>{unit.kode}</code>
        </p>
      </div>

      <Form method="post" className="flex max-w-2xl flex-col gap-4">
        <PesanGalat pesan={pesanGalat} />
        {tersimpan && !pesanGalat ? <PesanBerhasil pesan={t.umum.berhasilDisimpan} /> : null}

        <div className="grid gap-4 sm:grid-cols-2">
          <Kolom label={t.umum.nama}>
            <Teks name="nama" required defaultValue={unit.nama} data-testid="input-nama" />
          </Kolom>
          <Kolom label={t.umum.namaInggris}>
            <Teks name="namaEn" defaultValue={unit.namaEn ?? ""} />
          </Kolom>
          <Kolom label={t.unitKerja.induk}>
            <Pilihan name="indukId" defaultValue={unit.indukId ?? ""} data-testid="input-induk">
              <option value="">{t.unitKerja.tanpaInduk}</option>
              {calonInduk.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.kode} — {u.nama}
                </option>
              ))}
            </Pilihan>
          </Kolom>
          <Kolom label={t.umum.urutan} petunjuk={t.umum.urutanPetunjuk}>
            <Teks type="number" name="urutan" defaultValue={unit.urutan} min={0} max={9999} />
          </Kolom>
        </div>

        <Kolom label={t.unitKerja.fungsi}>
          <AreaTeks name="fungsi" defaultValue={unit.fungsi ?? ""} maxLength={2000} />
        </Kolom>

        <Centang
          name="aktif"
          label={t.umum.aktif}
          defaultChecked={unit.aktif}
          data-testid="input-aktif"
        />

        <div className="flex gap-3">
          <Tombol type="submit" disabled={sedangKirim} data-testid="tombol-simpan">
            {sedangKirim ? t.umum.sedangMenyimpan : t.umum.simpanPerubahan}
          </Tombol>
          <Link to="/internal/unit-kerja">
            <Tombol type="button" variasi="kedua">
              {t.umum.batal}
            </Tombol>
          </Link>
        </div>
      </Form>
    </div>
  );
}
