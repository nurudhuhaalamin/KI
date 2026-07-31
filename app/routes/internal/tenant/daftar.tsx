import { Form, Link, useNavigation } from "react-router";

import { Kolom, PesanGalat, Pilihan, Teks, Tombol } from "~/components/internal/kolom";
import { BarisKosong, Lencana, Sel, Tabel } from "~/components/internal/tabel";
import { catatAudit } from "~/lib/audit";
import { wajibMasuk } from "~/lib/auth/sesi";
import { cloudflareContext } from "~/lib/context";
import { buatDb } from "~/lib/db";
import { STATUS_TENANT } from "~/lib/db/schema/tenant";
import { buatTenant, daftarTenantRingkas, kodeTenantDipakai } from "~/modules/tenant/query";
import { skemaTenantBaru } from "~/modules/tenant/validasi";
import { useDataRoot } from "~/root";

import type { Route } from "./+types/daftar";

export async function loader({ request, context }: Route.LoaderArgs) {
  const { env } = context.get(cloudflareContext);
  const pengguna = await wajibMasuk(env, request, ["admin", "manajemen", "staf"]);
  const db = buatDb(env);

  // Daftar memakai proyeksi tanpa NPWP, NIB, dan kontak — data sensitif hanya
  // muncul di halaman ubah, yang aksesnya lebih sempit.
  return { daftar: await daftarTenantRingkas(db), bolehUbah: pengguna.peran === "admin" };
}

export async function action({ request, context }: Route.ActionArgs) {
  const { env } = context.get(cloudflareContext);
  const pengguna = await wajibMasuk(env, request, ["admin"]);
  const db = buatDb(env);

  const hasil = skemaTenantBaru.safeParse(Object.fromEntries(await request.formData()));
  if (!hasil.success) return { galat: hasil.error.issues[0]?.message ?? "Data tidak valid" };

  if (await kodeTenantDipakai(db, hasil.data.kode)) {
    return { galat: "kodeSudahDipakai" as const };
  }

  const id = await buatTenant(db, hasil.data);

  // Ringkasan hanya menyebut kode — bukan nama perusahaan, NPWP, atau kontak.
  await catatAudit(db, {
    userId: pengguna.id,
    aksi: "buat",
    entitas: "tenant",
    entitasId: id,
    ringkasan: `Tenant ${hasil.data.kode} dibuat`,
    request,
  });

  return { berhasil: true as const };
}

export default function DaftarTenant({ loaderData, actionData }: Route.ComponentProps) {
  const { t } = useDataRoot();
  const navigation = useNavigation();
  const sedangKirim = navigation.state === "submitting";
  const { daftar, bolehUbah } = loaderData;

  const labelStatus: Record<string, string> = {
    calon: t.tenant.statusCalon,
    aktif: t.tenant.statusAktif,
    berakhir: t.tenant.statusBerakhir,
  };

  const pesanGalat =
    actionData && "galat" in actionData
      ? actionData.galat === "kodeSudahDipakai"
        ? t.tenant.kodeSudahDipakai
        : actionData.galat
      : null;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold" data-testid="judul-halaman">
          {t.tenant.judul}
        </h1>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">{t.tenant.keterangan}</p>
      </div>

      {bolehUbah ? (
        <details className="rounded-md border border-slate-200 p-4 dark:border-slate-800">
          <summary
            className="cursor-pointer text-sm font-medium"
            data-testid="buka-form-tambah"
          >
            {t.tenant.tambahJudul}
          </summary>

          <Form method="post" className="mt-4 flex flex-col gap-4">
            <PesanGalat pesan={pesanGalat} />

            <div className="grid gap-4 sm:grid-cols-2">
              <Kolom label={t.umum.kode}>
                <Teks name="kode" required maxLength={16} data-testid="input-kode" />
              </Kolom>
              <Kolom label={t.tenant.namaPerusahaan}>
                <Teks name="namaPerusahaan" required maxLength={160} data-testid="input-nama" />
              </Kolom>
              <Kolom label={t.tenant.bentukBadanUsaha}>
                <Teks name="bentukBadanUsaha" maxLength={40} placeholder="PT / CV" />
              </Kolom>
              <Kolom label={t.tenant.bidangUsaha}>
                <Teks name="bidangUsaha" maxLength={120} />
              </Kolom>
              <Kolom label={t.tenant.status}>
                <Pilihan name="status" defaultValue="calon" data-testid="input-status">
                  {STATUS_TENANT.map((s) => (
                    <option key={s} value={s}>
                      {labelStatus[s]}
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
        testId="tabel-tenant"
        judulKolom={[
          t.umum.kode,
          t.tenant.namaPerusahaan,
          t.tenant.bidangUsaha,
          t.tenant.status,
          t.umum.status,
          t.umum.aksi,
        ]}
      >
        {daftar.length === 0 ? (
          <BarisKosong kolom={6} pesan={t.umum.tidakAdaData} />
        ) : (
          daftar.map((p) => (
            <tr key={p.id}>
              <Sel>
                <code className="text-xs">{p.kode}</code>
              </Sel>
              <Sel>{p.namaPerusahaan}</Sel>
              <Sel>{p.bidangUsaha ?? t.umum.tidakAda}</Sel>
              <Sel>{labelStatus[p.status]}</Sel>
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
                    to={`/internal/tenant/${p.id}`}
                    className="text-sky-700 underline dark:text-sky-400"
                    data-testid={`ubah-${p.kode}`}
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
