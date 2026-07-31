import tseslint from "typescript-eslint";

export default tseslint.config(
  {
    ignores: [
      "node_modules/**",
      "build/**",
      ".wrangler/**",
      ".react-router/**",
      "playwright-report/**",
      "test-results/**",
      "worker-configuration.d.ts",
      "db/migrations/**",
    ],
  },
  ...tseslint.configs.recommended,
  {
    rules: {
      // Variabel tak terpakai adalah kesalahan, kecuali sengaja diawali "_".
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
      // `any` mematikan seluruh manfaat TypeScript — jaring pengaman utama
      // proyek ini. Pakai `unknown` lalu persempit tipenya.
      "@typescript-eslint/no-explicit-any": "error",
      // console.log tertinggal mengotori log Worker; peringatan & galat boleh.
      "no-console": ["error", { allow: ["warn", "error"] }],
      eqeqeq: ["error", "smart"],
    },
  },
  {
    // Skrip perkakas memang berkomunikasi lewat terminal.
    files: ["scripts/**/*.ts"],
    rules: { "no-console": "off" },
  },
);
