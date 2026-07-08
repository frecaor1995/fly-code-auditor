import { listProjects } from "@/lib/db/repos/projects";
import { ProjectCard } from "@/components/projects/ProjectCard";
import { NewProjectForm } from "@/components/projects/NewProjectForm";

export default function ProyectosPage() {
  const projects = listProjects();
  return (
    <div className="space-y-6">
      <h1 className="text-xl font-bold text-fly-gold">Proyectos</h1>
      <NewProjectForm />
      <div className="space-y-2">
        {projects.length === 0 && <p className="text-sm text-fly-lightgray/60">Aun no hay proyectos.</p>}
        {projects.map((p) => (
          <ProjectCard key={p.id} project={p} />
        ))}
      </div>
    </div>
  );
}
