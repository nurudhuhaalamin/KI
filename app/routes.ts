import { type RouteConfig, index, prefix, route } from "@react-router/dev/routes";

export default [
  // Halaman publik
  index("routes/beranda.tsx"),
  route("masuk", "routes/masuk.tsx"),
  route("keluar", "routes/keluar.tsx"),

  // Endpoint autentikasi Better Auth
  route("api/auth/*", "routes/api.auth.ts"),

  // Halaman internal — seluruhnya wajib login
  ...prefix("internal", [route("", "routes/internal/dasbor.tsx")]),
] satisfies RouteConfig;
