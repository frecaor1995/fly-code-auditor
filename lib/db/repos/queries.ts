import { v4 as uuid } from "uuid";
import { readCollection, insertRecord, updateRecord, findById } from "../jsonStore";
import type { AssistantResponse, Language, QueryMode, QueryRecord } from "../types";

const COLLECTION = "queries";

export function listQueries(): QueryRecord[] {
  return readCollection<QueryRecord>(COLLECTION).sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
}

export function listQueriesByProject(projectId: string): QueryRecord[] {
  return listQueries().filter((q) => q.projectId === projectId);
}

export function listQueriesRequiringReview(): QueryRecord[] {
  return listQueries().filter((q) => q.requiresMasterReview);
}

export function getQuery(id: string): QueryRecord | null {
  return findById<QueryRecord>(COLLECTION, id);
}

export function createQuery(input: {
  projectId: string | null;
  planId: string | null;
  userId: string;
  mode: QueryMode;
  language: Language;
  question: string;
  response: AssistantResponse;
}): QueryRecord {
  const riskLevel = input.response.riskLevel;
  const forcedReview = riskLevel === "alto" || riskLevel === "critico";
  const record: QueryRecord = {
    id: uuid(),
    projectId: input.projectId,
    planId: input.planId,
    userId: input.userId,
    mode: input.mode,
    language: input.language,
    question: input.question,
    response: input.response,
    riskLevel,
    requiresMasterReview: forcedReview,
    createdAt: new Date().toISOString()
  };
  return insertRecord(COLLECTION, record);
}

export function escalateQuery(id: string): QueryRecord | null {
  return updateRecord<QueryRecord>(COLLECTION, id, { requiresMasterReview: true });
}
