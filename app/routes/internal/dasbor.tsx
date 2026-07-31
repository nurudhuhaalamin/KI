import { Form, Link } from "react-router";

import { PemilihBahasa } from "~/components/pemilih-bahasa";
import { wajibMasuk } from "~/lib/auth/sesi";
import { cloudflareContext } from "~/lib/context";
import { useDataRoot } from "~/root";

import type { Route } from "./+types/dasbor";

export async function loader({ request, context }: Route.LoaderArgs) {
  const { env } = context.get(cloudflareContext);
  const pengguna = await wajibMasuk(env, request);

  return {
    nama: pengguna.nama,
    peran: pengguna.peran,
  };
}

export default function Dasbor({ loaderData }: Route.ComponentProps) {
  const { t, locale, namaKawasan } = useDataRoot();

  return (
    <div className="flex min-h-screen flex-col">
      <header className="flex items-center justify-between border-b border-slate-200 px-6 py-4 dark:border-slate-800">
        <Link to="/" className="font-semibold">
          {namaKawasan}
        </Link>
        <div className="flex items-center gap-4">
          <PemilihBahasa aktif={locale} />
          <Form method="post" action="/keluar">
            <button
              type="submit"
              data-testid="tombol-keluar"
              className="text-sm font-medium text-slate-600 hover:underline dark:text-slate-400"
            >
              {t.nav.keluar}
            </button>
          </Form>
        </div>
      </header>

      <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-12">
        <h1 className="text-2xl font-semibold" data-testid="judul-dasbor">
          {t.dasbor.judul}
        </h1>
        <p className="mt-4 text-slate-600 dark:text-slate-400">
          {t.dasbor.selamatDatang},{" "}
          <strong data-testid="nama-pengguna">{loaderData.nama}</strong>.
        </p>
        <p className="mt-1 text-slate-600 dark:text-slate-400">
          {t.dasbor.peran}: <span data-testid="peran-pengguna">{loaderData.peran}</span>
        </p>
      </main>
    </div>
  );
}
