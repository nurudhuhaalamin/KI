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
import { catatAudit } from "~/lib/audit";
import { wajibMasuk } from "~/lib/auth/sesi";
import { cloudflareContext } from "~/lib/context";
import { buatDb } from "~/lib/db";
import { STATUS_TENANT } from "~/lib/db/schema/tenant";
import { ambilTenant, ringkasAuditTenant, ubahTenant } from "~/modules/tenant/query";
import { skemaTenantUbah } from "~/modules/tenant/validasi";
import { useDataRoot } from "~/root";

import type { Route } from "./+types/ubah";

export async function loader({ request, params, context }: Route.LoaderArgs) {
  const { env } = context.get(cloudflareContext);
  // Data lengkap tenant memuat NPWP, NIB, dan kontak; hanya administrator.
  await wajibMasuk(env, request, ["admin"]);
  const db = buatDb(env);

  const data = await ambilTenant(db, params.id);
  if (!data) throw new Response("Tidak ditemukan", { status: 404 });
  return { tenant: data };
}

export async function action({ request, params, context }: Route.ActionArgs) {
  const { env } = context.get(cloudflareContext);
  const pengguna = await wajibMasuk(env, request, ["admin"]);
  const db = buatDb(env);

  const sebelum = await ambilTenant(db, params.id);
  if (!sebelum) throw new Response("Tidak ditemukan", { status: 404 });

  const formulir = Object.fromEntries(await request.formData());
  const hasil = skemaTenantUbah.safeParse({ ...formulir, aktif: formulir.aktif === "on" });
  if (!hasil.success) return { galat: hasil.error.issues[0]?.message ?? "Data tidak valid" };

  await ubahTenant(db, params.id, hasil.data);

  // ringkasAuditTenant hanya menuliskan NAMA field yang berubah, tidak nilainya.
  await catatAudit(db, {
    userId: pengguna.id,
    aksi: "ubah",
    entitas: "tenant",
    entitasId: params.id,
    ringkasan: ringkasAuditTenant(
      sebelum.kode,
      {
        namaPerusahaan: sebelum.namaPerusahaan,
        npwp: sebelum.npwp,
        nib: sebelum.nib,
        kontakSurel: sebelum.kontakSurel,
        status: sebelum.status,
        aktif: sebelum.aktif,
      },
      {
        namaPerusahaan: hasil.data.namaPerusahaan,
        npwp: hasil.data.npwp ?? null,
        nib: hasil.data.nib ?? null,
        kontakSurel: hasil.data.kontakSurel ?? null,
        status: hasil.data.status,
        aktif: hasil.data.aktif,
      },
    ),
    request,
  });

  return redirect(`/internal/tenant/${params.id}?tersimpan=1`);
}

export default function UbahTenant({ loaderData, actionData }: Route.ComponentProps) {
  const { t } = useDataRoot();
  const navigation = useNavigation();
  const sedangKirim = navigation.state === "submitting";
  const { tenant } = loaderData;

  const [paramPencarian] = useSearchParams();
  const tersimpan = paramPencarian.has("tersimpan");

  const labelStatus: Record<string, string> = {
    calon: t.tenant.statusCalon,
    aktif: t.tenant.statusAktif,
    berakhir: t.tenant.statusBerakhir,
  };

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link
          to="/internal/tenant"
          className="text-sm text-sky-700 underline dark:text-sky-400"
        >
          ← {t.tenant.judul}
        </Link>
        <h1 className="mt-2 text-2xl font-semibold" data-testid="judul-halaman">
          {t.tenant.ubahJudul}
        </h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          <code>{tenant.kode}</code>
        </p>
      </div>

      <Form method="post" className="flex max-w-2xl flex-col gap-4">
        <PesanGalat pesan={actionData?.galat} />
        {tersimpan && !actionData?.galat ? (
          <PesanBerhasil pesan={t.umum.berhasilDisimpan} />
        ) : null}

        <div className="grid gap-4 sm:grid-cols-2">
          <Kolom label={t.tenant.namaPerusahaan}>
            <Teks
              name="namaPerusahaan"
              required
              defaultValue={tenant.namaPerusahaan}
              data-testid="input-nama"
            />
          </Kolom>
          <Kolom label={t.tenant.bentukBadanUsaha}>
            <Teks name="bentukBadanUsaha" defaultValue={tenant.bentukBadanUsaha ?? ""} />
          </Kolom>
          <Kolom label={t.tenant.bidangUsaha}>
            <Teks name="bidangUsaha" defaultValue={tenant.bidangUsaha ?? ""} />
          </Kolom>
          <Kolom label={t.tenant.status}>
            <Pilihan name="status" defaultValue={tenant.status} data-testid="input-status">
              {STATUS_TENANT.map((s) => (
                <option key={s} value={s}>
                  {labelStatus[s]}
                </option>
              ))}
            </Pilihan>
          </Kolom>
        </div>

        <Kolom label={t.tenant.alamat}>
          <AreaTeks name="alamat" defaultValue={tenant.alamat ?? ""} maxLength={400} />
        </Kolom>

        <fieldset className="rounded-md border border-amber-300 p-4 dark:border-amber-800">
          <legend className="px-1 text-sm font-medium">{t.tenant.dataLegal}</legend>
          <p className="mb-3 text-xs text-slate-600 dark:text-slate-400">
            {t.tenant.dataLegalPetunjuk}
          </p>
          <div className="grid gap-4 sm:grid-cols-2">
            <Kolom label={t.tenant.npwp}>
              <Teks name="npwp" defaultValue={tenant.npwp ?? ""} maxLength={30} />
            </Kolom>
            <Kolom label={t.tenant.nib}>
              <Teks name="nib" defaultValue={tenant.nib ?? ""} maxLength={30} />
            </Kolom>
            <Kolom label={t.tenant.kontakNama}>
              <Teks name="kontakNama" defaultValue={tenant.kontakNama ?? ""} maxLength={120} />
            </Kolom>
            <Kolom label={t.tenant.kontakJabatan}>
              <Teks
                name="kontakJabatan"
                defaultValue={tenant.kontakJabatan ?? ""}
                maxLength={80}
              />
            </Kolom>
            <Kolom label={t.tenant.kontakSurel}>
              <Teks type="email" name="kontakSurel" defaultValue={tenant.kontakSurel ?? ""} />
            </Kolom>
            <Kolom label={t.tenant.kontakTelepon}>
              <Teks
                name="kontakTelepon"
                defaultValue={tenant.kontakTelepon ?? ""}
                maxLength={40}
              />
            </Kolom>
          </div>
        </fieldset>

        <Centang name="aktif" label={t.umum.aktif} defaultChecked={tenant.aktif} />

        <div className="flex gap-3">
          <Tombol type="submit" disabled={sedangKirim} data-testid="tombol-simpan">
            {sedangKirim ? t.umum.sedangMenyimpan : t.umum.simpanPerubahan}
          </Tombol>
          <Link to="/internal/tenant">
            <Tombol type="button" variasi="kedua">
              {t.umum.batal}
            </Tombol>
          </Link>
        </div>
      </Form>
    </div>
  );
}
