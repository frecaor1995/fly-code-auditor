import Link from "next/link";
import type { Project } from "@/lib/db/types";

const STATUS_LABEL: Record<Project["status"], string> = {
  activo: "Activo",
  en_revision: "En revision",
  cerrado: "Cerrado"
};

export function ProjectCard({ project }: { project: Project }) {
  return (
    <Link
      href={`/proyectos/${project.id}`}
      className="block rounded-xl border border-fly-gray bg-fly-charcoal p-4 hover:border-fly-gold transition"
    >
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-fly-white">{project.name}</h3>
        <span className="text-xs rounded-full border border-fly-gray px-2 py-0.5 text-fly-lightgray/80">
          {STATUS_LABEL[project.status]}
        </span>
      </div>
      <p className="text-sm text-fly-lightgray/70">{project.client}</p>
      <p className="text-xs text-fly-lightgray/50">{project.address}</p>
    </Link>
  );
}
