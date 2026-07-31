import { redirect } from "react-router";

import type { Peran } from "../db/schema/auth";
import { buatAuth } from "./server";

export type PenggunaSesi = {
  id: string;
  nama: string;
  surel: string;
  peran: Peran;
  aktif: boolean;
  /** Perusahaan yang ditautkan, hanya terisi untuk pengguna berperan tenant. */
  tenantId: string | null;
};

/**
 * Membaca sesi yang sedang berjalan. Mengembalikan `null` bila belum masuk.
 * Aman dipanggil dari halaman publik.
 */
export async function ambilSesi(env: Env, request: Request): Promise<PenggunaSesi | null> {
  const auth = buatAuth(env, request);
  const sesi = await auth.api.getSession({ headers: request.headers });
  if (!sesi?.user) return null;

  const pengguna = sesi.user as typeof sesi.user & {
    peran?: Peran;
    aktif?: boolean;
    tenantId?: string | null;
  };

  // Akun yang dinonaktifkan diperlakukan seperti belum masuk.
  if (pengguna.aktif === false) return null;

  return {
    id: pengguna.id,
    nama: pengguna.name,
    surel: pengguna.email,
    peran: pengguna.peran ?? "staf",
    aktif: pengguna.aktif ?? true,
    tenantId: pengguna.tenantId ?? null,
  };
}

/**
 * Pengaman halaman internal. Melempar redirect ke halaman masuk bila belum
 * login, atau respons 403 bila perannya tidak diizinkan.
 *
 * Pemeriksaan hak akses WAJIB dilakukan di loader/action seperti ini —
 * menyembunyikan tombol di tampilan saja tidak mengamankan apa pun.
 */
export async function wajibMasuk(
  env: Env,
  request: Request,
  peranDiizinkan?: readonly Peran[],
): Promise<PenggunaSesi> {
  const pengguna = await ambilSesi(env, request);

  if (!pengguna) {
    const tujuan = new URL(request.url);
    const params = new URLSearchParams({ lanjut: tujuan.pathname + tujuan.search });
    throw redirect(`/masuk?${params.toString()}`);
  }

  if (peranDiizinkan && !peranDiizinkan.includes(pengguna.peran)) {
    throw new Response("Akses ditolak", { status: 403 });
  }

  return pengguna;
}
