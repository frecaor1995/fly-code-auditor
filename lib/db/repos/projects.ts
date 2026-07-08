import { v4 as uuid } from "uuid";
import { readCollection, insertRecord, updateRecord, findById } from "../jsonStore";
import type { Project, ProjectStatus } from "../types";

const COLLECTION = "projects";

export function listProjects(): Project[] {
  return readCollection<Project>(COLLECTION).sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
}

export function getProject(id: string): Project | null {
  return findById<Project>(COLLECTION, id);
}

export function createProject(input: {
  name: string;
  client: string;
  address: string;
  createdBy: string;
}): Project {
  const project: Project = {
    id: uuid(),
    name: input.name,
    client: input.client,
    address: input.address,
    createdBy: input.createdBy,
    status: "activo",
    createdAt: new Date().toISOString()
  };
  return insertRecord(COLLECTION, project);
}

export function setProjectStatus(id: string, status: ProjectStatus): Project | null {
  return updateRecord<Project>(COLLECTION, id, { status });
}
