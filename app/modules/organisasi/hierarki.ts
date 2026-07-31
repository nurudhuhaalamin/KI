/** Simpul apa pun yang punya rujukan ke induknya. */
export type Simpul = { id: string; indukId?: string | null };

/**
 * Memeriksa apakah menetapkan `indukBaruId` sebagai induk `simpulId` akan
 * membentuk gelung (unit menjadi induk dari dirinya sendiri, langsung maupun
 * lewat rantai).
 *
 * Gelung membuat penelusuran struktur organisasi berputar tanpa henti, jadi
 * pemeriksaan ini wajib dilakukan di server — bukan hanya disembunyikan dari
 * pilihan di antarmuka.
 */
export function akanMembentukGelung(
  daftar: readonly Simpul[],
  simpulId: string,
  indukBaruId: string | null | undefined,
): boolean {
  if (!indukBaruId) return false;
  if (indukBaruId === simpulId) return true;

  const indukDari = new Map<string, string | null>();
  for (const simpul of daftar) indukDari.set(simpul.id, simpul.indukId ?? null);

  // Telusuri ke atas dari calon induk. Bila bertemu simpulId, berarti simpulId
  // adalah leluhur dari calon induknya — memasangnya akan menutup gelung.
  const dikunjungi = new Set<string>();
  let sekarang: string | null | undefined = indukBaruId;

  while (sekarang) {
    if (sekarang === simpulId) return true;
    if (dikunjungi.has(sekarang)) break; // data sudah rusak; hentikan penelusuran
    dikunjungi.add(sekarang);
    sekarang = indukDari.get(sekarang) ?? null;
  }

  return false;
}

/** Menyusun daftar id keturunan sebuah simpul, tidak termasuk simpul itu sendiri. */
export function keturunanDari(daftar: readonly Simpul[], simpulId: string): string[] {
  const anakDari = new Map<string, string[]>();
  for (const simpul of daftar) {
    const induk = simpul.indukId;
    if (!induk) continue;
    const daftarAnak = anakDari.get(induk) ?? [];
    daftarAnak.push(simpul.id);
    anakDari.set(induk, daftarAnak);
  }

  const hasil: string[] = [];
  const antrian = [...(anakDari.get(simpulId) ?? [])];
  const dikunjungi = new Set<string>();

  while (antrian.length > 0) {
    const id = antrian.shift();
    if (!id || dikunjungi.has(id)) continue;
    dikunjungi.add(id);
    hasil.push(id);
    antrian.push(...(anakDari.get(id) ?? []));
  }

  return hasil;
}

export type PenggunaRingkas = { id: string; peran: string; aktif: boolean };

/**
 * Melarang penghapusan administrator aktif yang terakhir.
 *
 * Tanpa aturan ini, satu klik keliru bisa mengunci pengelola kawasan dari
 * sistemnya sendiri tanpa cara memulihkan selain menyunting database langsung.
 */
export function bolehMenurunkanAdmin(
  semuaPengguna: readonly PenggunaRingkas[],
  idTarget: string,
  peranBaru: string,
  aktifBaru: boolean,
): boolean {
  const target = semuaPengguna.find((p) => p.id === idTarget);
  if (!target) return true;

  const targetTetapAdminAktif = peranBaru === "admin" && aktifBaru;
  if (targetTetapAdminAktif) return true;

  const adminAktifLain = semuaPengguna.filter(
    (p) => p.id !== idTarget && p.peran === "admin" && p.aktif,
  );

  return adminAktifLain.length > 0;
}
