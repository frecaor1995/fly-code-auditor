import { notFound } from "next/navigation";
import { getPlan } from "@/lib/db/repos/plans";
import { getQueries } from "@/lib/db/dbAdapter";
import { PlanViewer } from "@/components/plans/PlanViewer";

export default async function PlanDetailPage({ params }: { params: { id: string } }) {
  const plan = getPlan(params.id);
  if (!plan) notFound();

  const relatedQueries = (await getQueries()).filter((q) => q.planId === plan.id);

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold text-fly-gold">Plano: {plan.fileName}</h1>
      <PlanViewer plan={plan} initialQueries={relatedQueries} />
    </div>
  );
}
