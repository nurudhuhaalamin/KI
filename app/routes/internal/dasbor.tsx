import { and, count, eq } from "drizzle-orm";
import { Link } from "react-router";

import { wajibMasuk } from "~/lib/auth/sesi";
import { cloudflareContext } from "~/lib/context";
import { buatDb } from "~/lib/db";
import { users } from "~/lib/db/schema/auth";
import { dokumen } from "~/lib/db/schema/dokumen";
import { jabatan, unitKerja } from "~/lib/db/schema/organisasi";
import { dokumenJatuhTempo } from "~/modules/dokumen/penomoran";
import { useDataRoot } from "~/root";

import type { Route } from "./+types/dasbor";

export async function loader({ request, context }: Route.LoaderArgs) {
  const { env } = context.get(cloudflareContext);
  const pengguna = await wajibMasuk(env, request);
  const db = buatDb(env);

  // Tenant belum punya modul apa pun; jangan bebani database dengan hitungan
  // yang tidak akan ditampilkan kepadanya.
  if (pengguna.peran === "tenant") {
    return { nama: pengguna.nama, peran: pengguna.peran, ringkasan: null, jatuhTempo: [] };
  }

  const [jumlahUnit, jumlahJabatan, jumlahPengguna, semuaDokumen] = await Promise.all([
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

      <p className="text-sm text-slate-500 dark:text-slate-400">{t.dasbor.belumAdaModul}</p>
    </div>
  );
}
