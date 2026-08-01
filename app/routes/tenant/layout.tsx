import { Form, Link, Outlet, useLoaderData } from "react-router";

import { PemilihBahasa } from "~/components/pemilih-bahasa";
import { wajibMasuk } from "~/lib/auth/sesi";
import { cloudflareContext } from "~/lib/context";
import { useDataRoot } from "~/root";

import type { Route } from "./+types/layout";

export async function loader({ request, context }: Route.LoaderArgs) {
  const { env } = context.get(cloudflareContext);
  // Portal ini khusus perusahaan penyewa. Staf pengelola memakai /internal.
  const pengguna = await wajibMasuk(env, request, ["tenant"]);
  return { pengguna };
}

export default function TataLetakTenant() {
  const { pengguna } = useLoaderData<typeof loader>();
  const { t, locale, namaKawasan } = useDataRoot();

  return (
    <div className="flex min-h-screen flex-col">
      <header className="flex items-center justify-between gap-4 border-b border-slate-200 px-6 py-4 dark:border-slate-800">
        <div className="flex items-center gap-6">
          <Link to="/portal" className="font-semibold">
            {namaKawasan}
          </Link>
          <Link
            to="/portal/permohonan"
            className="text-sm text-slate-600 hover:underline dark:text-slate-400"
            data-testid="menu-permohonan"
          >
            {t.nav.permohonan}
          </Link>
        </div>
        <div className="flex items-center gap-4">
          <PemilihBahasa aktif={locale} />
          <span className="hidden text-sm text-slate-600 sm:inline dark:text-slate-400">
            {pengguna.nama}
          </span>
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

      <main className="mx-auto w-full max-w-4xl flex-1 px-6 py-8">
        <Outlet />
      </main>
    </div>
  );
}
