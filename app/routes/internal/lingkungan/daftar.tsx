import { Link } from "react-router";

import { BarisKosong, Sel, Tabel } from "~/components/internal/tabel";
import { wajibMasuk } from "~/lib/auth/sesi";
import { cloudflareContext } from "~/lib/context";
import { buatDb } from "~/lib/db";
import { sisaHariKerja } from "~/lib/waktu-kerja";
import { bacaPengaturanLingkungan, daftarDokumenLingkungan } from "~/modules/lingkungan/query";
import { keadaanTenggat } from "~/modules/lingkungan/tahapan";
import { useDataRoot } from "~/root";

import type { Route } from "./+types/daftar";

export async function loader({ request, context }: Route.LoaderArgs) {
  const { env } = context.get(cloudflareContext);
  await wajibMasuk(env, request, ["admin", "manajemen", "staf"]);
  const db = buatDb(env);

  const [dokumen, { hariLibur }] = await Promise.all([
    daftarDokumenLingkungan(db),
    bacaPengaturanLingkungan(db),
  ]);

  return { dokumen, hariLibur };
}

/** Yang jamnya sedang berjalan di atas; yang selesai paling belakang. */
const BOBOT_STATUS: Record<string, number> = {
  diajukan: 0,
  "pemeriksaan-administrasi": 0,
  "pemeriksaan-substansi": 0,
  "perlu-dilengkapi": 1,
  "perlu-diperbaiki": 1,
  draf: 2,
  disetujui: 3,
  ditolak: 3,
  batal: 3,
};

export default function DaftarLingkungan({ loaderData }: Route.ComponentProps) {
  const { t } = useDataRoot();
  const { dokumen, hariLibur } = loaderData;
  const sekarang = new Date();

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
  const gaya: Record<string, string> = {
    terlambat: "text-rose-700 dark:text-rose-400",
    mendekati: "text-amber-700 dark:text-amber-400",
    aman: "text-slate-600 dark:text-slate-400",
  };

  const terurut = [...dokumen].sort((a, b) => {
    const bobot = (BOBOT_STATUS[a.status] ?? 9) - (BOBOT_STATUS[b.status] ?? 9);
    if (bobot !== 0) return bobot;

    const ta = keadaanTenggat(a.status, a.tenggatAdministrasi, a.tenggatSubstansi).tenggat;
    const tb = keadaanTenggat(b.status, b.tenggatAdministrasi, b.tenggatSubstansi).tenggat;
    if (!ta) return 1;
    if (!tb) return -1;
    return ta.getTime() - tb.getTime();
  });

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold" data-testid="judul-halaman">
          {t.lingkungan.judul}
        </h1>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
          {t.lingkungan.keterangan}
        </p>
      </div>

      <Tabel
        testId="tabel-lingkungan"
        judulKolom={[
          t.umum.kode,
          t.lingkungan.judulDokumen,
          t.lingkungan.pemohon,
          t.umum.status,
          t.lingkungan.tenggat,
          t.umum.aksi,
        ]}
      >
        {terurut.length === 0 ? (
          <BarisKosong kolom={6} pesan={t.umum.tidakAdaData} />
        ) : (
          terurut.map((d) => {
            const keadaan = keadaanTenggat(
              d.status,
              d.tenggatAdministrasi,
              d.tenggatSubstansi,
              sekarang,
              hariLibur,
            );

            const keterangan = (() => {
              if (!keadaan.tenggat) {
                return d.status === "draf"
                  ? t.lingkungan.tanpaTenggat
                  : t.lingkungan.menungguTenant;
              }
              const sisa = sisaHariKerja(keadaan.tenggat, sekarang, hariLibur);
              if (sisa < 0)
                return t.lingkungan.terlambatHari.replace("{n}", String(Math.abs(sisa)));
              if (sisa === 0) return t.lingkungan.tenggatHariIni;
              return t.lingkungan.sisaHari.replace("{n}", String(sisa));
            })();

            return (
              <tr key={d.id}>
                <Sel>
                  <code className="text-xs" data-testid={`nomor-${d.id}`}>
                    {d.nomor}
                  </code>
                </Sel>
                <Sel>
                  {d.judul}
                  <span className="block text-xs text-slate-500 dark:text-slate-400">
                    {labelJenis[d.jenis]}
                  </span>
                </Sel>
                <Sel>{d.namaTenant}</Sel>
                <Sel>
                  <span data-testid={`status-${d.id}`}>{labelStatus[d.status]}</span>
                </Sel>
                <Sel>
                  <span
                    className={`whitespace-nowrap text-xs ${gaya[keadaan.status]}`}
                    data-testid={`tenggat-${d.id}`}
                  >
                    {keterangan}
                  </span>
                </Sel>
                <Sel>
                  <Link
                    to={`/internal/lingkungan/${d.id}`}
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
