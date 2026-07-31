import { BarisKosong, Sel, Tabel } from "~/components/internal/tabel";
import { wajibMasuk } from "~/lib/auth/sesi";
import { cloudflareContext } from "~/lib/context";
import { buatDb } from "~/lib/db";
import { daftarKontrakTenant } from "~/modules/kontrak/query";
import { ambilTenant } from "~/modules/tenant/query";
import { useDataRoot } from "~/root";

import type { Route } from "./+types/beranda";

export async function loader({ request, context }: Route.LoaderArgs) {
  const { env } = context.get(cloudflareContext);
  const pengguna = await wajibMasuk(env, request, ["tenant"]);
  const db = buatDb(env);

  // Akun tenant yang belum ditautkan ke perusahaan tidak melihat data apa pun.
  if (!pengguna.tenantId) {
    return { perusahaan: null, kontrak: [] };
  }

  // Penyaringan memakai tenantId DARI SESI, bukan dari parameter URL. Inilah
  // yang membuat perusahaan lain tidak bisa diintip dengan menebak id.
  const [perusahaan, kontrak] = await Promise.all([
    ambilTenant(db, pengguna.tenantId),
    daftarKontrakTenant(db, pengguna.tenantId),
  ]);

  return {
    perusahaan: perusahaan
      ? {
          kode: perusahaan.kode,
          nama: perusahaan.namaPerusahaan,
          bidangUsaha: perusahaan.bidangUsaha,
          status: perusahaan.status,
        }
      : null,
    kontrak,
  };
}

export default function BerandaPortal({ loaderData }: Route.ComponentProps) {
  const { t, locale } = useDataRoot();
  const { perusahaan, kontrak } = loaderData;

  const labelJenis: Record<string, string> = {
    jual: t.kontrak.jenisJual,
    sewa: t.kontrak.jenisSewa,
  };
  const labelStatus: Record<string, string> = {
    draf: t.kontrak.statusDraf,
    aktif: t.kontrak.statusAktif,
    berakhir: t.kontrak.statusBerakhir,
    batal: t.kontrak.statusBatal,
  };

  const tanggal = new Intl.DateTimeFormat(locale === "en" ? "en-GB" : "id-ID", {
    dateStyle: "medium",
  });

  if (!perusahaan) {
    return (
      <div className="flex flex-col gap-4">
        <h1 className="text-2xl font-semibold" data-testid="judul-portal">
          {t.portal.judul}
        </h1>
        <p
          className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:bg-amber-950 dark:text-amber-200"
          data-testid="belum-tertaut"
        >
          {t.portal.belumTertaut}
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-2xl font-semibold" data-testid="judul-portal">
          {t.portal.judul}
        </h1>
        <p className="mt-2 text-slate-600 dark:text-slate-400">
          {t.portal.perusahaan}:{" "}
          <strong data-testid="nama-perusahaan">{perusahaan.nama}</strong>{" "}
          <code className="text-xs">{perusahaan.kode}</code>
        </p>
      </div>

      <section>
        <h2 className="mb-3 text-lg font-medium">{t.portal.kontrakSaya}</h2>
        <Tabel
          testId="tabel-kontrak-saya"
          judulKolom={[
            t.kontrak.nomor,
            t.kontrak.jenis,
            t.kontrak.kavling,
            t.kontrak.tanggalMulai,
            t.kontrak.tanggalBerakhir,
            t.kontrak.status,
          ]}
        >
          {kontrak.length === 0 ? (
            <BarisKosong kolom={6} pesan={t.portal.belumAdaKontrak} />
          ) : (
            kontrak.map((k) => (
              <tr key={k.id}>
                <Sel>
                  <code className="text-xs">{k.nomor}</code>
                </Sel>
                <Sel>{labelJenis[k.jenis]}</Sel>
                <Sel>
                  {k.kodeKavling} · {k.luasKavling.toLocaleString("id-ID")} m²
                </Sel>
                <Sel>
                  <span className="whitespace-nowrap text-xs">
                    {tanggal.format(k.tanggalMulai)}
                  </span>
                </Sel>
                <Sel>
                  <span className="whitespace-nowrap text-xs">
                    {k.tanggalBerakhir ? tanggal.format(k.tanggalBerakhir) : t.umum.tidakAda}
                  </span>
                </Sel>
                <Sel>{labelStatus[k.status]}</Sel>
              </tr>
            ))
          )}
        </Tabel>
      </section>
    </div>
  );
}
