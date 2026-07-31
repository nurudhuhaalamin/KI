import { asc, eq } from "drizzle-orm";

import type { Db } from "~/lib/db";
import { tenant, type StatusTenant } from "~/lib/db/schema/tenant";

function buatId(): string {
  return `ten_${crypto.randomUUID().replaceAll("-", "").slice(0, 20)}`;
}

/**
 * Proyeksi aman untuk daftar yang tidak memerlukan data sensitif — termasuk
 * direktori tenant di website publik nanti (modul M).
 *
 * NPWP, NIB, dan seluruh data kontak PIC sengaja TIDAK ada di sini. Menambahkan
 * kolom sensitif ke proyeksi ini berarti membocorkannya ke setiap pemakainya.
 */
export const KOLOM_PUBLIK = {
  id: tenant.id,
  kode: tenant.kode,
  namaPerusahaan: tenant.namaPerusahaan,
  bidangUsaha: tenant.bidangUsaha,
  status: tenant.status,
  aktif: tenant.aktif,
} as const;

/** Daftar tanpa data sensitif. Dipakai halaman daftar dan pilihan formulir. */
export function daftarTenantRingkas(db: Db) {
  return db.select(KOLOM_PUBLIK).from(tenant).orderBy(asc(tenant.namaPerusahaan));
}

/** Data lengkap satu tenant. Hanya untuk halaman yang perannya berhak. */
export async function ambilTenant(db: Db, id: string) {
  const [baris] = await db.select().from(tenant).where(eq(tenant.id, id)).limit(1);
  return baris ?? null;
}

export async function kodeTenantDipakai(db: Db, kode: string): Promise<boolean> {
  const [baris] = await db
    .select({ id: tenant.id })
    .from(tenant)
    .where(eq(tenant.kode, kode))
    .limit(1);
  return baris !== undefined;
}

type DataTenant = {
  namaPerusahaan: string;
  bentukBadanUsaha?: string;
  bidangUsaha?: string;
  alamat?: string;
  npwp?: string;
  nib?: string;
  kontakNama?: string;
  kontakJabatan?: string;
  kontakSurel?: string;
  kontakTelepon?: string;
  status: StatusTenant;
};

export async function buatTenant(db: Db, data: DataTenant & { kode: string }) {
  const id = buatId();
  await db.insert(tenant).values({
    id,
    kode: data.kode,
    namaPerusahaan: data.namaPerusahaan,
    bentukBadanUsaha: data.bentukBadanUsaha ?? null,
    bidangUsaha: data.bidangUsaha ?? null,
    alamat: data.alamat ?? null,
    npwp: data.npwp ?? null,
    nib: data.nib ?? null,
    kontakNama: data.kontakNama ?? null,
    kontakJabatan: data.kontakJabatan ?? null,
    kontakSurel: data.kontakSurel ?? null,
    kontakTelepon: data.kontakTelepon ?? null,
    status: data.status,
  });
  return id;
}

export async function ubahTenant(db: Db, id: string, data: DataTenant & { aktif: boolean }) {
  await db
    .update(tenant)
    .set({
      namaPerusahaan: data.namaPerusahaan,
      bentukBadanUsaha: data.bentukBadanUsaha ?? null,
      bidangUsaha: data.bidangUsaha ?? null,
      alamat: data.alamat ?? null,
      npwp: data.npwp ?? null,
      nib: data.nib ?? null,
      kontakNama: data.kontakNama ?? null,
      kontakJabatan: data.kontakJabatan ?? null,
      kontakSurel: data.kontakSurel ?? null,
      kontakTelepon: data.kontakTelepon ?? null,
      status: data.status,
      aktif: data.aktif,
      updatedAt: new Date(),
    })
    .where(eq(tenant.id, id));
}

/**
 * Menyusun ringkasan audit untuk tenant.
 *
 * Hanya menyebut kode tenant dan NAMA field yang berubah — tidak pernah
 * nilainya — agar jejak audit tidak menjadi tempat terkumpulnya NPWP, NIB,
 * dan data kontak.
 */
export function ringkasAuditTenant(
  kode: string,
  sebelum: Record<string, unknown>,
  sesudah: Record<string, unknown>,
): string {
  const berubah = Object.keys(sesudah).filter((k) => sebelum[k] !== sesudah[k]);
  return berubah.length > 0
    ? `Tenant ${kode}; field berubah: ${berubah.join(", ")}`
    : `Tenant ${kode}; tidak ada perubahan`;
}
