import { getProjects } from "@/lib/db/dbAdapter";
import { ConsultaClient } from "@/components/query/ConsultaClient";

export default async function ConsultaPage() {
  const projects = await getProjects();
  return <ConsultaClient projects={projects} />;
}
