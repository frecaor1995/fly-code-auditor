import { v4 as uuid } from "uuid";
import { readCollection, insertRecord, updateRecord } from "../jsonStore";
import type { ReviewRecord, ReviewStatus } from "../types";

const COLLECTION = "reviews";

export function listReviews(): ReviewRecord[] {
  return readCollection<ReviewRecord>(COLLECTION);
}

export function getReviewByQuery(queryId: string): ReviewRecord | null {
  return listReviews().find((r) => r.queryId === queryId) ?? null;
}

export function ensureReview(queryId: string): ReviewRecord {
  const existing = getReviewByQuery(queryId);
  if (existing) return existing;
  const record: ReviewRecord = {
    id: uuid(),
    queryId,
    status: "pending",
    comment: "",
    reviewedBy: null,
    reviewedAt: null,
    createdAt: new Date().toISOString()
  };
  return insertRecord(COLLECTION, record);
}

export function setReviewDecision(
  queryId: string,
  input: { status: ReviewStatus; comment: string; reviewedBy: string }
): ReviewRecord | null {
  const review = ensureReview(queryId);
  return updateRecord<ReviewRecord>(COLLECTION, review.id, {
    status: input.status,
    comment: input.comment,
    reviewedBy: input.reviewedBy,
    reviewedAt: new Date().toISOString()
  });
}
