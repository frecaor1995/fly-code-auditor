import type { Role } from "../db/types";

export type Permission =
  | "query.create"
  | "query.escalate"
  | "plan.upload"
  | "plan.analyze"
  | "project.create"
  | "review.decide"
  | "knowledge.edit"
  | "report.generate";

const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  owner_admin: [
    "query.create",
    "query.escalate",
    "plan.upload",
    "plan.analyze",
    "project.create",
    "review.decide",
    "knowledge.edit",
    "report.generate"
  ],
  master_electrician: [
    "query.create",
    "query.escalate",
    "plan.upload",
    "plan.analyze",
    "project.create",
    "review.decide",
    "knowledge.edit",
    "report.generate"
  ],
  tecnico: [
    "query.create",
    "query.escalate",
    "plan.upload",
    "plan.analyze",
    "project.create",
    "report.generate"
  ],
  ayudante: ["query.create", "plan.upload", "plan.analyze"],
  oficina: ["query.create", "project.create", "report.generate"]
};

export function hasPermission(role: Role, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role]?.includes(permission) ?? false;
}

export const ROLE_LABELS: Record<Role, { es: string; en: string }> = {
  owner_admin: { es: "Owner / Admin", en: "Owner / Admin" },
  master_electrician: { es: "Master Electrician", en: "Master Electrician" },
  tecnico: { es: "Tecnico", en: "Technician" },
  ayudante: { es: "Ayudante", en: "Helper" },
  oficina: { es: "Oficina / Administrativo", en: "Office / Admin Staff" }
};
