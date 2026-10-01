import Link from "next/link";
import { APP_CONFIG } from "@/lib/config";
import type { useFieldErrors } from "./Ui";
export const consentFields = [
  [
    "ageAndRegionAccepted",
    "age_and_region",
    "Saya menyatakan berusia 18 tahun atau lebih dan menggunakan Glubee dalam cakupan layanan Indonesia.",
  ],
  [
    "legalDocumentsAccepted",
    "legal_documents",
    "Saya telah membaca dan menyetujui Syarat dan Ketentuan Glubee serta menyatakan telah menerima Kebijakan Privasi versi yang ditampilkan.",
  ],
  [
    "healthDataAccepted",
    "health_data",
    "Saya memberikan persetujuan eksplisit kepada pengelola Glubee untuk memproses data gula darah, kondisi dan waktu pengukuran, catatan, jadwal, grafik, serta laporan saya guna menjalankan fitur pencatatan, pemantauan, pengingat, keamanan, dan dukungan layanan sebagaimana dijelaskan dalam Kebijakan Privasi. Saya memahami Glubee bukan alat diagnosis atau pengganti tenaga medis.",
  ],
] as const;
export function ConsentFields({
  needed,
  validation,
}: {
  needed?: string[];
  validation?: ReturnType<typeof useFieldErrors>;
}) {
  return (
    <fieldset className="form">
      <legend>Persetujuan layanan</legend>
      <p className="small">
        <Link
          target="_blank"
          href={"/terms?version=" + APP_CONFIG.legalVersion}
        >
          Syarat & ketentuan
        </Link>{" "}
        dan{" "}
        <Link
          target="_blank"
          href={"/privacy?version=" + APP_CONFIG.legalVersion}
        >
          Kebijakan privasi
        </Link>{" "}
        · Versi {APP_CONFIG.legalVersion}
      </p>
      <p className="notice">{APP_CONFIG.developerNotice}</p>
      {consentFields
        .filter(([, type]) => !needed || needed.includes(type))
        .map(([name, , text]) => (
          <div key={name}>
            <label className="check">
              <input
                name={name}
                type="checkbox"
                required
                {...validation?.field(name)}
              />
              <span>{text}</span>
            </label>
            {validation?.error(name)}
          </div>
        ))}
    </fieldset>
  );
}
