import type { Config } from "@react-router/dev/config";

export default {
  // Render di server (SSR). Dibutuhkan karena hampir seluruh halaman internal
  // mengambil data dari database dan harus memeriksa hak akses di sisi server.
  ssr: true,
} satisfies Config;
