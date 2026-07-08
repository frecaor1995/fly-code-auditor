import { notFound } from "next/navigation";
import { getQuery } from "@/lib/db/repos/queries";
import { getProject } from "@/lib/db/repos/projects";
import { getUserById } from "@/lib/db/repos/users";
import { getReviewByQuery } from "@/lib/db/repos/reviews";
import { buildQuerySummaryText } from "@/lib/utils/exportSummary";
import { PrintButton } from "@/components/reports/PrintButton";

export default function ReportPrintPage({ params }: { params: { id: string } }) {
  const query = getQuery(params.id);
  if (!query) notFound();

  const project = query.projectId ? getProject(query.projectId) : null;
  const user = getUserById(query.userId);
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
