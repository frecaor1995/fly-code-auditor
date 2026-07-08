import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { hasPermission } from "@/lib/auth/permissions";
import { listProjects, createProject } from "@/lib/db/repos/projects";

export async function GET() {
  const user = getCurrentUser();
  if (!user) return NextResponse.json({ error: "No autenticado." }, { status: 401 });
  return NextResponse.json({ projects: listProjects() });
}

export async function POST(req: NextRequest) {
  const user = getCurrentUser();
  if (!user) return NextResponse.json({ error: "No autenticado." }, { status: 401 });
  if (!hasPermission(user.role, "project.create")) {
    return NextResponse.json({ error: "No tienes permiso para crear proyectos." }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  if (!body?.name || !body?.client) {
    return NextResponse.json({ error: "Nombre y cliente son requeridos." }, { status: 400 });
  }

  const project = createProject({
    name: body.name,
    client: body.client,
    address: body.address ?? "",
    createdBy: user.id
  });

  return NextResponse.json({ project }, { status: 201 });
}
