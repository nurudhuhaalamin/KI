import { Form, redirect, useNavigation, useSearchParams } from "react-router";

import {
  AreaTeks,
  Kolom,
  PesanBerhasil,
  PesanGalat,
  Pilihan,
  Teks,
  Tombol,
} from "~/components/internal/kolom";
import { catatAudit } from "~/lib/audit";
import { wajibMasuk } from "~/lib/auth/sesi";
import { cloudflareContext } from "~/lib/context";
import { buatDb } from "~/lib/db";
import { KUNCI_PENGATURAN, bacaPengaturan, simpanPengaturan } from "~/modules/organisasi/query";
import { skemaPengaturan } from "~/modules/organisasi/validasi";
import { useDataRoot } from "~/root";

import type { Route } from "./+types/pengaturan";

export async function loader({ request, context }: Route.LoaderArgs) {
  const { env } = context.get(cloudflareContext);
  const pengguna = await wajibMasuk(env, request, ["admin", "manajemen"]);
  const db = buatDb(env);

  return {
    nilai: await bacaPengaturan(db),
    bolehUbah: pengguna.peran === "admin",
  };
}

export async function action({ request, context }: Route.ActionArgs) {
  const { env } = context.get(cloudflareContext);
  const pengguna = await wajibMasuk(env, request, ["admin"]);
  const db = buatDb(env);

  const formulir = Object.fromEntries(await request.formData());
  const hasil = skemaPengaturan.safeParse(formulir);
  if (!hasil.success) {
    return { galat: hasil.error.issues[0]?.message ?? "Data tidak valid" };
  }

  await simpanPengaturan(db, {
    [KUNCI_PENGATURAN.nama]: hasil.data.nama,
    [KUNCI_PENGATURAN.alamat]: hasil.data.alamat ?? "",
    [KUNCI_PENGATURAN.kontakSurel]: hasil.data.kontakSurel ?? "",
    [KUNCI_PENGATURAN.kontakTelepon]: hasil.data.kontakTelepon ?? "",
    [KUNCI_PENGATURAN.localeBawaan]: hasil.data.localeBawaan,
  });

  await catatAudit(db, {
    userId: pengguna.id,
    aksi: "ubah",
    entitas: "pengaturan",
    entitasId: "kawasan",
    ringkasan: "Profil kawasan diperbarui",
    request,
  });

  return redirect("/internal/pengaturan?tersimpan=1");
}

export default function Pengaturan({ loaderData, actionData }: Route.ComponentProps) {
  const { t } = useDataRoot();
  const navigation = useNavigation();
  const sedangKirim = navigation.state === "submitting";
  const { nilai, bolehUbah } = loaderData;

  const [paramPencarian] = useSearchParams();
  const tersimpan = paramPencarian.has("tersimpan");

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold" data-testid="judul-halaman">
          {t.pengaturan.judul}
        </h1>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
          {t.pengaturan.keterangan}
        </p>
      </div>

      <Form method="post" className="flex max-w-2xl flex-col gap-4">
        <PesanGalat pesan={actionData?.galat} />
        {tersimpan && !actionData?.galat ? (
          <PesanBerhasil pesan={t.umum.berhasilDisimpan} />
        ) : null}

        <Kolom label={t.pengaturan.namaKawasan}>
          <Teks
            name="nama"
            required
            disabled={!bolehUbah}
            defaultValue={nilai[KUNCI_PENGATURAN.nama] ?? ""}
            data-testid="input-nama-kawasan"
          />
        </Kolom>

        <Kolom label={t.pengaturan.alamat}>
          <AreaTeks
            name="alamat"
            disabled={!bolehUbah}
            defaultValue={nilai[KUNCI_PENGATURAN.alamat] ?? ""}
            maxLength={500}
          />
        </Kolom>

        <div className="grid gap-4 sm:grid-cols-2">
          <Kolom label={t.pengaturan.kontakSurel}>
            <Teks
              type="email"
              name="kontakSurel"
              disabled={!bolehUbah}
              defaultValue={nilai[KUNCI_PENGATURAN.kontakSurel] ?? ""}
            />
          </Kolom>
          <Kolom label={t.pengaturan.kontakTelepon}>
            <Teks
              name="kontakTelepon"
              disabled={!bolehUbah}
              defaultValue={nilai[KUNCI_PENGATURAN.kontakTelepon] ?? ""}
              maxLength={40}
            />
          </Kolom>
        </div>

        <Kolom label={t.pengaturan.localeBawaan}>
          <Pilihan
            name="localeBawaan"
            disabled={!bolehUbah}
            defaultValue={nilai[KUNCI_PENGATURAN.localeBawaan] ?? "id"}
          >
            <option value="id">Bahasa Indonesia</option>
            <option value="en">English</option>
          </Pilihan>
        </Kolom>

        {bolehUbah ? (
          <div>
            <Tombol type="submit" disabled={sedangKirim} data-testid="tombol-simpan">
              {sedangKirim ? t.umum.sedangMenyimpan : t.umum.simpanPerubahan}
            </Tombol>
          </div>
        ) : (
          <p className="text-sm text-slate-500 dark:text-slate-400">{t.umum.hanyaBaca}</p>
        )}
      </Form>
    </div>
  );
}
