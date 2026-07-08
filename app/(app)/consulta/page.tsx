import { listProjects } from "@/lib/db/repos/projects";
import { ConsultaClient } from "@/components/query/ConsultaClient";

export default function ConsultaPage() {
  const projects = listProjects();
  return <ConsultaClient projects={projects} />;
}
