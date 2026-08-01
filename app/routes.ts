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
      route("kavling", "routes/internal/kavling/daftar.tsx"),
      route("kavling/:id", "routes/internal/kavling/ubah.tsx"),
      route("tenant", "routes/internal/tenant/daftar.tsx"),
      route("tenant/:id", "routes/internal/tenant/ubah.tsx"),
      route("kontrak", "routes/internal/kontrak/daftar.tsx"),
      route("kontrak/:id", "routes/internal/kontrak/ubah.tsx"),
      route("pengguna", "routes/internal/pengguna/daftar.tsx"),
      route("pengguna/:id", "routes/internal/pengguna/ubah.tsx"),
      route("dokumen", "routes/internal/dokumen/daftar.tsx"),
      route("dokumen/:id", "routes/internal/dokumen/ubah.tsx"),
      route("jenis-izin", "routes/internal/jenis-izin/daftar.tsx"),
      route("jenis-izin/:id", "routes/internal/jenis-izin/ubah.tsx"),
      route("permohonan", "routes/internal/permohonan/daftar.tsx"),
      route("permohonan/:id", "routes/internal/permohonan/ubah.tsx"),
      route("pengaturan", "routes/internal/pengaturan.tsx"),
      route("jejak-audit", "routes/internal/jejak-audit.tsx"),
    ]),
    // Di luar tata letak internal: mengembalikan berkas, bukan halaman.
    route("berkas/:jenis/:id", "routes/internal/berkas.tsx"),
  ]),

  // Portal perusahaan penyewa
  ...prefix("portal", [
    layout("routes/tenant/layout.tsx", [
      index("routes/tenant/beranda.tsx"),
      route("permohonan", "routes/tenant/permohonan/daftar.tsx"),
      route("permohonan/baru", "routes/tenant/permohonan/baru.tsx"),
      route("permohonan/:id", "routes/tenant/permohonan/rincian.tsx"),
    ]),
  ]),
] satisfies RouteConfig;
