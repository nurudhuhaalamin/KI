import { Form, Link, redirect, useNavigation, useSearchParams } from "react-router";

import {
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
import { PERAN } from "~/lib/db/schema/auth";
import { bolehMenurunkanAdmin } from "~/modules/organisasi/hierarki";
import {
  ambilPengguna,
  daftarJabatan,
  daftarPengguna,
  daftarUnitKerja,
  gantiKataSandi,
  ubahPengguna,
} from "~/modules/organisasi/query";
import { skemaKataSandiBaru, skemaPenggunaUbah } from "~/modules/organisasi/validasi";
import { useDataRoot } from "~/root";

import type { Route } from "./+types/ubah";

export async function loader({ request, params, context }: Route.LoaderArgs) {
  const { env } = context.get(cloudflareContext);
  await wajibMasuk(env, request, ["admin"]);
  const db = buatDb(env);

  const target = await ambilPengguna(db, params.id);
  if (!target) throw new Response("Tidak ditemukan", { status: 404 });

  const [unit, jabatan] = await Promise.all([daftarUnitKerja(db), daftarJabatan(db)]);

  return {
    target: {
      id: target.id,
      nama: target.name,
      surel: target.email,
      peran: target.peran,
      aktif: target.aktif,
      unitKerjaId: target.unitKerjaId,
      jabatanId: target.jabatanId,
    },
    unit,
    jabatan,
  };
}

export async function action({ request, params, context }: Route.ActionArgs) {
  const { env } = context.get(cloudflareContext);
  const pengelola = await wajibMasuk(env, request, ["admin"]);
  const db = buatDb(env);

  const sebelum = await ambilPengguna(db, params.id);
  if (!sebelum) throw new Response("Tidak ditemukan", { status: 404 });

  const formulir = Object.fromEntries(await request.formData());

  if (formulir.maksud === "kata-sandi") {
    const hasil = skemaKataSandiBaru.safeParse(formulir);
    if (!hasil.success) {
      return { galat: hasil.error.issues[0]?.message ?? "Data tidak valid" };
    }

    await gantiKataSandi(db, params.id, hasil.data.kataSandi);
    await catatAudit(db, {
      userId: pengelola.id,
      aksi: "ubah",
      entitas: "pengguna",
      entitasId: params.id,
      ringkasan: "Kata sandi diganti oleh administrator",
      request,
    });

    return redirect(`/internal/pengguna/${params.id}?sandi=1`);
  }

  const hasil = skemaPenggunaUbah.safeParse({ ...formulir, aktif: formulir.aktif === "on" });
  if (!hasil.success) {
    return { galat: hasil.error.issues[0]?.message ?? "Data tidak valid" };
  }

  // Menonaktifkan diri sendiri akan langsung mengunci pengelola dari sesinya.
  if (params.id === pengelola.id && !hasil.data.aktif) {
    return { galat: "diriSendiri" as const };
  }

  // Tanpa penjaga ini, satu klik keliru bisa mengunci kawasan dari sistemnya
  // sendiri tanpa cara pulih selain menyunting database langsung.
  const semua = await daftarPengguna(db);
  if (!bolehMenurunkanAdmin(semua, params.id, hasil.data.peran, hasil.data.aktif)) {
    return { galat: "adminTerakhir" as const };
  }

  await ubahPengguna(db, params.id, hasil.data);
  await catatAudit(db, {
    userId: pengelola.id,
    aksi: "ubah",
    entitas: "pengguna",
    entitasId: params.id,
    ringkasan: ringkasPerubahan(
      {
        nama: sebelum.name,
        peran: sebelum.peran,
        aktif: sebelum.aktif,
        unitKerjaId: sebelum.unitKerjaId,
        jabatanId: sebelum.jabatanId,
      },
      {
        nama: hasil.data.nama,
        peran: hasil.data.peran,
        aktif: hasil.data.aktif,
        unitKerjaId: hasil.data.unitKerjaId ?? null,
        jabatanId: hasil.data.jabatanId ?? null,
      },
    ),
    request,
  });

  return redirect(`/internal/pengguna/${params.id}?tersimpan=1`);
}

export default function UbahPengguna({ loaderData, actionData }: Route.ComponentProps) {
  const { t } = useDataRoot();
  const navigation = useNavigation();
  const sedangKirim = navigation.state === "submitting";
  const { target, unit, jabatan } = loaderData;

  const [paramPencarian] = useSearchParams();
  const tersimpan = paramPencarian.has("tersimpan");
  const sandiDiganti = paramPencarian.has("sandi");

  const labelPeran: Record<string, string> = {
    admin: t.pengguna.peranAdmin,
    manajemen: t.pengguna.peranManajemen,
    staf: t.pengguna.peranStaf,
    tenant: t.pengguna.peranTenant,
  };

  const pesanGalat = actionData?.galat
    ? actionData.galat === "adminTerakhir"
      ? t.pengguna.adminTerakhir
      : actionData.galat === "diriSendiri"
        ? t.pengguna.tidakBolehDiriSendiri
        : actionData.galat
    : null;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link
          to="/internal/pengguna"
          className="text-sm text-sky-700 underline dark:text-sky-400"
        >
          ← {t.pengguna.judul}
        </Link>
        <h1 className="mt-2 text-2xl font-semibold" data-testid="judul-halaman">
          {t.pengguna.ubahJudul}
        </h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{target.surel}</p>
      </div>

      <Form method="post" className="flex max-w-2xl flex-col gap-4">
        <PesanGalat pesan={pesanGalat} />
        {tersimpan && !pesanGalat ? <PesanBerhasil pesan={t.umum.berhasilDisimpan} /> : null}

        <div className="grid gap-4 sm:grid-cols-2">
          <Kolom label={t.umum.nama}>
            <Teks name="nama" required defaultValue={target.nama} data-testid="input-nama" />
          </Kolom>
          <Kolom label={t.pengguna.peran}>
            <Pilihan name="peran" defaultValue={target.peran} data-testid="input-peran">
              {PERAN.map((p) => (
                <option key={p} value={p}>
                  {labelPeran[p]}
                </option>
              ))}
            </Pilihan>
          </Kolom>
          <Kolom label={t.pengguna.unitKerja}>
            <Pilihan name="unitKerjaId" defaultValue={target.unitKerjaId ?? ""}>
              <option value="">{t.pengguna.tanpaUnitKerja}</option>
              {unit.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.kode} — {u.nama}
                </option>
              ))}
            </Pilihan>
          </Kolom>
          <Kolom label={t.pengguna.jabatan}>
            <Pilihan name="jabatanId" defaultValue={target.jabatanId ?? ""}>
              <option value="">{t.pengguna.tanpaJabatan}</option>
              {jabatan.map((j) => (
                <option key={j.id} value={j.id}>
                  {j.kode} — {j.nama}
                </option>
              ))}
            </Pilihan>
          </Kolom>
        </div>

        <Centang
          name="aktif"
          label={t.umum.aktif}
          defaultChecked={target.aktif}
          data-testid="input-aktif"
        />

        <div className="flex gap-3">
          <Tombol type="submit" disabled={sedangKirim} data-testid="tombol-simpan">
            {sedangKirim ? t.umum.sedangMenyimpan : t.umum.simpanPerubahan}
          </Tombol>
          <Link to="/internal/pengguna">
            <Tombol type="button" variasi="kedua">
              {t.umum.batal}
            </Tombol>
          </Link>
        </div>
      </Form>

      <div className="max-w-2xl border-t border-slate-200 pt-6 dark:border-slate-800">
        <h2 className="text-lg font-medium">{t.pengguna.gantiKataSandi}</h2>
        {sandiDiganti ? <PesanBerhasil pesan={t.pengguna.kataSandiDiganti} /> : null}

        <Form method="post" className="mt-3 flex flex-col gap-4">
          <input type="hidden" name="maksud" value="kata-sandi" />
          <Kolom label={t.pengguna.kataSandiBaru} petunjuk={t.pengguna.kataSandiPetunjuk}>
            <Teks
              type="password"
              name="kataSandi"
              required
              minLength={12}
              autoComplete="new-password"
              data-testid="input-kata-sandi-baru"
            />
          </Kolom>
          <div>
            <Tombol
              type="submit"
              variasi="kedua"
              disabled={sedangKirim}
              data-testid="tombol-ganti-sandi"
            >
              {t.pengguna.gantiKataSandi}
            </Tombol>
          </div>
        </Form>
      </div>
    </div>
  );
}
