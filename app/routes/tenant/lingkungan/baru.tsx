import { Form, Link, redirect, useNavigation } from "react-router";

import {
  AreaTeks,
  Kolom,
  PesanGalat,
  Pilihan,
  Teks,
  Tombol,
} from "~/components/internal/kolom";
import { catatAudit } from "~/lib/audit";
import { wajibMasuk } from "~/lib/auth/sesi";
import { cloudflareContext } from "~/lib/context";
import { buatDb } from "~/lib/db";
import { JENIS_DOKUMEN_LINGKUNGAN } from "~/lib/db/schema/lingkungan";
import { buatDokumenLingkungan } from "~/modules/lingkungan/query";
import { skemaDokumenLingkunganBaru } from "~/modules/lingkungan/validasi";
import { daftarKavling } from "~/modules/kavling/query";
import { useDataRoot } from "~/root";

import type { Route } from "./+types/baru";

export async function loader({ request, context }: Route.LoaderArgs) {
  const { env } = context.get(cloudflareContext);
  const pengguna = await wajibMasuk(env, request, ["tenant"]);
  const db = buatDb(env);

  return { kavling: await daftarKavling(db), tertaut: pengguna.tenantId !== null };
}

export async function action({ request, context }: Route.ActionArgs) {
  const { env } = context.get(cloudflareContext);
  const pengguna = await wajibMasuk(env, request, ["tenant"]);
  const db = buatDb(env);

  if (!pengguna.tenantId) throw new Response("Akses ditolak", { status: 403 });

  const hasil = skemaDokumenLingkunganBaru.safeParse(
    Object.fromEntries(await request.formData()),
  );
  if (!hasil.success) return { galat: hasil.error.issues[0]?.message ?? "Data tidak valid" };

  const { id, nomor } = await buatDokumenLingkungan(db, {
    ...hasil.data,
    tenantId: pengguna.tenantId,
    diajukanOleh: pengguna.id,
  });

  await catatAudit(db, {
    userId: pengguna.id,
    aksi: "buat",
    entitas: "dokumen_lingkungan",
    entitasId: id,
    ringkasan: `Dokumen lingkungan ${nomor} dibuat`,
    request,
  });

  return redirect(`/portal/lingkungan/${id}?dibuat=1`);
}

export default function DokumenLingkunganBaru({
  loaderData,
  actionData,
}: Route.ComponentProps) {
  const { t } = useDataRoot();
  const navigation = useNavigation();
  const sedangKirim = navigation.state === "submitting";
  const { kavling, tertaut } = loaderData;

  const labelJenis: Record<string, string> = {
    "rkl-rpl-rinci": t.lingkungan.jenisRklRplRinci,
    "ukl-upl": t.lingkungan.jenisUklUpl,
    "rintek-air-limbah": t.lingkungan.jenisRintekAirLimbah,
    "rintek-emisi": t.lingkungan.jenisRintekEmisi,
    sppl: t.lingkungan.jenisSppl,
  };

  if (!tertaut) {
    return (
      <p className="text-sm text-slate-600 dark:text-slate-400">{t.portal.belumTertaut}</p>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link
          to="/portal/lingkungan"
          className="text-sm text-sky-700 underline dark:text-sky-400"
        >
          ← {t.lingkungan.judulTenant}
        </Link>
        <h1 className="mt-2 text-2xl font-semibold" data-testid="judul-halaman">
          {t.lingkungan.ajukanBaru}
        </h1>
      </div>

      <PesanGalat pesan={actionData && "galat" in actionData ? actionData.galat : null} />

      <Form method="post" className="flex max-w-2xl flex-col gap-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Kolom label={t.lingkungan.jenis}>
            <Pilihan name="jenis" defaultValue="rkl-rpl-rinci" data-testid="input-jenis">
              {JENIS_DOKUMEN_LINGKUNGAN.map((j) => (
                <option key={j} value={j}>
                  {labelJenis[j]}
                </option>
              ))}
            </Pilihan>
          </Kolom>
          <Kolom label={t.lingkungan.judulDokumen}>
            <Teks name="judul" required maxLength={200} data-testid="input-judul" />
          </Kolom>
          <Kolom label={t.lingkungan.kavling}>
            <Pilihan name="kavlingId" defaultValue="" data-testid="input-kavling">
              <option value="">{t.lingkungan.tanpaKavling}</option>
              {kavling.map((k) => (
                <option key={k.id} value={k.id}>
                  {k.kode}
                </option>
              ))}
            </Pilihan>
          </Kolom>
        </div>

        <Kolom label={t.lingkungan.ringkasanKegiatan}>
          <AreaTeks
            name="ringkasanKegiatan"
            rows={4}
            maxLength={4000}
            data-testid="input-ringkasan"
          />
        </Kolom>

        <div>
          <Tombol type="submit" disabled={sedangKirim} data-testid="tombol-simpan">
            {sedangKirim ? t.umum.sedangMenyimpan : t.umum.simpan}
          </Tombol>
        </div>
      </Form>
    </div>
  );
}
