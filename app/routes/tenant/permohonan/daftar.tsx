import { Link } from "react-router";

import { BarisKosong, Sel, Tabel } from "~/components/internal/tabel";
import { wajibMasuk } from "~/lib/auth/sesi";
import { cloudflareContext } from "~/lib/context";
import { buatDb } from "~/lib/db";
import { permohonanTenant } from "~/modules/perizinan/query";
import { useDataRoot } from "~/root";

import type { Route } from "./+types/daftar";

export async function loader({ request, context }: Route.LoaderArgs) {
  const { env } = context.get(cloudflareContext);
  const pengguna = await wajibMasuk(env, request, ["tenant"]);
  const db = buatDb(env);

  // Tanpa tautan ke perusahaan, tidak ada permohonan yang boleh ditampilkan.
  if (!pengguna.tenantId) return { permohonan: [], tertaut: false };

  return { permohonan: await permohonanTenant(db, pengguna.tenantId), tertaut: true };
}

export default function PermohonanSaya({ loaderData }: Route.ComponentProps) {
  const { t, locale } = useDataRoot();
  const { permohonan, tertaut } = loaderData;

  const labelStatus: Record<string, string> = {
    draf: t.perizinan.statusDraf,
    diajukan: t.perizinan.statusDiajukan,
    diproses: t.perizinan.statusDiproses,
    "perlu-revisi": t.perizinan.statusPerluRevisi,
    terbit: t.perizinan.statusTerbit,
    ditolak: t.perizinan.statusDitolak,
    batal: t.perizinan.statusBatal,
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
            {t.perizinan.judulPermohonan}
          </h1>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
            {t.perizinan.keteranganPermohonan}
          </p>
        </div>
        <Link
          to="/portal/permohonan/baru"
          className="rounded-md bg-sky-700 px-4 py-2 text-sm font-medium text-white hover:bg-sky-800"
          data-testid="tombol-ajukan-baru"
        >
          {t.perizinan.ajukanBaru}
        </Link>
      </div>

      <Tabel
        testId="tabel-permohonan"
        judulKolom={[
          t.perizinan.kode,
          t.perizinan.judulPengajuan,
          t.perizinan.jenis,
          t.umum.status,
          t.perizinan.tenggat,
          t.umum.aksi,
        ]}
      >
        {permohonan.length === 0 ? (
          <BarisKosong kolom={6} pesan={t.umum.tidakAdaData} />
        ) : (
          permohonan.map((p) => (
            <tr key={p.id}>
              <Sel>
                <code className="text-xs">{p.nomor}</code>
              </Sel>
              <Sel>{p.judul}</Sel>
              <Sel>{(locale === "en" && p.namaJenisEn) || p.namaJenis}</Sel>
              <Sel>
                <span data-testid={`status-${p.id}`}>{labelStatus[p.status]}</span>
              </Sel>
              <Sel>
                <span className="whitespace-nowrap text-xs">
                  {p.tenggat ? tanggal.format(p.tenggat) : t.perizinan.tanpaTenggat}
                </span>
              </Sel>
              <Sel>
                <Link
                  to={`/portal/permohonan/${p.id}`}
                  className="text-sky-700 underline dark:text-sky-400"
                  data-testid={`buka-${p.id}`}
                >
                  {t.umum.ubah}
                </Link>
              </Sel>
            </tr>
          ))
        )}
      </Tabel>
    </div>
  );
}
