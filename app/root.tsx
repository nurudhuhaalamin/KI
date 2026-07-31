import {
  data,
  isRouteErrorResponse,
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
  useRouteLoaderData,
} from "react-router";

import type { Route } from "./+types/root";
import "./app.css";
import { cloudflareContext } from "./lib/context";
import { ambilLocale, cookieLokale, pesan, type Locale, type Messages } from "./lib/i18n";

export const links: Route.LinksFunction = () => [
  { rel: "icon", href: "/favicon.svg", type: "image/svg+xml" },
  { rel: "preconnect", href: "https://fonts.googleapis.com" },
  { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
  {
    rel: "stylesheet",
    href: "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap",
  },
];

export function loader({ request, context }: Route.LoaderArgs) {
  const { env } = context.get(cloudflareContext);
  const locale = ambilLocale(request, env.LOKALE_BAWAAN);
  const bahasaDipilihManual = new URL(request.url).searchParams.has("lang");

  const isi = {
    locale,
    t: pesan(locale),
    namaKawasan: env.NAMA_KAWASAN,
  };

  // Pilihan bahasa disimpan sebagai cookie agar bertahan di halaman berikutnya.
  return bahasaDipilihManual
    ? data(isi, { headers: { "Set-Cookie": cookieLokale(locale) } })
    : isi;
}

/** Meneruskan Set-Cookie dari loader ke respons dokumen. */
export function headers({ loaderHeaders }: Route.HeadersArgs) {
  return loaderHeaders;
}

/** Data root yang bisa dibaca route mana pun lewat `useDataRoot()`. */
export type DataRoot = {
  locale: Locale;
  t: Messages;
  namaKawasan: string;
};

export function useDataRoot(): DataRoot {
  const data = useRouteLoaderData<typeof loader>("root");
  if (!data) {
    // Hanya terjadi bila loader root gagal; jaga agar tampilan galat tetap hidup.
    return { locale: "id", t: pesan("id"), namaKawasan: "Kawasan Industri" };
  }
  return data;
}

export function Layout({ children }: { children: React.ReactNode }) {
  const data = useRouteLoaderData<typeof loader>("root");

  return (
    <html lang={data?.locale ?? "id"}>
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <Meta />
        <Links />
      </head>
      <body className="min-h-screen font-sans antialiased">
        {children}
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}

export default function App() {
  return <Outlet />;
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  const { t } = useDataRoot();

  let judul = t.umum.galat;
  let keterangan = t.umum.galatKeterangan;
  let jejak: string | undefined;

  if (isRouteErrorResponse(error)) {
    judul = error.status === 404 ? t.umum.tidakDitemukan : `${error.status}`;
    keterangan = error.status === 404 ? t.umum.galatKeterangan : error.statusText;
  } else if (import.meta.env.DEV && error instanceof Error) {
    // Detail teknis hanya muncul saat pengembangan. Di produksi pengguna
    // hanya melihat pesan umum — sesuai aturan di .claude/rules/keamanan.md.
    keterangan = error.message;
    jejak = error.stack;
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col justify-center gap-4 p-8">
      <h1 className="text-2xl font-semibold">{judul}</h1>
      <p className="text-slate-600 dark:text-slate-400">{keterangan}</p>
      <a className="text-sky-700 underline dark:text-sky-400" href="/">
        {t.umum.kembaliKeBeranda}
      </a>
      {jejak ? (
        <pre className="overflow-x-auto rounded bg-slate-100 p-4 text-xs dark:bg-slate-900">
          <code>{jejak}</code>
        </pre>
      ) : null}
    </main>
  );
}
