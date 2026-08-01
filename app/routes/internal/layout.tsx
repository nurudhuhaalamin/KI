import { Form, Link, NavLink, Outlet, isRouteErrorResponse, useLoaderData } from "react-router";

import { PemilihBahasa } from "~/components/pemilih-bahasa";
import { wajibMasuk } from "~/lib/auth/sesi";
import { cloudflareContext } from "~/lib/context";
import type { Peran } from "~/lib/db/schema/auth";
import { useDataRoot } from "~/root";

import type { Route } from "./+types/layout";

export async function loader({ request, context }: Route.LoaderArgs) {
  const { env } = context.get(cloudflareContext);
  const pengguna = await wajibMasuk(env, request);
  return { pengguna };
}

/** Menu samping. Setiap butir menyebut peran mana yang boleh melihatnya. */
type ButirMenu = { ke: string; kunci: string; peran: readonly Peran[] };

const KELOMPOK_MENU: { kunci: string; butir: ButirMenu[] }[] = [
  {
    kunci: "kelolaKawasan",
    butir: [
      { ke: "/internal/kavling", kunci: "kavling", peran: ["admin", "manajemen", "staf"] },
      { ke: "/internal/tenant", kunci: "tenant", peran: ["admin", "manajemen", "staf"] },
      { ke: "/internal/kontrak", kunci: "kontrak", peran: ["admin", "manajemen"] },
      { ke: "/internal/dokumen", kunci: "dokumen", peran: ["admin", "manajemen", "staf"] },
      {
        ke: "/internal/permohonan",
        kunci: "permohonan",
        peran: ["admin", "manajemen", "staf"],
      },
      { ke: "/internal/jenis-izin", kunci: "jenisIzin", peran: ["admin"] },
    ],
  },
  {
    kunci: "kelolaOrganisasi",
    butir: [
      { ke: "/internal/unit-kerja", kunci: "unitKerja", peran: ["admin", "manajemen", "staf"] },
      { ke: "/internal/jabatan", kunci: "jabatan", peran: ["admin", "manajemen", "staf"] },
    ],
  },
  {
    kunci: "administrasi",
    butir: [
      { ke: "/internal/pengguna", kunci: "pengguna", peran: ["admin", "manajemen"] },
      { ke: "/internal/pengaturan", kunci: "pengaturan", peran: ["admin", "manajemen"] },
      { ke: "/internal/jejak-audit", kunci: "jejakAudit", peran: ["admin", "manajemen"] },
    ],
  },
];

export default function TataLetakInternal() {
  const { pengguna } = useLoaderData<typeof loader>();
  const { t, locale, namaKawasan } = useDataRoot();

  const gayaTautan = ({ isActive }: { isActive: boolean }) =>
    isActive
      ? "block rounded-md bg-slate-200 px-3 py-2 text-sm font-medium dark:bg-slate-800"
      : "block rounded-md px-3 py-2 text-sm text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800";

  return (
    <div className="flex min-h-screen flex-col">
      <header className="flex items-center justify-between gap-4 border-b border-slate-200 px-6 py-4 dark:border-slate-800">
        <Link to="/internal" className="font-semibold">
          {namaKawasan}
        </Link>
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

      <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 px-6 py-8 md:flex-row">
        <nav className="md:w-56 md:shrink-0" data-testid="menu-samping">
          <NavLink to="/internal" end className={gayaTautan}>
            {t.nav.dasbor}
          </NavLink>

          {KELOMPOK_MENU.map((kelompok) => {
            const terlihat = kelompok.butir.filter((b) => b.peran.includes(pengguna.peran));
            if (terlihat.length === 0) return null;

            return (
              <div key={kelompok.kunci} className="mt-6">
                <p className="px-3 pb-1 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-500">
                  {t.nav[kelompok.kunci as keyof typeof t.nav]}
                </p>
                {terlihat.map((butir) => (
                  <NavLink
                    key={butir.ke}
                    to={butir.ke}
                    className={gayaTautan}
                    data-testid={`menu-${butir.kunci}`}
                  >
                    {t.nav[butir.kunci as keyof typeof t.nav]}
                  </NavLink>
                ))}
              </div>
            );
          })}
        </nav>

        <main className="min-w-0 flex-1">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  const { t } = useDataRoot();
  const ditolak = isRouteErrorResponse(error) && error.status === 403;

  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col justify-center gap-4 p-8">
      <h1 className="text-2xl font-semibold" data-testid="judul-galat">
        {ditolak ? t.umum.aksesDitolak : t.umum.galat}
      </h1>
      <p className="text-slate-600 dark:text-slate-400">
        {ditolak ? t.umum.aksesDitolakKeterangan : t.umum.galatKeterangan}
      </p>
      <Link to="/internal" className="text-sky-700 underline dark:text-sky-400">
        {t.nav.dasbor}
      </Link>
    </main>
  );
}
