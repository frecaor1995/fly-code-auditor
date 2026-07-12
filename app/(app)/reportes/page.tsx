import Link from "next/link";
import { getQueries } from "@/lib/db/dbAdapter";
import { RiskBadge } from "@/components/ui/RiskBadge";
import { formatDateTime } from "@/lib/utils/dates";

export default async function ReportesPage() {
  const queries = await getQueries();

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold text-fly-gold">Reportes</h1>
      <p className="text-sm text-fly-lightgray/70">
        Selecciona una consulta para generar su resumen imprimible (puedes guardarlo como PDF desde el dialogo de
        impresion del navegador).
      </p>
      <div className="space-y-2">
        {queries.length === 0 && <p className="text-sm text-fly-lightgray/60">Aun no hay consultas para reportar.</p>}
        {queries.map((q) => (
          <Link
            key={q.id}
            href={`/reportes/${q.id}/print`}
            className="flex items-center justify-between gap-2 rounded-xl border border-fly-gray bg-fly-charcoal p-4 hover:border-fly-gold transition"
          >
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium line-clamp-1">{q.question}</p>
              <p className="text-xs text-fly-lightgray/60">{formatDateTime(q.createdAt)}</p>
            </div>
            <span className="shrink-0">
              <RiskBadge risk={q.riskLevel} />
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}
