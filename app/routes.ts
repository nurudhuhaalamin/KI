import { type RouteConfig, index, layout, prefix, route } from "@react-router/dev/routes";

export default [
  // Halaman publik
  index("routes/beranda.tsx"),
  route("masuk", "routes/masuk.tsx"),
  route("keluar", "routes/keluar.tsx"),

  // Endpoint autentikasi Better Auth
  route("api/auth/*", "routes/api.auth.ts"),

  // Halaman internal — seluruhnya wajib login, dijaga oleh loader tata letak
  ...prefix("internal", [
    layout("routes/internal/layout.tsx", [
      index("routes/internal/dasbor.tsx"),
      route("unit-kerja", "routes/internal/unit-kerja/daftar.tsx"),
      route("unit-kerja/:id", "routes/internal/unit-kerja/ubah.tsx"),
      route("jabatan", "routes/internal/jabatan/daftar.tsx"),
      route("jabatan/:id", "routes/internal/jabatan/ubah.tsx"),
      route("pengguna", "routes/internal/pengguna/daftar.tsx"),
      route("pengguna/:id", "routes/internal/pengguna/ubah.tsx"),
      route("pengaturan", "routes/internal/pengaturan.tsx"),
      route("jejak-audit", "routes/internal/jejak-audit.tsx"),
    ]),
  ]),
] satisfies RouteConfig;
