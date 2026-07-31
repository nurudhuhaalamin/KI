import { useLocation } from "react-router";

import { LOCALE_TERSEDIA, type Locale } from "~/lib/i18n";

const label: Record<Locale, string> = { id: "ID", en: "EN" };

/**
 * Pemilih bahasa. Menautkan ke halaman yang sama dengan parameter `?lang=`,
 * yang kemudian disimpan sebagai cookie oleh loader root.
 */
export function PemilihBahasa({ aktif }: { aktif: Locale }) {
  const location = useLocation();

  return (
    <div className="flex items-center gap-1" data-testid="pemilih-bahasa">
      {LOCALE_TERSEDIA.map((locale) => {
        const params = new URLSearchParams(location.search);
        params.set("lang", locale);
        const terpilih = locale === aktif;

        return (
          <a
            key={locale}
            href={`${location.pathname}?${params.toString()}`}
            hrefLang={locale}
            aria-current={terpilih ? "true" : undefined}
            data-testid={`bahasa-${locale}`}
            className={
              terpilih
                ? "rounded bg-slate-900 px-2 py-1 text-xs font-semibold text-white dark:bg-white dark:text-slate-900"
                : "rounded px-2 py-1 text-xs font-medium text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
            }
          >
            {label[locale]}
          </a>
        );
      })}
    </div>
  );
}
