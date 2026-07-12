import { isSupabaseConfigured, getSupabaseServerClient } from "./supabaseServer";
import {
  listProjects as listLocalProjects,
  createProject as createLocalProject,
  getProject as getLocalProject
} from "./repos/projects";
import {
  listQueries as listLocalQueries,
  createQuery as createLocalQuery,
  getQuery as getLocalQuery,
  escalateQuery as escalateLocalQuery
} from "./repos/queries";
import { setReviewDecision as setLocalReviewDecision } from "./repos/reviews";
import {
  ELECTRICAL_KNOWLEDGE_BASE,
  findKnowledgeBaseMatch,
  normalizeForMatch,
  type KnowledgeBaseEntry,
  type KnowledgeSourceType
} from "../knowledge/electricalKnowledgeBase";
import type {
  AssistantResponse,
  Language,
  Project,
  ProjectStatus,
  QueryMode,
  QueryRecord,
  ReviewRecord,
  ReviewStatus,
  RiskLevel
} from "./types";

// Adaptador de persistencia: Supabase es la fuente de verdad cuando esta
// configurado (SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY definidas). Si NO
// esta configurado, la app sigue funcionando con los repos JSON locales
// (lib/db/repos/*) exactamente como antes, para no romper el desarrollo
// local ni la demo mientras alguien todavia no crea su proyecto Supabase.
//
// Regla para escrituras (createProject/createQuery/createReview/escalateQuery):
// - Si Supabase ESTA configurado y la escritura falla, el error se propaga
//   al caller (la API route decide como responder). No se hace fallback
//   silencioso a escribir data/*.json: ese era justamente el problema en
//   Vercel (filesystem de solo lectura) que esta migracion busca eliminar.
// - Si Supabase NO esta configurado, se usa el repo JSON local (modo demo).
// La UNICA excepcion es createQuery: la respuesta del asistente (mock/base
// de conocimiento) se genera ANTES y de forma independiente del guardado,
// asi que un fallo al guardar en Supabase nunca debe ocultar la respuesta
// ya generada (ver app/api/queries/route.ts).
//
// Regla para lecturas (getProjects/getQueries/getQueryById/getKnowledgeEntries):
// siempre se degrada a datos locales si Supabase falla o no esta
// configurado, para no tumbar una pagina completa por un error de red.

function mapProjectStatusFromDb(status: string | null): ProjectStatus {
  if (status === "in_review") return "en_revision";
  if (status === "closed") return "cerrado";
  return "activo";
}

function mapProjectStatusToDb(status: ProjectStatus): string {
  if (status === "en_revision") return "in_review";
  if (status === "cerrado") return "closed";
  return "active";
}

interface SupabaseProjectRow {
  id: string;
  name: string;
  client_name: string | null;
  location: string | null;
  status: string | null;
  created_at: string;
}

function mapProjectRow(row: SupabaseProjectRow): Project {
  return {
    id: row.id,
    name: row.name,
    client: row.client_name ?? "",
    // "createdBy" no tiene columna dedicada en el esquema de Supabase (no
    // se muestra en ninguna pantalla hoy); se deja vacio al leer desde ahi.
    createdBy: "",
    address: row.location ?? "",
    status: mapProjectStatusFromDb(row.status),
    createdAt: row.created_at
  };
}

interface SupabaseQueryRow {
  id: string;
  project_id: string | null;
  plan_id: string | null;
  user_email: string | null;
  question: string;
  answer: AssistantResponse;
  language_mode: string | null;
  risk_level: string | null;
  source_category: string | null;
  input_mode: string | null;
  requires_master_review: boolean | null;
  created_at: string;
}

function mapQueryRow(row: SupabaseQueryRow): QueryRecord {
  const riskLevel = (row.risk_level as RiskLevel) ?? "medio";
  return {
    id: row.id,
    projectId: row.project_id,
    planId: row.plan_id,
    userId: row.user_email ?? "",
    mode: (row.input_mode as QueryMode) ?? "texto",
    language: (row.language_mode as Language) ?? "bilingual",
    question: row.question,
    response: row.answer,
    riskLevel,
    requiresMasterReview: Boolean(row.requires_master_review) || riskLevel === "alto" || riskLevel === "critico",
    createdAt: row.created_at
  };
}

interface SupabaseReviewRow {
  id: string;
  query_id: string;
  reviewed_by: string | null;
  status: string;
  comments: string | null;
  created_at: string;
}

function mapReviewRow(row: SupabaseReviewRow): ReviewRecord {
  return {
    id: row.id,
    queryId: row.query_id,
    status: row.status as ReviewStatus,
    comment: row.comments ?? "",
    reviewedBy: row.reviewed_by,
    // El esquema no tiene una columna "reviewed_at" separada; created_at
    // de la fila de review cumple ese rol.
    reviewedAt: row.created_at,
    createdAt: row.created_at
  };
}

interface SupabaseKnowledgeRow {
  id: string;
  category: string;
  keywords: string[];
  code_reference: string | null;
  source_type: string | null;
  content_es: string | null;
  content_en: string | null;
  risk_level: string | null;
  checklist_es: string[] | null;
  checklist_en: string[] | null;
}

function mapKnowledgeRow(row: SupabaseKnowledgeRow): KnowledgeBaseEntry {
  return {
    id: row.id,
    category: row.category,
    keywords: row.keywords ?? [],
    codeReference: row.code_reference ?? "",
    sourceType: (row.source_type as KnowledgeSourceType) ?? "guia_interna_general",
    shortAnswerEs: row.content_es ?? "",
    shortAnswerEn: row.content_en ?? "",
    riskLevel: (row.risk_level as RiskLevel) ?? "medio",
    checklistEs: Array.isArray(row.checklist_es) ? row.checklist_es : [],
    checklistEn: Array.isArray(row.checklist_en) ? row.checklist_en : [],
    // La tabla knowledge_entries (ver supabase/schema.sql) todavia no tiene
    // columnas para estos campos; quedan vacios hasta que se extienda el
    // esquema como parte de la migracion completa de electricalKnowledgeBase.ts.
    missingQuestionsEs: [],
    missingQuestionsEn: [],
    recommendationEs: "",
    recommendationEn: "",
    warningEs: "",
    warningEn: ""
  };
}

// --- Projects ---------------------------------------------------------

export async function getProjects(): Promise<Project[]> {
  if (isSupabaseConfigured()) {
    try {
      const supabase = getSupabaseServerClient();
      const { data, error } = await supabase
        .from("projects")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data as SupabaseProjectRow[]).map(mapProjectRow);
    } catch (error) {
      console.error("[dbAdapter] getProjects: fallo la lectura en Supabase, usando datos locales.", error);
      return listLocalProjects();
    }
  }
  return listLocalProjects();
}

export interface CreateProjectInput {
  name: string;
  client: string;
  address: string;
  createdBy: string;
}

export async function createProject(input: CreateProjectInput): Promise<Project> {
  if (isSupabaseConfigured()) {
    const supabase = getSupabaseServerClient();
    const { data, error } = await supabase
      .from("projects")
      .insert({
        name: input.name,
        client_name: input.client,
        location: input.address,
        status: "active"
      })
      .select()
      .single();
    if (error) {
      console.error("[dbAdapter] createProject: fallo la escritura en Supabase.", error);
      throw error;
    }
    return mapProjectRow(data as SupabaseProjectRow);
  }
  return createLocalProject(input);
}

// --- Queries ------------------------------------------------------------

export async function getQueries(): Promise<QueryRecord[]> {
  if (isSupabaseConfigured()) {
    try {
      const supabase = getSupabaseServerClient();
      const { data, error } = await supabase
        .from("queries")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data as SupabaseQueryRow[]).map(mapQueryRow);
    } catch (error) {
      console.error("[dbAdapter] getQueries: fallo la lectura en Supabase, usando datos locales.", error);
      return listLocalQueries();
    }
  }
  return listLocalQueries();
}

export interface CreateQueryInput {
  projectId: string | null;
  planId: string | null;
  userEmail: string;
  mode: QueryMode;
  language: Language;
  question: string;
  response: AssistantResponse;
  sourceCategory?: string | null;
}

// A diferencia de createProject/createReview, createQuery NUNCA lanza: la
// respuesta del asistente ya se genero de forma independiente (ver
// app/api/queries/route.ts) y siempre debe llegar al usuario. Si Supabase
// falla, se devuelve un QueryRecord "en memoria" (no persistido) con esa
// misma respuesta, y el error queda registrado en los logs del servidor.
export async function createQuery(input: CreateQueryInput): Promise<{ query: QueryRecord; persisted: boolean }> {
  const riskLevel = input.response.riskLevel;
  const requiresMasterReview = riskLevel === "alto" || riskLevel === "critico";

  if (isSupabaseConfigured()) {
    try {
      const supabase = getSupabaseServerClient();
      const { data, error } = await supabase
        .from("queries")
        .insert({
          project_id: input.projectId,
          plan_id: input.planId,
          user_email: input.userEmail,
          question: input.question,
          answer: input.response,
          language_mode: input.language,
          risk_level: riskLevel,
          source_category: input.sourceCategory ?? null,
          input_mode: input.mode,
          requires_master_review: requiresMasterReview
        })
        .select()
        .single();
      if (error) throw error;
      return { query: mapQueryRow(data as SupabaseQueryRow), persisted: true };
    } catch (error) {
      console.error(
        "[dbAdapter] createQuery: fallo el guardado en Supabase; se devuelve la respuesta sin persistir.",
        error
      );
      return {
        query: {
          id: `local-${Date.now()}`,
          projectId: input.projectId,
          planId: input.planId,
          userId: input.userEmail,
          mode: input.mode,
          language: input.language,
          question: input.question,
          response: input.response,
          riskLevel,
          requiresMasterReview,
          createdAt: new Date().toISOString()
        },
        persisted: false
      };
    }
  }

  const query = createLocalQuery({
    projectId: input.projectId,
    planId: input.planId,
    userId: input.userEmail,
    mode: input.mode,
    language: input.language,
    question: input.question,
    response: input.response
  });
  return { query, persisted: true };
}

export async function getQueryById(id: string): Promise<QueryRecord | null> {
  if (isSupabaseConfigured()) {
    try {
      const supabase = getSupabaseServerClient();
      const { data, error } = await supabase.from("queries").select("*").eq("id", id).maybeSingle();
      if (error) throw error;
      return data ? mapQueryRow(data as SupabaseQueryRow) : null;
    } catch (error) {
      console.error("[dbAdapter] getQueryById: fallo la lectura en Supabase, usando datos locales.", error);
      return getLocalQuery(id);
    }
  }
  return getLocalQuery(id);
}

// Extra sobre la lista de funciones pedida: necesaria para que "Escalar al
// Master" siga funcionando sobre consultas guardadas en Supabase (ver
// app/api/queries/[id]/route.ts).
export async function escalateQuery(id: string): Promise<QueryRecord | null> {
  if (isSupabaseConfigured()) {
    try {
      const supabase = getSupabaseServerClient();
      const { data, error } = await supabase
        .from("queries")
        .update({ requires_master_review: true })
        .eq("id", id)
        .select()
        .maybeSingle();
      if (error) throw error;
      return data ? mapQueryRow(data as SupabaseQueryRow) : null;
    } catch (error) {
      console.error("[dbAdapter] escalateQuery: fallo la escritura en Supabase.", error);
      throw error;
    }
  }
  return escalateLocalQuery(id);
}

// --- Reviews --------------------------------------------------------------

export interface CreateReviewInput {
  queryId: string;
  reviewedBy: string;
  status: ReviewStatus;
  comments: string;
}

export async function createReview(input: CreateReviewInput): Promise<ReviewRecord> {
  if (isSupabaseConfigured()) {
    const supabase = getSupabaseServerClient();
    const { data, error } = await supabase
      .from("reviews")
      .insert({
        query_id: input.queryId,
        reviewed_by: input.reviewedBy,
        status: input.status,
        comments: input.comments
      })
      .select()
      .single();
    if (error) {
      console.error("[dbAdapter] createReview: fallo la escritura en Supabase.", error);
      throw error;
    }
    return mapReviewRow(data as SupabaseReviewRow);
  }

  const review = setLocalReviewDecision(input.queryId, {
    status: input.status,
    comment: input.comments,
    reviewedBy: input.reviewedBy
  });
  if (!review) {
    throw new Error(`No se encontro la consulta ${input.queryId} para registrar la revision.`);
  }
  return review;
}

// --- Knowledge base (electrica) --------------------------------------------

// La base local (lib/knowledge/electricalKnowledgeBase.ts) sigue siendo el
// fallback real: knowledge_entries queda preparada en Supabase (ver
// supabase/schema.sql) para una migracion futura, pero mientras este vacia
// (o Supabase no este configurado) estas funciones devuelven la base local.
export async function getKnowledgeEntries(): Promise<KnowledgeBaseEntry[]> {
  if (isSupabaseConfigured()) {
    try {
      const supabase = getSupabaseServerClient();
      const { data, error } = await supabase.from("knowledge_entries").select("*");
      if (error) throw error;
      if (data && data.length > 0) return (data as SupabaseKnowledgeRow[]).map(mapKnowledgeRow);
    } catch (error) {
      console.error("[dbAdapter] getKnowledgeEntries: fallo Supabase, usando base local.", error);
    }
  }
  return ELECTRICAL_KNOWLEDGE_BASE;
}

export async function findKnowledgeByQuestion(question: string): Promise<KnowledgeBaseEntry | undefined> {
  if (isSupabaseConfigured()) {
    try {
      const supabase = getSupabaseServerClient();
      const { data, error } = await supabase.from("knowledge_entries").select("*");
      if (error) throw error;
      if (data && data.length > 0) {
        const normalizedQuestion = normalizeForMatch(question);
        const match = (data as SupabaseKnowledgeRow[])
          .map(mapKnowledgeRow)
          .find((entry) => entry.keywords.some((kw) => normalizedQuestion.includes(normalizeForMatch(kw))));
        if (match) return match;
      }
    } catch (error) {
      console.error("[dbAdapter] findKnowledgeByQuestion: fallo Supabase, usando base local.", error);
    }
  }
  return findKnowledgeBaseMatch(question);
}

export function extractSourceCategory(sourceInfo?: string): string | null {
  if (!sourceInfo) return null;
  const match = sourceInfo.match(/(?:Categoria detectada|Detected category):\s*(.+)/);
  return match ? match[1].trim() : null;
}

// Referencia directa a getProject local: usada por paginas que todavia no
// migran a Supabase (proyectos/[id], planos) y solo necesitan un lookup por
// id sobre datos ya locales. No forma parte de las 8 funciones pedidas.
export { getLocalProject as getProjectByIdLocal };
