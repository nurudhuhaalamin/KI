import { Form, Link, useNavigation } from "react-router";

import {
  AreaTeks,
  Kolom,
  PesanGalat,
  Pilihan,
  Teks,
  Tombol,
} from "~/components/internal/kolom";
import { BarisKosong, Sel, Tabel } from "~/components/internal/tabel";
import { catatAudit } from "~/lib/audit";
import { wajibMasuk } from "~/lib/auth/sesi";
import { cloudflareContext } from "~/lib/context";
import { buatDb } from "~/lib/db";
import { KATEGORI_DOKUMEN } from "~/lib/db/schema/dokumen";
import { buatDokumen, daftarDokumen } from "~/modules/dokumen/query";
import { skemaDokumenBaru } from "~/modules/dokumen/validasi";
import { daftarUnitKerja } from "~/modules/organisasi/query";
import { useDataRoot } from "~/root";

import type { Route } from "./+types/daftar";

export async function loader({ request, context }: Route.LoaderArgs) {
  const { env } = context.get(cloudflareContext);
  const pengguna = await wajibMasuk(env, request, ["admin", "manajemen", "staf"]);
  const db = buatDb(env);

  const [dokumen, unit] = await Promise.all([daftarDokumen(db), daftarUnitKerja(db)]);
  return {
    dokumen,
    unit,
    bolehUbah: pengguna.peran === "admin" || pengguna.peran === "manajemen",
  };
}

export async function action({ request, context }: Route.ActionArgs) {
  const { env } = context.get(cloudflareContext);
  const pengguna = await wajibMasuk(env, request, ["admin", "manajemen"]);
  const db = buatDb(env);

  const hasil = skemaDokumenBaru.safeParse(Object.fromEntries(await request.formData()));
  if (!hasil.success) return { galat: hasil.error.issues[0]?.message ?? "Data tidak valid" };

  // Nomor dibuat di sini, tidak pernah diterima dari formulir.
  const { id, nomor } = await buatDokumen(db, hasil.data);

  await catatAudit(db, {
    userId: pengguna.id,
    aksi: "buat",
    entitas: "dokumen",
    entitasId: id,
    ringkasan: `Dokumen ${nomor} dibuat`,
    request,
  });

  return { berhasil: true as const, nomor };
}

export default function DaftarDokumen({ loaderData, actionData }: Route.ComponentProps) {
  const { t } = useDataRoot();
  const navigation = useNavigation();
  const sedangKirim = navigation.state === "submitting";
  const { dokumen, unit, bolehUbah } = loaderData;

  const labelKategori: Record<string, string> = {
    "tata-kelola": t.dokumen.katTataKelola,
    "sop-pelayanan": t.dokumen.katSopPelayanan,
    "sop-infrastruktur": t.dokumen.katSopInfrastruktur,
    "sop-keamanan": t.dokumen.katSopKeamanan,
    k3: t.dokumen.katK3,
    "hubungan-industrial": t.dokumen.katHubunganIndustrial,
    governance: t.dokumen.katGovernance,
    pelaporan: t.dokumen.katPelaporan,
  };
  const labelStatus: Record<string, string> = {
    draf: t.dokumen.statusDraf,
    ditinjau: t.dokumen.statusDitinjau,
    disahkan: t.dokumen.statusDisahkan,
    kedaluwarsa: t.dokumen.statusKedaluwarsa,
    ditarik: t.dokumen.statusDitarik,
  };

  const pesanGalat = actionData && "galat" in actionData ? actionData.galat : null;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold" data-testid="judul-halaman">
          {t.dokumen.judul}
        </h1>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
          {t.dokumen.keterangan}
        </p>
      </div>

      {bolehUbah ? (
        <details className="rounded-md border border-slate-200 p-4 dark:border-slate-800">
          <summary
            className="cursor-pointer text-sm font-medium"
            data-testid="buka-form-tambah"
          >
            {t.dokumen.tambahJudul}
          </summary>

          <Form method="post" className="mt-4 flex flex-col gap-4">
            <PesanGalat pesan={pesanGalat} />
            <p className="rounded-md bg-slate-100 px-3 py-2 text-xs text-slate-600 dark:bg-slate-900 dark:text-slate-400">
              {t.dokumen.nomorOtomatis}
            </p>

            <div className="grid gap-4 sm:grid-cols-2">
              <Kolom label={t.dokumen.judulDokumen}>
                <Teks name="judul" required maxLength={200} data-testid="input-judul" />
              </Kolom>
              <Kolom label={t.umum.namaInggris}>
                <Teks name="judulEn" maxLength={200} />
              </Kolom>
              <Kolom label={t.dokumen.kategori}>
                <Pilihan
                  name="kategori"
                  defaultValue="tata-kelola"
                  data-testid="input-kategori"
                >
                  {KATEGORI_DOKUMEN.map((k) => (
                    <option key={k} value={k}>
                      {labelKategori[k]}
                    </option>
                  ))}
                </Pilihan>
              </Kolom>
              <Kolom label={t.dokumen.unitPemilik}>
                <Pilihan name="unitKerjaId" defaultValue="" data-testid="input-unit">
                  <option value="">{t.dokumen.tanpaUnit}</option>
                  {unit.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.kode} — {u.nama}
                    </option>
                  ))}
                </Pilihan>
              </Kolom>
              <Kolom label={t.dokumen.tanggalTinjauUlang} petunjuk={t.dokumen.tinjauPetunjuk}>
                <Teks type="date" name="tanggalTinjauUlang" data-testid="input-tinjau" />
              </Kolom>
            </div>

            <Kolom label={t.dokumen.ringkasan}>
              <AreaTeks name="ringkasan" maxLength={2000} />
            </Kolom>

            <div>
              <Tombol type="submit" disabled={sedangKirim} data-testid="tombol-simpan">
                {sedangKirim ? t.umum.sedangMenyimpan : t.umum.simpan}
              </Tombol>
            </div>
          </Form>
        </details>
      ) : (
        <p className="text-sm text-slate-500 dark:text-slate-400">{t.umum.hanyaBaca}</p>
      )}

      <Tabel
        testId="tabel-dokumen"
        judulKolom={[
          t.dokumen.nomor,
          t.dokumen.judulDokumen,
          t.dokumen.kategori,
          t.dokumen.versi,
          t.umum.status,
          t.umum.aksi,
        ]}
      >
        {dokumen.length === 0 ? (
          <BarisKosong kolom={6} pesan={t.umum.tidakAdaData} />
        ) : (
          dokumen.map((d) => (
            <tr key={d.id}>
              <Sel>
                <code className="text-xs" data-testid={`nomor-${d.id}`}>
                  {d.nomor}
                </code>
              </Sel>
              <Sel>{d.judul}</Sel>
              <Sel>{labelKategori[d.kategori]}</Sel>
              <Sel>{d.versiTerkini > 0 ? `v${d.versiTerkini}` : t.umum.tidakAda}</Sel>
              <Sel>
                <span data-testid={`status-${d.id}`}>{labelStatus[d.status]}</span>
              </Sel>
              <Sel>
                <Link
                  to={`/internal/dokumen/${d.id}`}
                  className="text-sky-700 underline dark:text-sky-400"
                  data-testid={`buka-${d.id}`}
                >
                  {bolehUbah ? t.umum.ubah : t.dokumen.lihat}
                </Link>
              </Sel>
            </tr>
          ))
        )}
      </Tabel>
    </div>
  );
}
