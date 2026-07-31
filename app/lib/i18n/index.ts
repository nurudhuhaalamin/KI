import { en } from "./en";
import { id, type Messages } from "./id";

export type Locale = "id" | "en";

export const LOCALE_TERSEDIA: readonly Locale[] = ["id", "en"];
export const NAMA_COOKIE_LOKALE = "lokale";

const kamus: Record<Locale, Messages> = { id, en };

export function adalahLocale(nilai: string | null | undefined): nilai is Locale {
  return nilai === "id" || nilai === "en";
}

/**
 * Menentukan bahasa dari permintaan, berurutan:
 * 1. parameter `?lang=` (dipakai saat pengguna menekan pemilih bahasa),
 * 2. cookie `lokale` (pilihan yang tersimpan),
 * 3. header Accept-Language dari peramban,
 * 4. bahasa bawaan kawasan.
 */
export function ambilLocale(request: Request, bawaan: string = "id"): Locale {
  const url = new URL(request.url);
  const dariUrl = url.searchParams.get("lang");
  if (adalahLocale(dariUrl)) return dariUrl;

  const dariCookie = bacaCookie(request.headers.get("Cookie"), NAMA_COOKIE_LOKALE);
  if (adalahLocale(dariCookie)) return dariCookie;

  const dariPeramban = request.headers.get("Accept-Language")?.slice(0, 2).toLowerCase();
  if (adalahLocale(dariPeramban)) return dariPeramban;

  return adalahLocale(bawaan) ? bawaan : "id";
}

export function pesan(locale: Locale): Messages {
  return kamus[locale];
}

export function cookieLokale(locale: Locale): string {
  const setahun = 60 * 60 * 24 * 365;
  return `${NAMA_COOKIE_LOKALE}=${locale}; Path=/; Max-Age=${setahun}; SameSite=Lax`;
}

function bacaCookie(header: string | null, nama: string): string | undefined {
  if (!header) return undefined;
  for (const bagian of header.split(";")) {
    const [kunci, ...sisa] = bagian.trim().split("=");
    if (kunci === nama) return decodeURIComponent(sisa.join("="));
  }
  return undefined;
}

export type { Messages };
