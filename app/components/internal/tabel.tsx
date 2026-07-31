import type { ReactNode } from "react";

/**
 * Tabel dasar untuk daftar data internal. Dibungkus wadah yang bisa digulir
 * mendatar supaya tabel lebar tidak memaksa seluruh halaman ikut bergeser.
 */
export function Tabel({
  judulKolom,
  children,
  testId,
}: {
  judulKolom: string[];
  children: ReactNode;
  testId?: string;
}) {
  return (
    <div className="overflow-x-auto rounded-md border border-slate-200 dark:border-slate-800">
      <table className="w-full text-left text-sm" data-testid={testId}>
        <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-600 dark:bg-slate-900 dark:text-slate-400">
          <tr>
            {judulKolom.map((judul) => (
              <th key={judul} scope="col" className="px-4 py-3 font-medium">
                {judul}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-200 dark:divide-slate-800">{children}</tbody>
      </table>
    </div>
  );
}

export function Sel({ children, ...props }: React.TdHTMLAttributes<HTMLTableCellElement>) {
  return (
    <td {...props} className="px-4 py-3 align-top">
      {children}
    </td>
  );
}

export function BarisKosong({ kolom, pesan }: { kolom: number; pesan: string }) {
  return (
    <tr>
      <td colSpan={kolom} className="px-4 py-8 text-center text-slate-500 dark:text-slate-400">
        {pesan}
      </td>
    </tr>
  );
}

export function Lencana({
  aktif,
  teksAktif,
  teksNonaktif,
}: {
  aktif: boolean;
  teksAktif: string;
  teksNonaktif: string;
}) {
  return (
    <span
      className={
        aktif
          ? "inline-flex rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200"
          : "inline-flex rounded-full bg-slate-200 px-2 py-0.5 text-xs font-medium text-slate-700 dark:bg-slate-800 dark:text-slate-300"
      }
    >
      {aktif ? teksAktif : teksNonaktif}
    </span>
  );
}
