import { ambilSesi } from "~/lib/auth/sesi";
import { adalahJenisBerkas, ambilBerkasTerizin } from "~/lib/berkas/akses";
import { responsUnduhan } from "~/lib/berkas/r2";
import { cloudflareContext } from "~/lib/context";
import { buatDb } from "~/lib/db";

import type { Route } from "./+types/berkas";

/**
 * Satu-satunya jalan mengunduh berkas dari R2.
 *
 * Kunci R2 tidak pernah dikirim ke klien, dan seluruh pemeriksaan izin ada di
 * `ambilBerkasTerizin()` supaya tidak ada modul yang punya versi sendiri.
 * Semua penolakan dijawab 404 — bukan 403 — agar keberadaan berkas milik pihak
 * lain tidak bisa disimpulkan dari kode statusnya.
 */
export async function loader({ request, params, context }: Route.LoaderArgs) {
  if (!adalahJenisBerkas(params.jenis)) {
    throw new Response("Tidak ditemukan", { status: 404 });
  }

  const { env } = context.get(cloudflareContext);
  const pengguna = await ambilSesi(env, request);
  const db = buatDb(env);

  const berkas = await ambilBerkasTerizin(env, db, pengguna, params.jenis, params.id);
  if (!berkas) throw new Response("Tidak ditemukan", { status: 404 });

  return responsUnduhan(berkas.objek, berkas.namaBerkas, berkas.tipeMime);
}
