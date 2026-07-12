import { notFound } from "next/navigation";
import { getQueryById } from "@/lib/db/dbAdapter";
import { HistorialDetailClient } from "@/components/history/HistorialDetailClient";

export default async function HistorialDetailPage({ params }: { params: { id: string } }) {
  const query = await getQueryById(params.id);
  if (!query) notFound();

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold text-fly-gold">Detalle de consulta</h1>
      <HistorialDetailClient query={query} />
    </div>
  );
}
