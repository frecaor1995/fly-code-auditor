import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { getProject } from "@/lib/db/repos/projects";
import { listQueriesByProject } from "@/lib/db/repos/queries";
import { listPlansByProject } from "@/lib/db/repos/plans";

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const user = getCurrentUser();
  if (!user) return NextResponse.json({ error: "No autenticado." }, { status: 401 });

  const project = getProject(params.id);
  if (!project) return NextResponse.json({ error: "Proyecto no encontrado." }, { status: 404 });

  return NextResponse.json({
    project,
    queries: listQueriesByProject(project.id),
    plans: listPlansByProject(project.id)
  });
}
