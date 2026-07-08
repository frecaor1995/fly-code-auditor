import type { RiskLevel } from "@/lib/db/types";
import { riskColorClass } from "@/lib/utils/riskLevel";

const LABELS: Record<RiskLevel, { es: string; en: string }> = {
  bajo: { es: "Bajo", en: "Low" },
  medio: { es: "Medio", en: "Medium" },
  alto: { es: "Alto", en: "High" },
  critico: { es: "Critico", en: "Critical" }
};

export function RiskBadge({ risk, lang = "es" }: { risk: RiskLevel; lang?: "es" | "en" }) {
  return (
    <span className={`inline-block rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wide ${riskColorClass(risk)}`}>
      {LABELS[risk][lang]}
    </span>
  );
}
