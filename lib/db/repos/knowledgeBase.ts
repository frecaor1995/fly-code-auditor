import { readCollection } from "../jsonStore";
import type { KnowledgeEntry } from "../types";

const COLLECTION = "knowledgeBase";

export function listKnowledgeEntries(): KnowledgeEntry[] {
  return readCollection<KnowledgeEntry>(COLLECTION);
}

export function searchKnowledgeEntries(keyword: string): KnowledgeEntry[] {
  const term = keyword.toLowerCase();
  return listKnowledgeEntries().filter(
    (entry) =>
      entry.title.toLowerCase().includes(term) ||
      entry.body.toLowerCase().includes(term) ||
      entry.category.toLowerCase().includes(term)
  );
}
