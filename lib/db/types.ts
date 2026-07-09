export type Role =
  | "owner_admin"
  | "master_electrician"
  | "tecnico"
  | "ayudante"
  | "oficina";

export type Language = "es" | "en" | "bilingual";

export interface User {
  id: string;
  name: string;
  email: string;
  // DEMO ONLY: texto plano para el MVP local. Migrar a hash + Supabase Auth
  // antes de usar con datos reales o fuera de la red interna.
  password: string;
  role: Role;
  preferredLanguage: Language;
}

export type ProjectStatus = "activo" | "en_revision" | "cerrado";

export interface Project {
  id: string;
  name: string;
  client: string;
  address: string;
  createdBy: string;
  status: ProjectStatus;
  createdAt: string;
}

export type RiskLevel = "bajo" | "medio" | "alto" | "critico";

export interface PlanReadingSummary {
  sheet?: string;
  symbolsVisible: string[];
  equipmentIdentified: string[];
  panelsIdentified: string[];
  circuitsVisible: string[];
  notes: string[];
  missingInfo: string[];
}

export interface AssistantResponse {
  shortAnswer: string;
  englishSummary?: string;
  riskLevel: RiskLevel;
  codeReference: string;
  planReading?: PlanReadingSummary;
  checklist: string[];
  missingQuestions: string[];
  recommendation: string;
  warning: string;
  sourceInfo?: string;
}

export type QueryMode = "texto" | "voz";

export interface QueryRecord {
  id: string;
  projectId: string | null;
  planId: string | null;
  userId: string;
  mode: QueryMode;
  language: Language;
  question: string;
  response: AssistantResponse;
  riskLevel: RiskLevel;
  requiresMasterReview: boolean;
  createdAt: string;
}

export interface PlanRecord {
  id: string;
  projectId: string | null;
  fileName: string;
  fileUrl: string;
  fileType: "pdf" | "image";
  sheet?: string;
  uploadedBy: string;
  analysisSummary?: string;
  createdAt: string;
}

export type ReviewStatus = "pending" | "approved" | "needs_changes";

export interface ReviewRecord {
  id: string;
  queryId: string;
  status: ReviewStatus;
  comment: string;
  reviewedBy: string | null;
  reviewedAt: string | null;
  createdAt: string;
}

export interface KnowledgeEntry {
  id: string;
  category: string;
  title: string;
  body: string;
  updatedAt: string;
}
