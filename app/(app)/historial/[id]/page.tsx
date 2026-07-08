import { notFound } from "next/navigation";
import { getQuery } from "@/lib/db/repos/queries";
import { HistorialDetailClient } from "@/components/history/HistorialDetailClient";

export default function HistorialDetailPage({ params }: { params: { id: string } }) {
  const query = getQuery(params.id);
  if (!query) notFound();

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold text-fly-gold">Detalle de consulta</h1>
      <HistorialDetailClient query={query} />
    </div>
  );
}
