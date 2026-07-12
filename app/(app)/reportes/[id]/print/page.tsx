import { notFound } from "next/navigation";
import { getQueryById, getProjects } from "@/lib/db/dbAdapter";
import { getUserById, getUserByEmail } from "@/lib/db/repos/users";
import { getReviewByQuery } from "@/lib/db/repos/reviews";
import { buildQuerySummaryText } from "@/lib/utils/exportSummary";
import { PrintButton } from "@/components/reports/PrintButton";

export default async function ReportPrintPage({ params }: { params: { id: string } }) {
  const query = await getQueryById(params.id);
  if (!query) notFound();

  const project = query.projectId ? (await getProjects()).find((p) => p.id === query.projectId) ?? null : null;
  // query.userId trae el email cuando la consulta viene de Supabase, o el id
  // local (ej. "u-admin") cuando viene del fallback JSON: se prueban ambos.
  const user = getUserByEmail(query.userId) ?? getUserById(query.userId);
  const review = getReviewByQuery(query.id);

  const summary = buildQuerySummaryText({ query, project, user, review });

  return (
    <div className="space-y-4 text-fly-black bg-white p-6 rounded-xl">
      <div className="no-print">
        <PrintButton />
      </div>
      <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed">{summary}</pre>
    </div>
  );
}
