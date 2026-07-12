import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { hasPermission } from "@/lib/auth/permissions";
import { getProjects, createProject } from "@/lib/db/dbAdapter";

export async function GET() {
  const user = getCurrentUser();
  if (!user) return NextResponse.json({ error: "No autenticado." }, { status: 401 });
  return NextResponse.json({ projects: await getProjects() });
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

  try {
    const project = await createProject({
      name: body.name,
      client: body.client,
      address: body.address ?? "",
      createdBy: user.id
    });
    return NextResponse.json({ project }, { status: 201 });
  } catch (error) {
    console.error("[api/projects] Error guardando el proyecto:", error);
    return NextResponse.json({ error: "No se pudo guardar el proyecto en la base de datos. Intenta de nuevo." }, { status: 500 });
  }
}
