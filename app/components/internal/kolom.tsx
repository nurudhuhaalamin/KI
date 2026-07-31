import type { ReactNode } from "react";

const gayaMasukan =
  "w-full rounded-md border border-slate-300 px-3 py-2 text-sm font-normal disabled:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:disabled:bg-slate-800";

export function Kolom({
  label,
  petunjuk,
  children,
}: {
  label: string;
  petunjuk?: string;
  children: ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1 text-sm font-medium">
      {label}
      {children}
      {petunjuk ? (
        <span className="text-xs font-normal text-slate-500 dark:text-slate-400">
          {petunjuk}
        </span>
      ) : null}
    </label>
  );
}

export function Teks(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={gayaMasukan} />;
}

export function AreaTeks(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea rows={3} {...props} className={gayaMasukan} />;
}

export function Pilihan(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className={gayaMasukan} />;
}

export function Centang({
  label,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & { label: string }) {
  return (
    <label className="flex items-center gap-2 text-sm font-medium">
      <input
        type="checkbox"
        {...props}
        className="size-4 rounded border-slate-300 dark:border-slate-700"
      />
      {label}
    </label>
  );
}

export function Tombol({
  variasi = "utama",
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variasi?: "utama" | "kedua" }) {
  const gaya =
    variasi === "utama"
      ? "bg-slate-900 text-white hover:bg-slate-700 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-200"
      : "border border-slate-300 hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800";

  return (
    <button
      {...props}
      className={`inline-flex items-center justify-center rounded-md px-4 py-2 text-sm font-medium disabled:opacity-60 ${gaya}`}
    />
  );
}

export function PesanGalat({ pesan }: { pesan?: string | null }) {
  if (!pesan) return null;
  return (
    <p
      role="alert"
      data-testid="pesan-galat"
      className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-800 dark:bg-red-950 dark:text-red-200"
    >
      {pesan}
    </p>
  );
}

export function PesanBerhasil({ pesan }: { pesan?: string | null }) {
  if (!pesan) return null;
  return (
    <p
      role="status"
      data-testid="pesan-berhasil"
      className="rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200"
    >
      {pesan}
    </p>
  );
}
