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
import { akanMembentukGelung, type Simpul } from "~/modules/organisasi/hierarki";
import {
  ambilJabatan,
  daftarJabatan,
  daftarUnitKerja,
  ubahJabatan,
} from "~/modules/organisasi/query";
import { skemaJabatanUbah } from "~/modules/organisasi/validasi";
import { useDataRoot } from "~/root";

import type { Route } from "./+types/ubah";

export async function loader({ request, params, context }: Route.LoaderArgs) {
  const { env } = context.get(cloudflareContext);
  await wajibMasuk(env, request, ["admin"]);
  const db = buatDb(env);

  const jabatanIni = await ambilJabatan(db, params.id);
  if (!jabatanIni) throw new Response("Tidak ditemukan", { status: 404 });

  const [semua, unit] = await Promise.all([daftarJabatan(db), daftarUnitKerja(db)]);
  return { jabatanIni, semua, unit };
}

export async function action({ request, params, context }: Route.ActionArgs) {
  const { env } = context.get(cloudflareContext);
  const pengguna = await wajibMasuk(env, request, ["admin"]);
  const db = buatDb(env);

  const sebelum = await ambilJabatan(db, params.id);
  if (!sebelum) throw new Response("Tidak ditemukan", { status: 404 });

  const formulir = Object.fromEntries(await request.formData());
  const hasil = skemaJabatanUbah.safeParse({ ...formulir, aktif: formulir.aktif === "on" });
  if (!hasil.success) {
    return { galat: hasil.error.issues[0]?.message ?? "Data tidak valid" };
  }

  // Rantai atasan juga sebuah hierarki, jadi memakai pemeriksaan gelung yang sama.
  const semua = await daftarJabatan(db);
  const sebagaiSimpul: Simpul[] = semua.map((j) => ({ id: j.id, indukId: j.atasanId }));
  if (akanMembentukGelung(sebagaiSimpul, params.id, hasil.data.atasanId)) {
    return { galat: "gelung" as const };
  }

  await ubahJabatan(db, params.id, hasil.data);
  await catatAudit(db, {
    userId: pengguna.id,
    aksi: "ubah",
    entitas: "jabatan",
    entitasId: params.id,
    ringkasan: ringkasPerubahan(
      {
        nama: sebelum.nama,
        unitKerjaId: sebelum.unitKerjaId,
        atasanId: sebelum.atasanId,
        aktif: sebelum.aktif,
      },
      {
        nama: hasil.data.nama,
        unitKerjaId: hasil.data.unitKerjaId,
        atasanId: hasil.data.atasanId ?? null,
        aktif: hasil.data.aktif,
      },
    ),
    request,
  });

  return redirect(`/internal/jabatan/${params.id}?tersimpan=1`);
}

export default function UbahJabatan({ loaderData, actionData }: Route.ComponentProps) {
  const { t } = useDataRoot();
  const navigation = useNavigation();
  const sedangKirim = navigation.state === "submitting";
  const { jabatanIni, semua, unit } = loaderData;

  const [paramPencarian] = useSearchParams();
  const tersimpan = paramPencarian.has("tersimpan");

  const pesanGalat = actionData?.galat
    ? actionData.galat === "gelung"
      ? t.jabatan.gelung
      : actionData.galat
    : null;

  const calonAtasan = semua.filter((j) => j.id !== jabatanIni.id);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link
          to="/internal/jabatan"
          className="text-sm text-sky-700 underline dark:text-sky-400"
        >
          ← {t.jabatan.judul}
        </Link>
        <h1 className="mt-2 text-2xl font-semibold" data-testid="judul-halaman">
          {t.jabatan.ubahJudul}
        </h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          <code>{jabatanIni.kode}</code>
        </p>
      </div>

      <Form method="post" className="flex max-w-2xl flex-col gap-4">
        <PesanGalat pesan={pesanGalat} />
        {tersimpan && !pesanGalat ? <PesanBerhasil pesan={t.umum.berhasilDisimpan} /> : null}

        <div className="grid gap-4 sm:grid-cols-2">
          <Kolom label={t.umum.nama}>
            <Teks
              name="nama"
              required
              defaultValue={jabatanIni.nama}
              data-testid="input-nama"
            />
          </Kolom>
          <Kolom label={t.umum.namaInggris}>
            <Teks name="namaEn" defaultValue={jabatanIni.namaEn ?? ""} />
          </Kolom>
          <Kolom label={t.jabatan.unitKerja}>
            <Pilihan name="unitKerjaId" required defaultValue={jabatanIni.unitKerjaId}>
              {unit.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.kode} — {u.nama}
                </option>
              ))}
            </Pilihan>
          </Kolom>
          <Kolom label={t.jabatan.atasan}>
            <Pilihan
              name="atasanId"
              defaultValue={jabatanIni.atasanId ?? ""}
              data-testid="input-atasan"
            >
              <option value="">{t.jabatan.tanpaAtasan}</option>
              {calonAtasan.map((j) => (
                <option key={j.id} value={j.id}>
                  {j.kode} — {j.nama}
                </option>
              ))}
            </Pilihan>
          </Kolom>
        </div>

        <Kolom label={t.jabatan.ringkasanTugas}>
          <AreaTeks
            name="ringkasanTugas"
            defaultValue={jabatanIni.ringkasanTugas ?? ""}
            maxLength={2000}
          />
        </Kolom>

        <Centang
          name="aktif"
          label={t.umum.aktif}
          defaultChecked={jabatanIni.aktif}
          data-testid="input-aktif"
        />

        <div className="flex gap-3">
          <Tombol type="submit" disabled={sedangKirim} data-testid="tombol-simpan">
            {sedangKirim ? t.umum.sedangMenyimpan : t.umum.simpanPerubahan}
          </Tombol>
          <Link to="/internal/jabatan">
            <Tombol type="button" variasi="kedua">
              {t.umum.batal}
            </Tombol>
          </Link>
        </div>
      </Form>
    </div>
  );
}
