import { drizzle } from "drizzle-orm/d1";

import * as schema from "./schema";

/**
 * Membuat koneksi database untuk satu permintaan.
 *
 * Binding D1 hanya tersedia di dalam konteks permintaan Worker, jadi koneksi
 * tidak boleh dibuat sebagai modul global — selalu panggil fungsi ini dari
 * loader atau action, dengan `env` yang diambil dari `cloudflareContext`.
 */
export function buatDb(env: Env) {
  return drizzle(env.DB, { schema });
}

export type Db = ReturnType<typeof buatDb>;
export { schema };
