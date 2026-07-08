import { v4 as uuid } from "uuid";
import { readCollection, insertRecord, updateRecord, findById } from "../jsonStore";
import type { PlanRecord } from "../types";

const COLLECTION = "plans";

export function listPlans(): PlanRecord[] {
  return readCollection<PlanRecord>(COLLECTION).sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
}

export function listPlansByProject(projectId: string): PlanRecord[] {
  return listPlans().filter((p) => p.projectId === projectId);
}

export function getPlan(id: string): PlanRecord | null {
  return findById<PlanRecord>(COLLECTION, id);
}

export function createPlan(input: {
  projectId: string | null;
  fileName: string;
  fileUrl: string;
  fileType: "pdf" | "image";
  sheet?: string;
  uploadedBy: string;
}): PlanRecord {
  const record: PlanRecord = {
    id: uuid(),
    projectId: input.projectId,
    fileName: input.fileName,
    fileUrl: input.fileUrl,
    fileType: input.fileType,
    sheet: input.sheet,
    uploadedBy: input.uploadedBy,
    createdAt: new Date().toISOString()
  };
  return insertRecord(COLLECTION, record);
}

export function setPlanAnalysisSummary(id: string, summary: string): PlanRecord | null {
  return updateRecord<PlanRecord>(COLLECTION, id, { analysisSummary: summary });
}
