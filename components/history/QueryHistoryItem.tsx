import Link from "next/link";
import type { QueryRecord } from "@/lib/db/types";
import { RiskBadge } from "@/components/ui/RiskBadge";
import { formatDateTime } from "@/lib/utils/dates";

export function QueryHistoryItem({ query }: { query: QueryRecord }) {
  return (
    <Link
      href={`/historial/${query.id}`}
      className="block rounded-xl border border-fly-gray bg-fly-charcoal p-4 hover:border-fly-gold transition space-y-1"
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs text-fly-lightgray/60">
          {formatDateTime(query.createdAt)} · {query.mode === "voz" ? "🎙️ Voz" : "⌨️ Texto"}
        </span>
        <RiskBadge risk={query.riskLevel} />
      </div>
      <p className="text-sm font-medium line-clamp-2">{query.question}</p>
      {query.requiresMasterReview && (
        <p className="text-xs text-fly-gold">Requiere revision del Master</p>
      )}
    </Link>
  );
}
