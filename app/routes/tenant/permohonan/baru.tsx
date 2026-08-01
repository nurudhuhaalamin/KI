import { Form, Link, redirect, useNavigation, useSearchParams } from "react-router";

import { Kolom, PesanGalat, Pilihan, Teks, Tombol } from "~/components/internal/kolom";
import { KolomDinamis } from "~/components/kolom-dinamis";
import { catatAudit } from "~/lib/audit";
import { wajibMasuk } from "~/lib/auth/sesi";
import { cloudflareContext } from "~/lib/context";
import { buatDb } from "~/lib/db";
import { bacaDefinisi, validasiIsian } from "~/modules/perizinan/formulir";
import { ambilJenisIzin, buatPermohonan, jenisIzinAktif } from "~/modules/perizinan/query";
import { skemaPermohonanBaru } from "~/modules/perizinan/validasi";
import { useDataRoot } from "~/root";

import type { Route } from "./+types/baru";

export async function loader({ request, context }: Route.LoaderArgs) {
  const { env } = context.get(cloudflareContext);
  const pengguna = await wajibMasuk(env, request, ["tenant"]);
  const db = buatDb(env);

  const jenis = await jenisIzinAktif(db);
  // Jenis yang sedang dipilih menentukan kolom apa yang ditanyakan.
  const dipilih = new URL(request.url).searchParams.get("jenis") ?? jenis[0]?.id ?? "";
  const terpilih = jenis.find((j) => j.id === dipilih) ?? jenis[0] ?? null;

  return {
    jenis,
    terpilih,
    definisi: bacaDefinisi(terpilih?.definisiKolom),
    tertaut: pengguna.tenantId !== null,
  };
}

export async function action({ request, context }: Route.ActionArgs) {
  const { env } = context.get(cloudflareContext);
  const pengguna = await wajibMasuk(env, request, ["tenant"]);
  const db = buatDb(env);

  if (!pengguna.tenantId) throw new Response("Akses ditolak", { status: 403 });

  const formulir = Object.fromEntries(await request.formData());
  const hasil = skemaPermohonanBaru.safeParse(formulir);
  if (!hasil.success) return { galat: hasil.error.issues[0]?.message ?? "Data tidak valid" };

  const jenis = await ambilJenisIzin(db, hasil.data.jenisIzinId);
  if (!jenis || !jenis.aktif) return { galat: "Jenis izin tidak tersedia" };

  // Jawaban divalidasi dari definisi milik jenis izin ini, bukan dari daftar
  // kolom yang dikirim formulir — formulir bisa diubah siapa saja.
  const isian = validasiIsian(bacaDefinisi(jenis.definisiKolom), formulir);
  if (!isian.berhasil) return { galatIsian: isian.galat };

  const { id, nomor } = await buatPermohonan(db, {
    jenisIzinId: jenis.id,
    tenantId: pengguna.tenantId,
    diajukanOleh: pengguna.id,
    judul: hasil.data.judul,
    isian: isian.nilai,
  });

  await catatAudit(db, {
    userId: pengguna.id,
    aksi: "buat",
    entitas: "permohonan",
    entitasId: id,
    ringkasan: `Permohonan ${nomor} dibuat`,
    request,
  });

  return redirect(`/portal/permohonan/${id}?dibuat=1`);
}

export default function PermohonanBaru({ loaderData, actionData }: Route.ComponentProps) {
  const { t, locale } = useDataRoot();
  const navigation = useNavigation();
  const sedangKirim = navigation.state === "submitting";
  const { jenis, terpilih, definisi, tertaut } = loaderData;
  const [paramPencarian, setParamPencarian] = useSearchParams();

  const petaGalatIsian: Record<string, string> = {
    wajib: t.perizinan.galatWajib,
    bukanAngka: t.perizinan.galatBukanAngka,
    bukanTanggal: t.perizinan.galatBukanTanggal,
    diLuarPilihan: t.perizinan.galatDiLuarPilihan,
    terlaluPanjang: t.perizinan.galatTerlaluPanjang,
  };

  const galatIsian = actionData && "galatIsian" in actionData ? actionData.galatIsian : null;
  const pesanGalat =
    actionData && "galat" in actionData
      ? actionData.galat
      : galatIsian
        ? galatIsian
            .map((g) => {
              const label = definisi.find((d) => d.nama === g.kolom)?.label ?? g.kolom;
              return `${label}: ${petaGalatIsian[g.sebab]}`;
            })
            .join("; ")
        : null;

  if (!tertaut) {
    return (
      <p className="text-sm text-slate-600 dark:text-slate-400">{t.portal.belumTertaut}</p>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link
          to="/portal/permohonan"
          className="text-sm text-sky-700 underline dark:text-sky-400"
        >
          ← {t.perizinan.judulPermohonan}
        </Link>
        <h1 className="mt-2 text-2xl font-semibold" data-testid="judul-halaman">
          {t.perizinan.ajukanBaru}
        </h1>
      </div>

      <PesanGalat pesan={pesanGalat} />

      {jenis.length === 0 ? (
        <p className="text-sm text-slate-600 dark:text-slate-400">{t.umum.tidakAdaData}</p>
      ) : (
        <Form method="post" className="flex max-w-2xl flex-col gap-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Kolom label={t.perizinan.jenis}>
              <Pilihan
                name="jenisIzinId"
                value={terpilih?.id ?? ""}
                data-testid="input-jenis"
                onChange={(e) => {
                  // Ganti jenis berarti kolom yang ditanyakan ikut berganti.
                  const berikut = new URLSearchParams(paramPencarian);
                  berikut.set("jenis", e.target.value);
                  setParamPencarian(berikut);
                }}
              >
                {jenis.map((j) => (
                  <option key={j.id} value={j.id}>
                    {(locale === "en" && j.namaEn) || j.nama}
                  </option>
                ))}
              </Pilihan>
            </Kolom>
            <Kolom label={t.perizinan.judulPengajuan}>
              <Teks name="judul" maxLength={200} data-testid="input-judul" />
            </Kolom>
          </div>

          <KolomDinamis definisi={definisi} nilai={{}} locale={locale} />

          <div>
            <Tombol type="submit" disabled={sedangKirim} data-testid="tombol-simpan">
              {sedangKirim ? t.umum.sedangMenyimpan : t.umum.simpan}
            </Tombol>
          </div>
        </Form>
      )}
    </div>
  );
}
