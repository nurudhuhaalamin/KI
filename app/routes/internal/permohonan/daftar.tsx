import { Link } from "react-router";

import { BarisKosong, Sel, Tabel } from "~/components/internal/tabel";
import { wajibMasuk } from "~/lib/auth/sesi";
import { cloudflareContext } from "~/lib/context";
import { buatDb } from "~/lib/db";
import { bacaPengaturanPerizinan, daftarPermohonan } from "~/modules/perizinan/query";
import { sisaHariKerja, statusSla } from "~/lib/waktu-kerja";
import { useDataRoot } from "~/root";

import type { Route } from "./+types/daftar";

export async function loader({ request, context }: Route.LoaderArgs) {
  const { env } = context.get(cloudflareContext);
  await wajibMasuk(env, request, ["admin", "manajemen", "staf"]);
  const db = buatDb(env);

  const [permohonan, { hariLibur }] = await Promise.all([
    daftarPermohonan(db),
    bacaPengaturanPerizinan(db),
  ]);

  return { permohonan, hariLibur };
}

/** Urutan tampil: yang paling mendesak lebih dulu, selesai paling belakang. */
const BOBOT_STATUS: Record<string, number> = {
  diajukan: 0,
  diproses: 0,
  "perlu-revisi": 1,
  draf: 2,
  terbit: 3,
  ditolak: 3,
  batal: 3,
};

export default function DaftarPermohonan({ loaderData }: Route.ComponentProps) {
  const { t } = useDataRoot();
  const { permohonan, hariLibur } = loaderData;
  const sekarang = new Date();

  const labelStatus: Record<string, string> = {
    draf: t.perizinan.statusDraf,
    diajukan: t.perizinan.statusDiajukan,
    diproses: t.perizinan.statusDiproses,
    "perlu-revisi": t.perizinan.statusPerluRevisi,
    terbit: t.perizinan.statusTerbit,
    ditolak: t.perizinan.statusDitolak,
    batal: t.perizinan.statusBatal,
  };

  const gayaSla: Record<string, string> = {
    terlambat: "text-rose-700 dark:text-rose-400",
    mendekati: "text-amber-700 dark:text-amber-400",
    aman: "text-slate-600 dark:text-slate-400",
  };

  const terurut = [...permohonan].sort((a, b) => {
    const bobot = (BOBOT_STATUS[a.status] ?? 9) - (BOBOT_STATUS[b.status] ?? 9);
    if (bobot !== 0) return bobot;
    // Dalam bobot yang sama, tenggat terdekat di atas; yang tanpa tenggat terakhir.
    if (!a.tenggat) return 1;
    if (!b.tenggat) return -1;
    return a.tenggat.getTime() - b.tenggat.getTime();
  });

  /** Keterangan tenggat yang langsung terbaca tanpa menghitung sendiri. */
  function keteranganTenggat(tenggat: Date | null, status: string): string {
    if (!tenggat) return t.perizinan.tanpaTenggat;
    if (status !== "diajukan" && status !== "diproses") return "—";

    const sisa = sisaHariKerja(tenggat, sekarang, hariLibur);
    if (sisa < 0) return t.perizinan.terlambatHari.replace("{n}", String(Math.abs(sisa)));
    if (sisa === 0) return t.perizinan.tenggatHariIni;
    return t.perizinan.sisaHari.replace("{n}", String(sisa));
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold" data-testid="judul-halaman">
          {t.perizinan.judulPermohonan}
        </h1>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
          {t.perizinan.keteranganPermohonan}
        </p>
      </div>

      <Tabel
        testId="tabel-permohonan"
        judulKolom={[
          t.perizinan.kode,
          t.perizinan.judulPengajuan,
          t.perizinan.pemohon,
          t.umum.status,
          t.perizinan.tenggat,
          t.umum.aksi,
        ]}
      >
        {terurut.length === 0 ? (
          <BarisKosong kolom={6} pesan={t.umum.tidakAdaData} />
        ) : (
          terurut.map((p) => (
            <tr key={p.id}>
              <Sel>
                <code className="text-xs" data-testid={`nomor-${p.id}`}>
                  {p.nomor}
                </code>
              </Sel>
              <Sel>{p.judul}</Sel>
              <Sel>{p.namaTenant}</Sel>
              <Sel>
                <span data-testid={`status-${p.id}`}>{labelStatus[p.status]}</span>
              </Sel>
              <Sel>
                <span
                  className={`whitespace-nowrap text-xs ${gayaSla[statusSla(p.tenggat, sekarang, 1, hariLibur)]}`}
                  data-testid={`tenggat-${p.id}`}
                >
                  {keteranganTenggat(p.tenggat, p.status)}
                </span>
              </Sel>
              <Sel>
                <Link
                  to={`/internal/permohonan/${p.id}`}
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
