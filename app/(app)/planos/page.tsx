import Link from "next/link";
import { listPlans } from "@/lib/db/repos/plans";
import { listProjects } from "@/lib/db/repos/projects";
import { getProject } from "@/lib/db/repos/projects";
import { PlanUploader } from "@/components/plans/PlanUploader";
import { formatDateTime } from "@/lib/utils/dates";

export default function PlanosPage() {
  const plans = listPlans();
  const projects = listProjects();

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-bold text-fly-gold">Planos electricos</h1>
      <PlanUploader projects={projects} />

      <div className="space-y-2">
        <h2 className="font-semibold">Planos subidos</h2>
        {plans.length === 0 && <p className="text-sm text-fly-lightgray/60">Aun no hay planos subidos.</p>}
        {plans.map((plan) => {
          const project = plan.projectId ? getProject(plan.projectId) : null;
          return (
            <Link
              key={plan.id}
              href={`/planos/${plan.id}`}
              className="block rounded-xl border border-fly-gray bg-fly-charcoal p-4 hover:border-fly-gold transition"
            >
              <div className="flex items-center justify-between">
                <p className="font-medium">{plan.fileName}</p>
                <span className="text-xs text-fly-lightgray/60">{plan.fileType.toUpperCase()}</span>
              </div>
              <p className="text-xs text-fly-lightgray/60">
                {plan.sheet ? `${plan.sheet} · ` : ""}
                {project ? project.name : "Sin proyecto"} · {formatDateTime(plan.createdAt)}
              </p>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
