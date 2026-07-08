import { notFound } from "next/navigation";
import { getPlan } from "@/lib/db/repos/plans";
import { listQueries } from "@/lib/db/repos/queries";
import { PlanViewer } from "@/components/plans/PlanViewer";

export default function PlanDetailPage({ params }: { params: { id: string } }) {
  const plan = getPlan(params.id);
  if (!plan) notFound();

  const relatedQueries = listQueries().filter((q) => q.planId === plan.id);

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold text-fly-gold">Plano: {plan.fileName}</h1>
      <PlanViewer plan={plan} initialQueries={relatedQueries} />
    </div>
  );
}
