import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";

import { buatDb, schema } from "../db";
import { PERAN } from "../db/schema/auth";

/**
 * Membuat instans Better Auth untuk satu permintaan.
 *
 * Sama seperti koneksi database, instans ini tidak boleh menjadi modul global
 * karena bergantung pada binding Worker yang hanya ada di dalam permintaan.
 */
export function buatAuth(env: Env, request: Request) {
  const db = buatDb(env);
  const asal = new URL(request.url).origin;

  return betterAuth({
    baseURL: asal,
    secret: env.BETTER_AUTH_SECRET,
    database: drizzleAdapter(db, {
      provider: "sqlite",
      schema: {
        user: schema.users,
        session: schema.sessions,
        account: schema.accounts,
        verification: schema.verifications,
      },
    }),
    emailAndPassword: {
      enabled: true,
      // Verifikasi surel diaktifkan pada tahap modul pengguna, setelah
      // pengiriman surel (Resend) dipasang.
      requireEmailVerification: false,
      minPasswordLength: 12,
    },
    user: {
      additionalFields: {
        peran: {
          type: PERAN as unknown as string[],
          required: false,
          defaultValue: "staf",
          input: false, // tidak boleh diisi sendiri saat pendaftaran
        },
        aktif: {
          type: "boolean",
          required: false,
          defaultValue: true,
          input: false,
        },
        // Penautan ke perusahaan untuk pengguna berperan tenant. Portal tenant
        // menyaring seluruh datanya dengan nilai ini.
        tenantId: {
          type: "string",
          required: false,
          input: false,
        },
      },
    },
    session: {
      expiresIn: 60 * 60 * 8, // 8 jam kerja
      updateAge: 60 * 60, // perpanjang tiap jam selama masih dipakai
    },
    advanced: {
      useSecureCookies: asal.startsWith("https://"),
    },
  });
}

export type Auth = ReturnType<typeof buatAuth>;
