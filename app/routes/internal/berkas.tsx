import { ambilSesi } from "~/lib/auth/sesi";
import { ambilBerkas, responsUnduhan } from "~/lib/berkas/r2";
import { cloudflareContext } from "~/lib/context";
import { buatDb } from "~/lib/db";
import { ambilLampiran } from "~/modules/kontrak/query";

import type { Route } from "./+types/berkas";

/**
 * Menyalurkan lampiran dari R2.
 *
 * Kunci R2 tidak pernah dikirim ke klien, jadi satu-satunya jalan mengunduh
 * adalah lewat rute ini — dan rute ini memeriksa hak akses LEBIH DULU.
 *
 * Aturan aksesnya:
 * - staf pengelola (admin/manajemen) boleh mengunduh lampiran mana pun;
 * - pengguna tenant hanya boleh mengunduh lampiran kontrak perusahaannya sendiri;
 * - selain itu 404 — bukan 403 — supaya keberadaan berkas milik pihak lain
 *   tidak bisa disimpulkan dari kode statusnya.
 */
export async function loader({ request, params, context }: Route.LoaderArgs) {
  const { env } = context.get(cloudflareContext);
  const pengguna = await ambilSesi(env, request);
  if (!pengguna) throw new Response("Tidak ditemukan", { status: 404 });

  const db = buatDb(env);
  const lampiran = await ambilLampiran(db, params.id);
  if (!lampiran) throw new Response("Tidak ditemukan", { status: 404 });

  const bolehLihat =
    pengguna.peran === "admin" ||
    pengguna.peran === "manajemen" ||
    (pengguna.peran === "tenant" &&
      pengguna.tenantId !== null &&
      pengguna.tenantId === lampiran.tenantId);

  if (!bolehLihat) throw new Response("Tidak ditemukan", { status: 404 });

  const objek = await ambilBerkas(env, lampiran.kunciR2);
  if (!objek) throw new Response("Tidak ditemukan", { status: 404 });

  return responsUnduhan(objek, lampiran.namaBerkas, lampiran.tipeMime);
}
