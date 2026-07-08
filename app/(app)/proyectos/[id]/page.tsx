import { notFound } from "next/navigation";
import Link from "next/link";
import { getProject } from "@/lib/db/repos/projects";
import { listQueriesByProject } from "@/lib/db/repos/queries";
import { listPlansByProject } from "@/lib/db/repos/plans";
import { QueryHistoryItem } from "@/components/history/QueryHistoryItem";
import { formatDateTime } from "@/lib/utils/dates";

export default function ProjectDetailPage({ params }: { params: { id: string } }) {
  const project = getProject(params.id);
  if (!project) notFound();

  const queries = listQueriesByProject(project.id);
  const plans = listPlansByProject(project.id);

  const checklist = Array.from(new Set(queries.flatMap((q) => q.response.checklist)));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-fly-gold">{project.name}</h1>
        <p className="text-sm text-fly-lightgray/70">{project.client}</p>
        <p className="text-xs text-fly-lightgray/50">{project.address}</p>
        <p className="text-xs text-fly-lightgray/50">Creado: {formatDateTime(project.createdAt)}</p>
      </div>

      <section>
        <div className="flex items-center justify-between mb-2">
          <h2 className="font-semibold">Planos ({plans.length})</h2>
          <Link href="/planos" className="text-sm text-fly-gold hover:underline">
            Subir plano
          </Link>
        </div>
        <div className="space-y-2">
          {plans.length === 0 && <p className="text-sm text-fly-lightgray/60">Sin planos aun.</p>}
          {plans.map((plan) => (
            <Link
              key={plan.id}
              href={`/planos/${plan.id}`}
              className="block rounded-xl border border-fly-gray bg-fly-charcoal p-3 hover:border-fly-gold transition text-sm"
            >
              {plan.fileName} {plan.sheet ? `· ${plan.sheet}` : ""}
            </Link>
          ))}
        </div>
      </section>

      <section>
        <h2 className="font-semibold mb-2">Checklist consolidado del proyecto ({checklist.length})</h2>
        {checklist.length === 0 ? (
          <p className="text-sm text-fly-lightgray/60">Aun no hay checklist generado para este proyecto.</p>
        ) : (
          <ul className="space-y-1 rounded-xl border border-fly-gray bg-fly-charcoal p-4">
            {checklist.map((item, idx) => (
              <li key={idx} className="flex gap-2 text-sm">
                <input type="checkbox" className="mt-1" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2 className="font-semibold mb-2">Consultas del proyecto ({queries.length})</h2>
        <div className="space-y-2">
          {queries.length === 0 && <p className="text-sm text-fly-lightgray/60">Sin consultas aun.</p>}
          {queries.map((q) => (
            <QueryHistoryItem key={q.id} query={q} />
          ))}
        </div>
      </section>
    </div>
  );
}
