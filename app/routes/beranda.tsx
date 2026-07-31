import { Link } from "react-router";

import { PemilihBahasa } from "~/components/pemilih-bahasa";
import { ambilSesi } from "~/lib/auth/sesi";
import { cloudflareContext } from "~/lib/context";
import { useDataRoot } from "~/root";

import type { Route } from "./+types/beranda";

export function meta({ loaderData }: Route.MetaArgs) {
  return [{ title: loaderData?.judulHalaman ?? "Kawasan Industri" }];
}

export async function loader({ request, context }: Route.LoaderArgs) {
  const { env } = context.get(cloudflareContext);
  const pengguna = await ambilSesi(env, request);

  return {
    judulHalaman: env.NAMA_KAWASAN,
    sudahMasuk: pengguna !== null,
  };
}

export default function Beranda({ loaderData }: Route.ComponentProps) {
  const { t, locale, namaKawasan } = useDataRoot();

  return (
    <div className="flex min-h-screen flex-col">
      <header className="flex items-center justify-between border-b border-slate-200 px-6 py-4 dark:border-slate-800">
        <span className="font-semibold">{namaKawasan}</span>
        <div className="flex items-center gap-4">
          <PemilihBahasa aktif={locale} />
          <Link
            to={loaderData.sudahMasuk ? "/internal" : "/masuk"}
            className="text-sm font-medium text-sky-700 hover:underline dark:text-sky-400"
          >
            {loaderData.sudahMasuk ? t.nav.dasbor : t.nav.masuk}
          </Link>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col justify-center gap-6 px-6 py-16">
        <h1
          className="text-3xl font-bold tracking-tight sm:text-4xl"
          data-testid="judul-beranda"
        >
          {t.beranda.judul}
        </h1>
        <p className="text-lg text-slate-600 dark:text-slate-400">{t.beranda.ringkasan}</p>
        <div>
          <Link
            to="/masuk"
            className="inline-flex rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-200"
          >
            {t.beranda.masukSebagaiPengelola}
          </Link>
        </div>
      </main>

      <footer className="border-t border-slate-200 px-6 py-4 text-sm text-slate-500 dark:border-slate-800">
        {t.situs.tagline}
      </footer>
    </div>
  );
}
