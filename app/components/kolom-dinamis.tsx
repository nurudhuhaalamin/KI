import { AreaTeks, Kolom, Pilihan, Teks } from "~/components/internal/kolom";
import type { DefinisiKolom } from "~/modules/perizinan/formulir";

/**
 * Merender kolom formulir dari definisi yang tersimpan di jenis izin.
 *
 * Yang dirender di sini dan yang divalidasi di server berasal dari definisi yang
 * sama, sehingga formulir tidak mungkin menanyakan sesuatu yang tidak diperiksa
 * — atau sebaliknya.
 */
export function KolomDinamis({
  definisi,
  nilai,
  locale,
  nonaktif,
}: {
  definisi: readonly DefinisiKolom[];
  nilai: Record<string, string>;
  locale: "id" | "en";
  nonaktif?: boolean;
}) {
  if (definisi.length === 0) return null;

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {definisi.map((kolom) => {
        const label = (locale === "en" && kolom.labelEn) || kolom.label;
        const isi = nilai[kolom.nama] ?? "";
        const testId = `isian-${kolom.nama}`;

        return (
          <Kolom key={kolom.nama} label={label} petunjuk={kolom.petunjuk}>
            {kolom.tipe === "teks-panjang" ? (
              <AreaTeks
                name={kolom.nama}
                defaultValue={isi}
                disabled={nonaktif}
                data-testid={testId}
              />
            ) : kolom.tipe === "pilihan" ? (
              <Pilihan
                name={kolom.nama}
                defaultValue={isi}
                disabled={nonaktif}
                data-testid={testId}
              >
                <option value="">—</option>
                {(kolom.pilihan ?? []).map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </Pilihan>
            ) : (
              <Teks
                // `required` sengaja TIDAK dipasang: pemeriksaan yang berlaku ada
                // di server, dan menandainya di sini saja akan menyesatkan.
                type={
                  kolom.tipe === "angka" ? "number" : kolom.tipe === "tanggal" ? "date" : "text"
                }
                step={kolom.tipe === "angka" ? "any" : undefined}
                name={kolom.nama}
                defaultValue={isi}
                disabled={nonaktif}
                data-testid={testId}
              />
            )}
          </Kolom>
        );
      })}
    </div>
  );
}
