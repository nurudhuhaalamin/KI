import type { Messages } from "./id";

/**
 * English messages. Typed as `Messages`, so a missing or misspelled key
 * fails `npm run typecheck` instead of silently falling back.
 */
export const en: Messages = {
  situs: {
    nama: "Industrial Estate",
    tagline: "Estate governance and operations system",
  },
  nav: {
    beranda: "Home",
    masuk: "Sign in",
    keluar: "Sign out",
    dasbor: "Dashboard",
  },
  beranda: {
    judul: "Industrial Estate Governance & Operations System",
    ringkasan:
      "Permits, environment, infrastructure, security, and reporting for the estate in a single system.",
    masukSebagaiPengelola: "Sign in as estate staff",
  },
  masuk: {
    judul: "Sign in",
    surel: "Email address",
    kataSandi: "Password",
    tombol: "Sign in",
    sedangMemproses: "Signing in…",
    gagal: "Email address or password is incorrect.",
  },
  dasbor: {
    judul: "Dashboard",
    selamatDatang: "Welcome",
    peran: "Role",
  },
  umum: {
    bahasa: "Language",
    galat: "Something went wrong",
    galatKeterangan: "Please try again in a moment.",
    tidakDitemukan: "Page not found",
    kembaliKeBeranda: "Back to home",
  },
};
