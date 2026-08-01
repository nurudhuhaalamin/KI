import { and, count, eq } from "drizzle-orm";
import { Link } from "react-router";

import { wajibMasuk } from "~/lib/auth/sesi";
import { cloudflareContext } from "~/lib/context";
import { buatDb } from "~/lib/db";
import { users } from "~/lib/db/schema/auth";
import { dokumen } from "~/lib/db/schema/dokumen";
import { jabatan, unitKerja } from "~/lib/db/schema/organisasi";
import { dokumenJatuhTempo } from "~/modules/dokumen/penomoran";
import { daftarDokumenLingkungan, laporanBerjalan } from "~/modules/lingkungan/query";
import { laporanTertunggak } from "~/modules/lingkungan/pemantauan";
import { lingkunganMendesak } from "~/modules/lingkungan/tahapan";
import { bacaPengaturanPerizinan, daftarPermohonan } from "~/modules/perizinan/query";
import { permohonanMendesak } from "~/modules/perizinan/sla";
import { useDataRoot } from "~/root";

import type { Route } from "./+types/dasbor";

export async function loader({ request, context }: Route.LoaderArgs) {
  const { env } = context.get(cloudflareContext);
  const pengguna = await wajibMasuk(env, request);
  const db = buatDb(env);

  // Tenant belum punya modul apa pun; jangan bebani database dengan hitungan
  // yang tidak akan ditampilkan kepadanya.
  if (pengguna.peran === "tenant") {
    return {
      nama: pengguna.nama,
      peran: pengguna.peran,
      ringkasan: null,
      jatuhTempo: [],
      mendesak: [],
      lingkungan: [],
      tunggakan: [],
    };
  }

  const [
    jumlahUnit,
    jumlahJabatan,
    jumlahPengguna,
    semuaDokumen,
    semuaPermohonan,
    { hariLibur },
    semuaLingkungan,
    semuaLaporan,
  ] = await Promise.all([
    db.select({ n: count() }).from(unitKerja).where(eq(unitKerja.aktif, true)),
    db.select({ n: count() }).from(jabatan).where(eq(jabatan.aktif, true)),
    db
      .select({ n: count() })
      .from(users)
      .where(and(eq(users.aktif, true))),
    db
      .select({
        id: dokumen.id,
        nomor: dokumen.nomor,
        judul: dokumen.judul,
        tanggalTinjauUlang: dokumen.tanggalTinjauUlang,
        status: dokumen.status,
      })
      .from(dokumen),
    daftarPermohonan(db),
    bacaPengaturanPerizinan(db),
    daftarDokumenLingkungan(db),
    laporanBerjalan(db),
  ]);

  return {
    nama: pengguna.nama,
    peran: pengguna.peran,
    ringkasan: {
      unitKerja: jumlahUnit[0]?.n ?? 0,
      jabatan: jumlahJabatan[0]?.n ?? 0,
      pengguna: jumlahPengguna[0]?.n ?? 0,
    },
    // Pengingat tinjau ulang dokumen; kosong bila tidak ada yang jatuh tempo.
    jatuhTempo: dokumenJatuhTempo(semuaDokumen).slice(0, 5),
    // Permohonan izin yang tenggatnya sudah atau hampir terlewat.
    mendesak: permohonanMendesak(semuaPermohonan, new Date(), hariLibur).slice(0, 5),
    // Pemeriksaan lingkungan yang tenggatnya berjalan dan sudah mendesak.
    lingkungan: lingkunganMendesak(semuaLingkungan, new Date(), hariLibur).slice(0, 5),
    // Laporan pemantauan yang belum masuk padahal sudah jatuh tempo.
    tunggakan: laporanTertunggak(semuaLaporan).slice(0, 5),
  };
}

export default function Dasbor({ loaderData }: Route.ComponentProps) {
  const { t } = useDataRoot();
  const { ringkasan } = loaderData;

  const kartu = ringkasan
    ? [
        {
          label: t.dasbor.jumlahUnitKerja,
          nilai: ringkasan.unitKerja,
          testId: "hitung-unit-kerja",
        },
        { label: t.dasbor.jumlahJabatan, nilai: ringkasan.jabatan, testId: "hitung-jabatan" },
        {
          label: t.dasbor.jumlahPengguna,
          nilai: ringkasan.pengguna,
          testId: "hitung-pengguna",
        },
      ]
    : [];

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold" data-testid="judul-dasbor">
          {t.dasbor.judul}
        </h1>
        <p className="mt-2 text-slate-600 dark:text-slate-400">
          {t.dasbor.selamatDatang},{" "}
          <strong data-testid="nama-pengguna">{loaderData.nama}</strong>. {t.dasbor.peran}:{" "}
          <span data-testid="peran-pengguna">{loaderData.peran}</span>
        </p>
      </div>

      {kartu.length > 0 ? (
        <div className="grid gap-4 sm:grid-cols-3">
          {kartu.map((k) => (
            <div
              key={k.label}
              className="rounded-md border border-slate-200 p-4 dark:border-slate-800"
            >
              <p className="text-sm text-slate-600 dark:text-slate-400">{k.label}</p>
              <p className="mt-1 text-2xl font-semibold" data-testid={k.testId}>
                {k.nilai}
              </p>
            </div>
          ))}
        </div>
      ) : null}

      {loaderData.jatuhTempo.length > 0 ? (
        <section
          className="rounded-md border border-amber-300 bg-amber-50 p-4 dark:border-amber-800 dark:bg-amber-950"
          data-testid="kartu-jatuh-tempo"
        >
          <h2 className="font-medium text-amber-900 dark:text-amber-100">
            {t.dokumen.jatuhTempo}
          </h2>
          <p className="mt-1 text-sm text-amber-800 dark:text-amber-200">
            {t.dokumen.jatuhTempoKeterangan}
          </p>
          <ul className="mt-3 flex flex-col gap-1">
            {loaderData.jatuhTempo.map((d) => (
              <li key={d.id} className="text-sm">
                <Link
                  to={`/internal/dokumen/${d.id}`}
                  className="text-amber-900 underline dark:text-amber-100"
                  data-testid={`jatuh-tempo-${d.id}`}
                >
                  <code className="text-xs">{d.nomor}</code> — {d.judul}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {loaderData.mendesak.length > 0 ? (
        <section
          className="rounded-md border border-rose-300 bg-rose-50 p-4 dark:border-rose-800 dark:bg-rose-950"
          data-testid="kartu-mendesak"
        >
          <h2 className="font-medium text-rose-900 dark:text-rose-100">
            {t.perizinan.mendesak}
          </h2>
          <p className="mt-1 text-sm text-rose-800 dark:text-rose-200">
            {t.perizinan.mendesakKeterangan}
          </p>
          <ul className="mt-3 flex flex-col gap-1">
            {loaderData.mendesak.map((p) => (
              <li key={p.id} className="text-sm">
                <Link
                  to={`/internal/permohonan/${p.id}`}
                  className="text-rose-900 underline dark:text-rose-100"
                  data-testid={`mendesak-${p.id}`}
                >
                  <code className="text-xs">{p.nomor}</code> — {p.judul}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {loaderData.lingkungan.length > 0 ? (
        <section
          className="rounded-md border border-rose-300 bg-rose-50 p-4 dark:border-rose-800 dark:bg-rose-950"
          data-testid="kartu-lingkungan-mendesak"
        >
          <h2 className="font-medium text-rose-900 dark:text-rose-100">
            {t.lingkungan.mendesak}
          </h2>
          <p className="mt-1 text-sm text-rose-800 dark:text-rose-200">
            {t.lingkungan.mendesakKeterangan}
          </p>
          <ul className="mt-3 flex flex-col gap-1">
            {loaderData.lingkungan.map((d) => (
              <li key={d.id} className="text-sm">
                <Link
                  to={`/internal/lingkungan/${d.id}`}
                  className="text-rose-900 underline dark:text-rose-100"
                  data-testid={`lingkungan-mendesak-${d.id}`}
                >
                  <code className="text-xs">{d.nomor}</code> — {d.judul}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {loaderData.tunggakan.length > 0 ? (
        <section
          className="rounded-md border border-amber-300 bg-amber-50 p-4 dark:border-amber-800 dark:bg-amber-950"
          data-testid="kartu-tunggakan"
        >
          <h2 className="font-medium text-amber-900 dark:text-amber-100">
            {t.lingkungan.tunggakan}
          </h2>
          <p className="mt-1 text-sm text-amber-800 dark:text-amber-200">
            {t.lingkungan.tunggakanKeterangan}
          </p>
          <ul className="mt-3 flex flex-col gap-1">
            {loaderData.tunggakan.map((l) => (
              <li key={l.id} className="text-sm">
                <Link
                  to={`/internal/lingkungan/${l.dokumenLingkunganId}`}
                  className="text-amber-900 underline dark:text-amber-100"
                  data-testid={`tunggakan-${l.id}`}
                >
                  {l.namaTenant} — {l.namaKewajiban} {l.periode}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <p className="text-sm text-slate-500 dark:text-slate-400">{t.dasbor.belumAdaModul}</p>
    </div>
  );
}
