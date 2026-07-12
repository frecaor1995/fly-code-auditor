import { getQueries } from "@/lib/db/dbAdapter";
import { QueryHistoryItem } from "@/components/history/QueryHistoryItem";

export default async function HistorialPage() {
  const queries = await getQueries();
  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold text-fly-gold">Historial de consultas</h1>
      <div className="space-y-2">
        {queries.length === 0 && <p className="text-sm text-fly-lightgray/60">Aun no hay consultas.</p>}
        {queries.map((q) => (
          <QueryHistoryItem key={q.id} query={q} />
        ))}
      </div>
    </div>
  );
}
