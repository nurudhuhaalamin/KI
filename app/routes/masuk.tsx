import { Form, Link, redirect, useNavigation } from "react-router";
import { z } from "zod";

import { PemilihBahasa } from "~/components/pemilih-bahasa";
import { buatAuth } from "~/lib/auth/server";
import { ambilSesi } from "~/lib/auth/sesi";
import { cloudflareContext } from "~/lib/context";
import { tujuanAman } from "~/lib/navigasi";
import { useDataRoot } from "~/root";

import type { Route } from "./+types/masuk";

const skemaMasuk = z.object({
  surel: z.string().email(),
  kataSandi: z.string().min(1),
});

export async function loader({ request, context }: Route.LoaderArgs) {
  const { env } = context.get(cloudflareContext);
  const pengguna = await ambilSesi(env, request);
  if (pengguna) throw redirect("/internal");
  return null;
}

export async function action({ request, context }: Route.ActionArgs) {
  const { env } = context.get(cloudflareContext);
  const formulir = await request.formData();

  const hasil = skemaMasuk.safeParse({
    surel: formulir.get("surel"),
    kataSandi: formulir.get("kataSandi"),
  });
  if (!hasil.success) return { gagal: true };

  const auth = buatAuth(env, request);

  let respons: Response;
  try {
    respons = await auth.api.signInEmail({
      body: { email: hasil.data.surel, password: hasil.data.kataSandi },
      headers: request.headers,
      asResponse: true,
    });
  } catch {
    // Pesan galat ke pengguna sengaja dibuat umum: tidak membocorkan apakah
    // surelnya terdaftar atau kata sandinya yang salah.
    return { gagal: true };
  }

  if (!respons.ok) return { gagal: true };

  const headers = new Headers();
  for (const cookie of respons.headers.getSetCookie()) {
    headers.append("Set-Cookie", cookie);
  }

  const lanjut = tujuanAman(new URL(request.url).searchParams.get("lanjut"));
  return redirect(lanjut, { headers });
}

export default function Masuk({ actionData }: Route.ComponentProps) {
  const { t, locale, namaKawasan } = useDataRoot();
  const navigation = useNavigation();
  const sedangKirim = navigation.state === "submitting";

  return (
    <div className="flex min-h-screen flex-col">
      <header className="flex items-center justify-between border-b border-slate-200 px-6 py-4 dark:border-slate-800">
        <Link to="/" className="font-semibold">
          {namaKawasan}
        </Link>
        <PemilihBahasa aktif={locale} />
      </header>

      <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center gap-6 px-6 py-16">
        <h1 className="text-2xl font-semibold" data-testid="judul-masuk">
          {t.masuk.judul}
        </h1>

        {actionData?.gagal ? (
          <p
            role="alert"
            data-testid="galat-masuk"
            className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-800 dark:bg-red-950 dark:text-red-200"
          >
            {t.masuk.gagal}
          </p>
        ) : null}

        <Form method="post" className="flex flex-col gap-4">
          <label className="flex flex-col gap-1 text-sm font-medium">
            {t.masuk.surel}
            <input
              type="email"
              name="surel"
              required
              autoComplete="email"
              data-testid="input-surel"
              className="rounded-md border border-slate-300 px-3 py-2 font-normal dark:border-slate-700 dark:bg-slate-900"
            />
          </label>

          <label className="flex flex-col gap-1 text-sm font-medium">
            {t.masuk.kataSandi}
            <input
              type="password"
              name="kataSandi"
              required
              autoComplete="current-password"
              data-testid="input-kata-sandi"
              className="rounded-md border border-slate-300 px-3 py-2 font-normal dark:border-slate-700 dark:bg-slate-900"
            />
          </label>

          <button
            type="submit"
            disabled={sedangKirim}
            data-testid="tombol-masuk"
            className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-60 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-200"
          >
            {sedangKirim ? t.masuk.sedangMemproses : t.masuk.tombol}
          </button>
        </Form>
      </main>
    </div>
  );
}
