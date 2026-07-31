/**
 * Penyimpanan berkas di Cloudflare R2.
 *
 * Mengikuti .claude/rules/keamanan.md: tipe dan ukuran dibatasi, dan nama
 * berkas dari pengguna TIDAK PERNAH dipakai sebagai path penyimpanan. Kunci
 * objek dibuat sistem; nama asli hanya disimpan sebagai metadata untuk
 * ditampilkan kembali kepada pengguna.
 */

/** Tipe yang diterima beserta ekstensi resminya. */
export const TIPE_DIIZINKAN: Record<string, string> = {
  "application/pdf": "pdf",
  "image/jpeg": "jpg",
  "image/png": "png",
};

export const UKURAN_MAKSIMUM = 10 * 1024 * 1024; // 10 MB

export type GalatBerkas = "tipeTidakDiizinkan" | "terlaluBesar" | "kosong";

export function periksaBerkas(berkas: File): GalatBerkas | null {
  if (berkas.size === 0) return "kosong";
  if (berkas.size > UKURAN_MAKSIMUM) return "terlaluBesar";
  if (!(berkas.type in TIPE_DIIZINKAN)) return "tipeTidakDiizinkan";
  return null;
}

/**
 * Menyusun kunci objek R2 yang aman.
 *
 * Nama asli sepenuhnya dibuang dari path. Ekstensi diambil dari tipe MIME yang
 * sudah lolos daftar izin, bukan dari nama berkas — sehingga berkas bernama
 * "../../rahasia.pdf.exe" tidak bisa menembus folder lain maupun menyelundupkan
 * ekstensi yang tidak diinginkan.
 */
export function buatKunci(awalan: string, idInduk: string, tipeMime: string): string {
  const ekstensi = TIPE_DIIZINKAN[tipeMime];
  if (!ekstensi) throw new Error("Tipe berkas tidak diizinkan");

  const bagianAman = (nilai: string) => nilai.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 64);
  return `${bagianAman(awalan)}/${bagianAman(idInduk)}/${crypto.randomUUID()}.${ekstensi}`;
}

/**
 * Membersihkan nama berkas untuk ditampilkan dan dipakai pada header
 * Content-Disposition. Baris baru dan tanda kutip dibuang karena bisa dipakai
 * menyuntikkan header tambahan.
 */
export function rapikanNamaTampilan(nama: string): string {
  const bersih = nama
    .replace(/[\r\n"\\]/g, "")
    .replace(/[/\\]/g, "-")
    .trim();
  return (bersih.length > 0 ? bersih : "berkas").slice(0, 120);
}

export async function unggahBerkas(
  env: Env,
  kunci: string,
  berkas: File,
): Promise<{ kunci: string; ukuran: number; tipeMime: string }> {
  await env.BERKAS.put(kunci, await berkas.arrayBuffer(), {
    httpMetadata: { contentType: berkas.type },
  });
  return { kunci, ukuran: berkas.size, tipeMime: berkas.type };
}

export function ambilBerkas(env: Env, kunci: string) {
  return env.BERKAS.get(kunci);
}

export async function hapusBerkas(env: Env, kunci: string): Promise<void> {
  await env.BERKAS.delete(kunci);
}

/**
 * Menyusun respons unduhan. Dipanggil HANYA setelah hak akses diperiksa —
 * kunci R2 tidak pernah dikirim ke klien, jadi tidak ada cara menebak alamat
 * berkas milik orang lain.
 */
export function responsUnduhan(
  objek: R2ObjectBody,
  namaTampilan: string,
  tipeMime: string,
): Response {
  return new Response(objek.body, {
    headers: {
      "Content-Type": tipeMime,
      "Content-Disposition": `attachment; filename="${rapikanNamaTampilan(namaTampilan)}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
