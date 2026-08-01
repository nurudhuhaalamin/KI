import { Link } from "react-router";

import { BarisKosong, Sel, Tabel } from "~/components/internal/tabel";
import { wajibMasuk } from "~/lib/auth/sesi";
import { cloudflareContext } from "~/lib/context";
import { buatDb } from "~/lib/db";
import { dokumenLingkunganTenant } from "~/modules/lingkungan/query";
import { menungguTenant } from "~/modules/lingkungan/tahapan";
import { useDataRoot } from "~/root";

import type { Route } from "./+types/daftar";

export async function loader({ request, context }: Route.LoaderArgs) {
  const { env } = context.get(cloudflareContext);
  const pengguna = await wajibMasuk(env, request, ["tenant"]);
  const db = buatDb(env);

  if (!pengguna.tenantId) return { dokumen: [], tertaut: false };
  return { dokumen: await dokumenLingkunganTenant(db, pengguna.tenantId), tertaut: true };
}

export default function DokumenLingkunganSaya({ loaderData }: Route.ComponentProps) {
  const { t, locale } = useDataRoot();
  const { dokumen, tertaut } = loaderData;

  const labelStatus: Record<string, string> = {
    draf: t.lingkungan.statusDraf,
    diajukan: t.lingkungan.statusDiajukan,
    "pemeriksaan-administrasi": t.lingkungan.statusPemeriksaanAdministrasi,
    "perlu-dilengkapi": t.lingkungan.statusPerluDilengkapi,
    "pemeriksaan-substansi": t.lingkungan.statusPemeriksaanSubstansi,
    "perlu-diperbaiki": t.lingkungan.statusPerluDiperbaiki,
    disetujui: t.lingkungan.statusDisetujui,
    ditolak: t.lingkungan.statusDitolak,
    batal: t.lingkungan.statusBatal,
  };
  const labelJenis: Record<string, string> = {
    "rkl-rpl-rinci": t.lingkungan.jenisRklRplRinci,
    "ukl-upl": t.lingkungan.jenisUklUpl,
    "rintek-air-limbah": t.lingkungan.jenisRintekAirLimbah,
    "rintek-emisi": t.lingkungan.jenisRintekEmisi,
    sppl: t.lingkungan.jenisSppl,
  };

  const tanggal = new Intl.DateTimeFormat(locale === "en" ? "en-GB" : "id-ID", {
    dateStyle: "medium",
  });

  if (!tertaut) {
    return (
      <p className="text-sm text-slate-600 dark:text-slate-400">{t.portal.belumTertaut}</p>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold" data-testid="judul-halaman">
            {t.lingkungan.judulTenant}
          </h1>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
            {t.lingkungan.keterangan}
          </p>
        </div>
        <Link
          to="/portal/lingkungan/baru"
          className="rounded-md bg-sky-700 px-4 py-2 text-sm font-medium text-white hover:bg-sky-800"
          data-testid="tombol-ajukan-baru"
        >
          {t.lingkungan.ajukanBaru}
        </Link>
      </div>

      <Tabel
        testId="tabel-lingkungan"
        judulKolom={[
          t.umum.kode,
          t.lingkungan.judulDokumen,
          t.lingkungan.jenis,
          t.umum.status,
          t.lingkungan.tenggat,
          t.umum.aksi,
        ]}
      >
        {dokumen.length === 0 ? (
          <BarisKosong kolom={6} pesan={t.umum.tidakAdaData} />
        ) : (
          dokumen.map((d) => {
            // Bagi pemohon yang penting bukan sisa jam kawasan, melainkan apakah
            // bola sedang ada di tangannya sendiri.
            const giliranTenant = menungguTenant(d.status);
            const tenggat = d.tenggatSubstansi ?? d.tenggatAdministrasi;

            return (
              <tr key={d.id}>
                <Sel>
                  <code className="text-xs">{d.nomor}</code>
                </Sel>
                <Sel>{d.judul}</Sel>
                <Sel>{labelJenis[d.jenis]}</Sel>
                <Sel>
                  <span data-testid={`status-${d.id}`}>{labelStatus[d.status]}</span>
                </Sel>
                <Sel>
                  <span className="whitespace-nowrap text-xs">
                    {giliranTenant || !tenggat
                      ? t.lingkungan.tanpaTenggat
                      : tanggal.format(tenggat)}
                  </span>
                </Sel>
                <Sel>
                  <Link
                    to={`/portal/lingkungan/${d.id}`}
                    className="text-sky-700 underline dark:text-sky-400"
                    data-testid={`buka-${d.id}`}
                  >
                    {t.umum.ubah}
                  </Link>
                </Sel>
              </tr>
            );
          })
        )}
      </Tabel>
    </div>
  );
}
