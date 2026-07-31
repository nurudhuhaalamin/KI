import { Form, Link, redirect, useNavigation, useSearchParams } from "react-router";

import {
  AreaTeks,
  Centang,
  Kolom,
  PesanBerhasil,
  PesanGalat,
  Pilihan,
  Teks,
  Tombol,
} from "~/components/internal/kolom";
import { catatAudit, ringkasPerubahan } from "~/lib/audit";
import { wajibMasuk } from "~/lib/auth/sesi";
import { cloudflareContext } from "~/lib/context";
import { buatDb } from "~/lib/db";
import { PERUNTUKAN } from "~/lib/db/schema/kavling";
import { ambilKavling, ubahKavling } from "~/modules/kavling/query";
import { skemaKavlingUbah } from "~/modules/kavling/validasi";
import { useDataRoot } from "~/root";

import type { Route } from "./+types/ubah";

export async function loader({ request, params, context }: Route.LoaderArgs) {
  const { env } = context.get(cloudflareContext);
  await wajibMasuk(env, request, ["admin"]);
  const db = buatDb(env);

  const data = await ambilKavling(db, params.id);
  if (!data) throw new Response("Tidak ditemukan", { status: 404 });
  return { kavling: data };
}

export async function action({ request, params, context }: Route.ActionArgs) {
  const { env } = context.get(cloudflareContext);
  const pengguna = await wajibMasuk(env, request, ["admin"]);
  const db = buatDb(env);

  const sebelum = await ambilKavling(db, params.id);
  if (!sebelum) throw new Response("Tidak ditemukan", { status: 404 });

  const formulir = Object.fromEntries(await request.formData());
  const hasil = skemaKavlingUbah.safeParse({ ...formulir, aktif: formulir.aktif === "on" });
  if (!hasil.success) return { galat: hasil.error.issues[0]?.message ?? "Data tidak valid" };

  await ubahKavling(db, params.id, hasil.data);
  await catatAudit(db, {
    userId: pengguna.id,
    aksi: "ubah",
    entitas: "kavling",
    entitasId: params.id,
    ringkasan: `Kavling ${sebelum.kode}; ${ringkasPerubahan(
      {
        blok: sebelum.blok,
        nomor: sebelum.nomor,
        luasM2: sebelum.luasM2,
        aktif: sebelum.aktif,
      },
      {
        blok: hasil.data.blok,
        nomor: hasil.data.nomor,
        luasM2: hasil.data.luasM2,
        aktif: hasil.data.aktif,
      },
    )}`,
    request,
  });

  return redirect(`/internal/kavling/${params.id}?tersimpan=1`);
}

export default function UbahKavling({ loaderData, actionData }: Route.ComponentProps) {
  const { t } = useDataRoot();
  const navigation = useNavigation();
  const sedangKirim = navigation.state === "submitting";
  const { kavling } = loaderData;

  const [paramPencarian] = useSearchParams();
  const tersimpan = paramPencarian.has("tersimpan");

  const labelPeruntukan: Record<string, string> = {
    industri: t.kavling.peruntukanIndustri,
    komersial: t.kavling.peruntukanKomersial,
    fasilitas: t.kavling.peruntukanFasilitas,
    rth: t.kavling.peruntukanRth,
  };
  const labelStatus: Record<string, string> = {
    tersedia: t.kavling.statusTersedia,
    dipesan: t.kavling.statusDipesan,
    disewa: t.kavling.statusDisewa,
    terjual: t.kavling.statusTerjual,
  };

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link
          to="/internal/kavling"
          className="text-sm text-sky-700 underline dark:text-sky-400"
        >
          ← {t.kavling.judul}
        </Link>
        <h1 className="mt-2 text-2xl font-semibold" data-testid="judul-halaman">
          {t.kavling.ubahJudul}
        </h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          <code>{kavling.kode}</code> · {t.umum.status}:{" "}
          <span data-testid="status-kavling">{labelStatus[kavling.status]}</span>
        </p>
      </div>

      <Form method="post" className="flex max-w-2xl flex-col gap-4">
        <PesanGalat pesan={actionData?.galat} />
        {tersimpan && !actionData?.galat ? (
          <PesanBerhasil pesan={t.umum.berhasilDisimpan} />
        ) : null}

        <p className="rounded-md bg-slate-100 px-3 py-2 text-xs text-slate-600 dark:bg-slate-900 dark:text-slate-400">
          {t.kavling.statusOtomatis}
        </p>

        <div className="grid gap-4 sm:grid-cols-2">
          <Kolom label={t.kavling.blok}>
            <Teks name="blok" required defaultValue={kavling.blok} data-testid="input-blok" />
          </Kolom>
          <Kolom label={t.kavling.nomor}>
            <Teks name="nomor" required defaultValue={kavling.nomor} />
          </Kolom>
          <Kolom label={t.kavling.luas}>
            <Teks type="number" name="luasM2" required min={1} defaultValue={kavling.luasM2} />
          </Kolom>
          <Kolom label={t.kavling.peruntukan}>
            <Pilihan name="peruntukan" defaultValue={kavling.peruntukan}>
              {PERUNTUKAN.map((p) => (
                <option key={p} value={p}>
                  {labelPeruntukan[p]}
                </option>
              ))}
            </Pilihan>
          </Kolom>
          <Kolom label={t.kavling.hargaDasar}>
            <Teks
              type="number"
              name="hargaDasar"
              min={0}
              defaultValue={kavling.hargaDasar ?? ""}
            />
          </Kolom>
        </div>

        <Kolom label={t.kavling.keterangan2}>
          <AreaTeks
            name="keterangan"
            defaultValue={kavling.keterangan ?? ""}
            maxLength={1000}
          />
        </Kolom>

        <Centang name="aktif" label={t.umum.aktif} defaultChecked={kavling.aktif} />

        <div className="flex gap-3">
          <Tombol type="submit" disabled={sedangKirim} data-testid="tombol-simpan">
            {sedangKirim ? t.umum.sedangMenyimpan : t.umum.simpanPerubahan}
          </Tombol>
          <Link to="/internal/kavling">
            <Tombol type="button" variasi="kedua">
              {t.umum.batal}
            </Tombol>
          </Link>
        </div>
      </Form>
    </div>
  );
}
