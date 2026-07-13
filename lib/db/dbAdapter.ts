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

// Columnas REALES de public.queries en Supabase (confirmadas por el
// usuario): id, project_id, user_email, question, answer, language_mode,
// risk_level, created_at. plan_id / input_mode / requires_master_review /
// source_category NO existen en la tabla real: son opcionales aqui y se
// leen solo si algun dia se agregan esas columnas; hasta entonces siempre
// llegan undefined y se resuelven con los valores por defecto de abajo.
interface SupabaseQueryRow {
  id: string;
  project_id: string | null;
  user_email: string | null;
  question: string;
  answer: string | AssistantResponse;
  language_mode: string | null;
  risk_level: string | null;
  created_at: string;
  plan_id?: string | null;
  input_mode?: string | null;
  requires_master_review?: boolean | null;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Normaliza project_id antes de insertar: cualquier valor vacio, los
// placeholders "general"/"sin proyecto", o cualquier string que no tenga
// forma de UUID, se guarda como null en vez de romper el insert con un
// error de tipo en Postgres.
function normalizeProjectIdForDb(projectId: string | null | undefined): string | null {
  if (!projectId) return null;
  const trimmed = projectId.trim();
  if (!trimmed) return null;
  const lowered = trimmed.toLowerCase();
  if (lowered === "general" || lowered === "sin proyecto" || lowered === "null" || lowered === "undefined") return null;
  return UUID_RE.test(trimmed) ? trimmed : null;
}

// La columna risk_level de Supabase solo admite low/medium/high (confirmado
// por el usuario). "alto" y "critico" del motor mock se guardan ambos como
// "high": el nivel de riesgo real y completo sigue disponible dentro de
// "answer" (la respuesta completa), asi que no se pierde informacion, solo
// se colapsa a 3 niveles para esta columna especifica.
function mapRiskLevelToDb(riskLevel: RiskLevel): "low" | "medium" | "high" {
  if (riskLevel === "bajo") return "low";
  if (riskLevel === "medio") return "medium";
  return "high";
}

function mapRiskLevelFromDb(dbValue: string | null | undefined): RiskLevel {
  if (dbValue === "low") return "bajo";
  if (dbValue === "high") return "alto";
  return "medio";
}

function normalizeLanguageModeForDb(language: Language): "es" | "en" | "bilingual" {
  if (language === "es" || language === "en" || language === "bilingual") return language;
  return "bilingual";
}

// "answer" se guarda como texto (JSON.stringify) porque la columna real es
// text, no jsonb. Al leer, puede venir como string (columna text) o ya
// como objeto (si en algun momento la columna fuera jsonb); se manejan
// ambos casos sin romper el render.
function parseAnswer(raw: string | AssistantResponse | null | undefined): AssistantResponse {
  if (raw && typeof raw === "object") return raw;
  if (typeof raw === "string") {
    try {
      return JSON.parse(raw) as AssistantResponse;
    } catch {
      return {
        shortAnswer: raw,
        riskLevel: "medio",
        codeReference: "",
        checklist: [],
        missingQuestions: [],
        recommendation: "",
        warning: ""
      };
    }
  }
  return {
    shortAnswer: "",
    riskLevel: "medio",
    codeReference: "",
    checklist: [],
    missingQuestions: [],
    recommendation: "",
    warning: ""
  };
}

function mapQueryRow(row: SupabaseQueryRow, overrides?: { planId?: string | null; mode?: QueryMode }): QueryRecord {
  const riskLevel = mapRiskLevelFromDb(row.risk_level);
  return {
    id: row.id,
    projectId: row.project_id,
    // plan_id no existe en la tabla real: se usa el valor conocido en el
    // momento del insert (overrides) si esta disponible; si no, null.
    planId: overrides?.planId ?? row.plan_id ?? null,
    userId: row.user_email ?? "",
    mode: overrides?.mode ?? (row.input_mode as QueryMode) ?? "texto",
    language: (row.language_mode as Language) ?? "bilingual",
    question: row.question,
    response: parseAnswer(row.answer),
    riskLevel,
    requiresMasterReview: Boolean(row.requires_master_review) || riskLevel === "alto",
    createdAt: row.created_at
  };
}

// Registra el detalle real del error de Postgres/PostgREST (code, message,
// details, hint) en vez de volcar el objeto completo, para que los logs de
// Vercel muestren exactamente por que fallo un insert (columna inexistente,
// violacion de check constraint, tipo invalido, etc.).
function logSupabaseError(context: string, error: unknown): void {
  const pgError = error as { code?: string; message?: string; details?: string; hint?: string };
  console.error(`[dbAdapter] ${context}`, {
    code: pgError?.code,
    message: pgError?.message,
    details: pgError?.details,
    hint: pgError?.hint
  });
}

// El esquema real de public.queries ha ido cambiando (columnas agregadas
// entre una revision y otra). En vez de asumir un set fijo de columnas,
// el insert se auto-adapta: intenta con el payload completo (incluyendo
// columnas opcionales como category/source_used/saved_to_db/error_message)
// y, si Supabase responde que alguna columna no existe, reintenta
// automaticamente solo con las 6 columnas base que siempre deben existir
// (project_id, user_email, question, answer, language_mode, risk_level).
function isMissingColumnError(error: { code?: string; message?: string } | null | undefined): boolean {
  if (!error) return false;
  if (error.code === "PGRST204" || error.code === "42703") return true;
  const message = (error.message ?? "").toLowerCase();
  return message.includes("column") && (message.includes("does not exist") || message.includes("could not find"));
}

const CORE_QUERY_COLUMNS = ["project_id", "user_email", "question", "answer", "language_mode", "risk_level"] as const;

function pickCoreQueryColumns(payload: Record<string, unknown>): Record<string, unknown> {
  const core: Record<string, unknown> = {};
  for (const key of CORE_QUERY_COLUMNS) core[key] = payload[key];
  return core;
}

// Extrae la referencia de "Archivo interno" del bloque "Base usada para
// esta respuesta" (ver lib/ai/mockAssistant.ts) para poblar source_used
// con la fuente interna real usada (ej. lib/knowledge/electricalKnowledgeBase.ts).
function extractSourceFile(sourceInfo?: string): string | null {
  if (!sourceInfo) return null;
  const match = sourceInfo.match(/(?:Archivo interno|Internal file):\s*(.+)/);
  return match ? match[1].trim() : null;
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
      logSupabaseError("getProjects: fallo la lectura en Supabase, usando datos locales.", error);
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
      logSupabaseError("createProject: fallo la escritura en Supabase.", error);
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
      return (data as SupabaseQueryRow[]).map((row) => mapQueryRow(row));
    } catch (error) {
      logSupabaseError("getQueries: fallo la lectura en Supabase, usando datos locales.", error);
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
  // Mensaje de un error de generacion "controlado" (ej. askAssistant lanzo
  // una excepcion). Se guarda en error_message; null cuando la respuesta se
  // genero con normalidad.
  errorMessage?: string | null;
}

const DEFAULT_CATEGORY = "general_or_fallback";
const DEFAULT_SOURCE_USED = "lib/ai/mockAssistant.ts (motor de reglas local, sin archivo interno especifico)";

// Ademas de "column does not exist" (42703/PGRST204), tambien se reintenta
// con el set base de columnas ante violaciones de NOT NULL (23502) o de
// check constraints (23514) en las columnas opcionales: la tabla real ha
// ido cambiando de forma, y esto evita que una consulta se quede sin
// guardar solo porque una columna nueva no tiene el valor exacto que esa
// version de la tabla exige.
function isSchemaMismatchError(error: { code?: string; message?: string } | null | undefined): boolean {
  if (!error) return false;
  if (["PGRST204", "42703", "23502", "23514"].includes(error.code ?? "")) return true;
  const message = (error.message ?? "").toLowerCase();
  return message.includes("column") && (message.includes("does not exist") || message.includes("could not find"));
}

// A diferencia de createProject/createReview, createQuery NUNCA lanza: la
// respuesta del asistente ya se genero de forma independiente (ver
// app/api/queries/route.ts) y siempre debe llegar al usuario. Si Supabase
// falla, se devuelve un QueryRecord "en memoria" (no persistido) con esa
// misma respuesta, el error (code/message/details/hint) queda registrado
// en los logs del servidor via logSupabaseError, y tambien se devuelve como
// texto plano en "error" para que la API route lo exponga como saveError.
export async function createQuery(
  input: CreateQueryInput
): Promise<{ query: QueryRecord; persisted: boolean; error: string | null }> {
  const riskLevel = input.response.riskLevel;
  const requiresMasterReview = riskLevel === "alto" || riskLevel === "critico";

  // category y source_used NUNCA se insertan vacios/null: toda consulta
  // (respuesta tecnica, fallback generico, meta-pregunta sobre la fuente,
  // pregunta sin informacion suficiente) debe quedar clasificada con algo,
  // para no romper un posible constraint NOT NULL en esas columnas.
  const category = input.sourceCategory?.trim() ? input.sourceCategory.trim() : DEFAULT_CATEGORY;
  const sourceUsed = extractSourceFile(input.response.sourceInfo) ?? DEFAULT_SOURCE_USED;

  if (isSupabaseConfigured()) {
    try {
      const supabase = getSupabaseServerClient();
      const languageMode = normalizeLanguageModeForDb(input.language);

      // Payload completo: incluye las columnas base (siempre deben existir)
      // mas las columnas opcionales que la tabla "puede tener"
      // (category/source_used/saved_to_db/error_message/language). Todas
      // con valores validos y seguros (nunca undefined/null salvo
      // error_message, que es null solo cuando no hubo error).
      const fullPayload: Record<string, unknown> = {
        project_id: normalizeProjectIdForDb(input.projectId),
        user_email: input.userEmail || null,
        question: input.question,
        answer: JSON.stringify(input.response),
        language_mode: languageMode,
        language: languageMode,
        risk_level: mapRiskLevelToDb(riskLevel),
        category,
        source_used: sourceUsed,
        saved_to_db: true,
        error_message: input.errorMessage ?? null
      };

      let { data, error } = await supabase.from("queries").insert(fullPayload).select().single();

      // Si la tabla no tiene alguna de las columnas opcionales, o alguna
      // quedo con una restriccion (NOT NULL / check) que este payload no
      // cumple, reintenta automaticamente solo con las 6 columnas base que
      // siempre deben existir, en vez de fallar el guardado completo.
      if (error && isSchemaMismatchError(error)) {
        logSupabaseError(
          "createQuery: la tabla no acepto el payload completo; reintentando con el set base.",
          error
        );
        ({ data, error } = await supabase
          .from("queries")
          .insert(pickCoreQueryColumns(fullPayload))
          .select()
          .single());
      }

      if (error) throw error;
      return {
        query: mapQueryRow(data as SupabaseQueryRow, { planId: input.planId, mode: input.mode }),
        persisted: true,
        error: null
      };
    } catch (error) {
      logSupabaseError("createQuery: fallo el guardado en Supabase; se devuelve la respuesta sin persistir.", error);
      const pgError = error as { message?: string };
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
        persisted: false,
        error: pgError?.message ?? "Error desconocido guardando en Supabase."
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
  return { query, persisted: true, error: null };
}

export async function getQueryById(id: string): Promise<QueryRecord | null> {
  if (isSupabaseConfigured()) {
    try {
      const supabase = getSupabaseServerClient();
      const { data, error } = await supabase.from("queries").select("*").eq("id", id).maybeSingle();
      if (error) throw error;
      return data ? mapQueryRow(data as SupabaseQueryRow) : null;
    } catch (error) {
      logSupabaseError("getQueryById: fallo la lectura en Supabase, usando datos locales.", error);
      return getLocalQuery(id);
    }
  }
  return getLocalQuery(id);
}

// Extra sobre la lista de funciones pedida: necesaria para que "Escalar al
// Master" siga funcionando sobre consultas guardadas en Supabase (ver
// app/api/queries/[id]/route.ts).
//
// La tabla real public.queries NO tiene columna requires_master_review
// (confirmado por el usuario), asi que no hay donde persistir un escalado
// manual independiente del risk_level. En vez de intentar un UPDATE que
// fallaria siempre con "column does not exist", se devuelve la consulta
// tal cual esta: si su risk_level es "alto" ya aparece marcada para
// revision del Master (mapQueryRow la deriva del risk_level); si no, el
// escalado manual no puede persistir hasta que se agregue esa columna.
export async function escalateQuery(id: string): Promise<QueryRecord | null> {
  if (isSupabaseConfigured()) {
    const query = await getQueryById(id);
    if (query) {
      console.error(
        `[dbAdapter] escalateQuery: la tabla queries no tiene columna requires_master_review; el escalado manual de ${id} no se pudo persistir en Supabase.`
      );
    }
    return query;
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
      logSupabaseError("createReview: fallo la escritura en Supabase.", error);
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
      logSupabaseError("getKnowledgeEntries: fallo Supabase, usando base local.", error);
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
      logSupabaseError("findKnowledgeByQuestion: fallo Supabase, usando base local.", error);
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
