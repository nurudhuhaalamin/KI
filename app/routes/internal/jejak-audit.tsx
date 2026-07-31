import { Form, useSearchParams } from "react-router";

import { Kolom, Pilihan, Tombol } from "~/components/internal/kolom";
import { BarisKosong, Sel, Tabel } from "~/components/internal/tabel";
import { bacaJejakAudit, type AksiAudit } from "~/lib/audit";
import { wajibMasuk } from "~/lib/auth/sesi";
import { cloudflareContext } from "~/lib/context";
import { buatDb } from "~/lib/db";
import { daftarPengguna } from "~/modules/organisasi/query";
import { useDataRoot } from "~/root";

import type { Route } from "./+types/jejak-audit";

const ENTITAS = ["unit_kerja", "jabatan", "pengguna", "pengaturan"] as const;
const AKSI: AksiAudit[] = ["buat", "ubah", "hapus", "masuk", "keluar"];

export async function loader({ request, context }: Route.LoaderArgs) {
  const { env } = context.get(cloudflareContext);
  await wajibMasuk(env, request, ["admin", "manajemen"]);
  const db = buatDb(env);

  const url = new URL(request.url);
  const entitas = url.searchParams.get("entitas") ?? undefined;
  const aksiParam = url.searchParams.get("aksi");
  const aksi = AKSI.includes(aksiParam as AksiAudit) ? (aksiParam as AksiAudit) : undefined;

  const [jejak, pengguna] = await Promise.all([
    bacaJejakAudit(db, { entitas: entitas || undefined, aksi, batas: 200 }),
    daftarPengguna(db),
  ]);

  // Nama pelaku diambil sekali di sini agar tabel tidak perlu kueri per baris.
  const namaPengguna = Object.fromEntries(pengguna.map((p) => [p.id, p.nama]));

  return { jejak, namaPengguna };
}

export default function JejakAudit({ loaderData }: Route.ComponentProps) {
  const { t, locale } = useDataRoot();
  const [paramPencarian] = useSearchParams();
  const { jejak, namaPengguna } = loaderData;

  const labelAksi: Record<string, string> = {
    buat: t.jejakAudit.aksiBuat,
    ubah: t.jejakAudit.aksiUbah,
    hapus: t.jejakAudit.aksiHapus,
    masuk: t.jejakAudit.aksiMasuk,
    keluar: t.jejakAudit.aksiKeluar,
  };

  const formatWaktu = new Intl.DateTimeFormat(locale === "en" ? "en-GB" : "id-ID", {
    dateStyle: "medium",
    timeStyle: "short",
  });

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold" data-testid="judul-halaman">
          {t.jejakAudit.judul}
        </h1>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
          {t.jejakAudit.keterangan}
        </p>
      </div>

      <Form method="get" className="flex flex-wrap items-end gap-4">
        <Kolom label={t.jejakAudit.entitas}>
          <Pilihan
            name="entitas"
            defaultValue={paramPencarian.get("entitas") ?? ""}
            data-testid="saring-entitas"
          >
            <option value="">{t.jejakAudit.semuaEntitas}</option>
            {ENTITAS.map((e) => (
              <option key={e} value={e}>
                {e}
              </option>
            ))}
          </Pilihan>
        </Kolom>

        <Kolom label={t.jejakAudit.aksi}>
          <Pilihan name="aksi" defaultValue={paramPencarian.get("aksi") ?? ""}>
            <option value="">{t.jejakAudit.semuaAksi}</option>
            {AKSI.map((a) => (
              <option key={a} value={a}>
                {labelAksi[a]}
              </option>
            ))}
          </Pilihan>
        </Kolom>

        <Tombol type="submit" variasi="kedua" data-testid="tombol-saring">
          {t.jejakAudit.saring}
        </Tombol>
      </Form>

      <Tabel
        testId="tabel-jejak-audit"
        judulKolom={[
          t.jejakAudit.waktu,
          t.jejakAudit.pelaku,
          t.jejakAudit.aksi,
          t.jejakAudit.entitas,
          t.jejakAudit.ringkasan,
        ]}
      >
        {jejak.length === 0 ? (
          <BarisKosong kolom={5} pesan={t.umum.tidakAdaData} />
        ) : (
          jejak.map((b) => (
            <tr key={b.id}>
              <Sel>
                <span className="whitespace-nowrap text-xs">
                  {formatWaktu.format(b.createdAt)}
                </span>
              </Sel>
              <Sel>{b.userId ? (namaPengguna[b.userId] ?? b.userId) : t.jejakAudit.sistem}</Sel>
              <Sel>{labelAksi[b.aksi] ?? b.aksi}</Sel>
              <Sel>
                <code className="text-xs">{b.entitas}</code>
              </Sel>
              <Sel>
                <span className="text-xs text-slate-600 dark:text-slate-400">
                  {b.ringkasan ?? t.umum.tidakAda}
                </span>
              </Sel>
            </tr>
          ))
        )}
      </Tabel>
    </div>
  );
}
