import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { hasPermission } from "@/lib/auth/permissions";
import { listQueriesRequiringReview } from "@/lib/db/repos/queries";
import { getReviewByQuery } from "@/lib/db/repos/reviews";
import { ReviewQueueItem } from "@/components/review/ReviewQueueItem";

export default function RevisionMasterPage() {
  const user = getCurrentUser();
  if (!user || !hasPermission(user.role, "review.decide")) redirect("/dashboard");

  const queries = listQueriesRequiringReview();

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold text-fly-gold">Revision del Master</h1>
      <p className="text-sm text-fly-lightgray/70">
        Consultas marcadas como riesgo alto/critico o escaladas manualmente por un tecnico.
      </p>
      <div className="space-y-3">
        {queries.length === 0 && <p className="text-sm text-fly-lightgray/60">No hay consultas pendientes de revision.</p>}
        {queries.map((q) => (
          <ReviewQueueItem key={q.id} query={q} review={getReviewByQuery(q.id)} />
        ))}
      </div>
    </div>
  );
}
