import { Form, Link, useNavigation } from "react-router";

import { Kolom, PesanGalat, Pilihan, Teks, Tombol } from "~/components/internal/kolom";
import { BarisKosong, Sel, Tabel } from "~/components/internal/tabel";
import { catatAudit } from "~/lib/audit";
import { wajibMasuk } from "~/lib/auth/sesi";
import { cloudflareContext } from "~/lib/context";
import { buatDb } from "~/lib/db";
import { JENIS_KONTRAK } from "~/lib/db/schema/kontrak";
import { daftarKavling, segarkanStatusKavling } from "~/modules/kavling/query";
import { adaTumpangTindih, periksaTanggal } from "~/modules/kontrak/aturan";
import {
  buatKontrak,
  daftarKontrak,
  masaKontrakKavling,
  nomorKontrakDipakai,
} from "~/modules/kontrak/query";
import { skemaKontrakBaru } from "~/modules/kontrak/validasi";
import { daftarTenantRingkas } from "~/modules/tenant/query";
import { useDataRoot } from "~/root";

import type { Route } from "./+types/daftar";

export async function loader({ request, context }: Route.LoaderArgs) {
  const { env } = context.get(cloudflareContext);
  const pengguna = await wajibMasuk(env, request, ["admin", "manajemen"]);
  const db = buatDb(env);

  const [kontrak, tenant, kavling] = await Promise.all([
    daftarKontrak(db),
    daftarTenantRingkas(db),
    daftarKavling(db),
  ]);

  return { kontrak, tenant, kavling, bolehUbah: pengguna.peran === "admin" };
}

export async function action({ request, context }: Route.ActionArgs) {
  const { env } = context.get(cloudflareContext);
  const pengguna = await wajibMasuk(env, request, ["admin"]);
  const db = buatDb(env);

  const hasil = skemaKontrakBaru.safeParse(Object.fromEntries(await request.formData()));
  if (!hasil.success) return { galat: hasil.error.issues[0]?.message ?? "Data tidak valid" };

  const galatTanggal = periksaTanggal(
    hasil.data.jenis,
    hasil.data.tanggalMulai,
    hasil.data.tanggalBerakhir,
  );
  if (galatTanggal) return { galat: galatTanggal };

  if (await nomorKontrakDipakai(db, hasil.data.nomor)) {
    return { galat: "nomorSudahDipakai" as const };
  }

  // Satu kavling tidak boleh terikat dua kontrak pada rentang waktu yang sama.
  const kontrakLain = await masaKontrakKavling(db, hasil.data.kavlingId);
  if (adaTumpangTindih(kontrakLain, hasil.data)) {
    return { galat: "tumpangTindih" as const };
  }

  const id = await buatKontrak(db, hasil.data);
  await segarkanStatusKavling(db, hasil.data.kavlingId);

  await catatAudit(db, {
    userId: pengguna.id,
    aksi: "buat",
    entitas: "kontrak",
    entitasId: id,
    ringkasan: `Kontrak ${hasil.data.nomor} (${hasil.data.jenis}) dibuat`,
    request,
  });

  return { berhasil: true as const };
}

export default function DaftarKontrak({ loaderData, actionData }: Route.ComponentProps) {
  const { t, locale } = useDataRoot();
  const navigation = useNavigation();
  const sedangKirim = navigation.state === "submitting";
  const { kontrak, tenant, kavling, bolehUbah } = loaderData;

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

  const pesanGalat = (() => {
    if (!actionData || !("galat" in actionData)) return null;
    const kode = actionData.galat;
    if (kode === "nomorSudahDipakai") return t.kontrak.nomorSudahDipakai;
    if (kode === "tumpangTindih") return t.kontrak.tumpangTindih;
    if (kode === "tanggalBerakhirWajib") return t.kontrak.tanggalBerakhirWajib;
    if (kode === "tanggalTerbalik") return t.kontrak.tanggalTerbalik;
    return kode;
  })();

  const tanggal = new Intl.DateTimeFormat(locale === "en" ? "en-GB" : "id-ID", {
    dateStyle: "medium",
  });

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold" data-testid="judul-halaman">
          {t.kontrak.judul}
        </h1>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
          {t.kontrak.keterangan}
        </p>
      </div>

      {!bolehUbah ? (
        <p className="text-sm text-slate-500 dark:text-slate-400">{t.umum.hanyaBaca}</p>
      ) : tenant.length === 0 || kavling.length === 0 ? (
        <p
          className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:bg-amber-950 dark:text-amber-200"
          data-testid="peringatan-data-kosong"
        >
          {t.kontrak.belumAdaData}
        </p>
      ) : (
        <details className="rounded-md border border-slate-200 p-4 dark:border-slate-800">
          <summary
            className="cursor-pointer text-sm font-medium"
            data-testid="buka-form-tambah"
          >
            {t.kontrak.tambahJudul}
          </summary>

          <Form method="post" className="mt-4 flex flex-col gap-4">
            <PesanGalat pesan={pesanGalat} />

            <div className="grid gap-4 sm:grid-cols-2">
              <Kolom label={t.kontrak.nomor}>
                <Teks name="nomor" required maxLength={60} data-testid="input-nomor" />
              </Kolom>
              <Kolom label={t.kontrak.jenis}>
                <Pilihan name="jenis" defaultValue="sewa" data-testid="input-jenis">
                  {JENIS_KONTRAK.map((j) => (
                    <option key={j} value={j}>
                      {labelJenis[j]}
                    </option>
                  ))}
                </Pilihan>
              </Kolom>
              <Kolom label={t.kontrak.tenant}>
                <Pilihan name="tenantId" required data-testid="input-tenant">
                  {tenant.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.kode} — {p.namaPerusahaan}
                    </option>
                  ))}
                </Pilihan>
              </Kolom>
              <Kolom label={t.kontrak.kavling}>
                <Pilihan name="kavlingId" required data-testid="input-kavling">
                  {kavling.map((k) => (
                    <option key={k.id} value={k.id}>
                      {k.kode} — {k.luasM2.toLocaleString("id-ID")} m²
                    </option>
                  ))}
                </Pilihan>
              </Kolom>
              <Kolom label={t.kontrak.tanggalMulai}>
                <Teks
                  type="date"
                  name="tanggalMulai"
                  required
                  data-testid="input-tanggal-mulai"
                />
              </Kolom>
              <Kolom
                label={t.kontrak.tanggalBerakhir}
                petunjuk={t.kontrak.tanggalBerakhirPetunjuk}
              >
                <Teks type="date" name="tanggalBerakhir" data-testid="input-tanggal-berakhir" />
              </Kolom>
              <Kolom label={t.kontrak.nilai}>
                <Teks type="number" name="nilai" min={0} defaultValue={0} />
              </Kolom>
            </div>

            <div>
              <Tombol type="submit" disabled={sedangKirim} data-testid="tombol-simpan">
                {sedangKirim ? t.umum.sedangMenyimpan : t.umum.simpan}
              </Tombol>
            </div>
          </Form>
        </details>
      )}

      <Tabel
        testId="tabel-kontrak"
        judulKolom={[
          t.kontrak.nomor,
          t.kontrak.jenis,
          t.kontrak.tenant,
          t.kontrak.kavling,
          t.kontrak.tanggalMulai,
          t.kontrak.status,
          t.umum.aksi,
        ]}
      >
        {kontrak.length === 0 ? (
          <BarisKosong kolom={7} pesan={t.umum.tidakAdaData} />
        ) : (
          kontrak.map((k) => (
            <tr key={k.id}>
              <Sel>
                <code className="text-xs">{k.nomor}</code>
              </Sel>
              <Sel>{labelJenis[k.jenis]}</Sel>
              <Sel>{k.namaTenant}</Sel>
              <Sel>{k.kodeKavling}</Sel>
              <Sel>
                <span className="whitespace-nowrap text-xs">
                  {tanggal.format(k.tanggalMulai)}
                </span>
              </Sel>
              <Sel>{labelStatus[k.status]}</Sel>
              <Sel>
                {bolehUbah ? (
                  <Link
                    to={`/internal/kontrak/${k.id}`}
                    className="text-sky-700 underline dark:text-sky-400"
                    data-testid={`ubah-${k.nomor}`}
                  >
                    {t.umum.ubah}
                  </Link>
                ) : (
                  t.umum.tidakAda
                )}
              </Sel>
            </tr>
          ))
        )}
      </Tabel>
    </div>
  );
}
