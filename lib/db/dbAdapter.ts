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
import { findBestMatch, type MatchCategory, type ScorableEntry } from "../knowledge/matchEngine";
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
// Regla para lecturas (getProjects/getQueries/getQueryById): siempre se
// degrada a datos locales si Supabase falla o no esta configurado, para no
// tumbar una pagina completa por un error de red. findKnowledgeByQuestion es
// la excepcion: devuelve null en cualquiera de esos casos (el fallback al
// motor mock local vive en app/api/queries/route.ts, no aqui).

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
export function mapRiskLevelToDb(riskLevel: RiskLevel): "low" | "medium" | "high" {
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
export function extractSourceFile(sourceInfo?: string): string | null {
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

// Fila real de public.knowledge_entries (verificado contra la tabla en vivo:
// ver supabase/knowledge_entries_upgrade.sql para las columnas agregadas y
// supabase/knowledge_entries_official_refs_upgrade.sql para las columnas de
// referencias a fuentes oficiales vivas: nec_articles/tdlr_references/
// ahj_references/source_urls/etc). Todas las columnas nuevas son
// opcionales/nullable: filas antiguas sin estos datos siguen funcionando.
interface SupabaseKnowledgeEntryRow {
  id: string;
  category: string;
  title: string | null;
  keywords: string[] | null;
  answer_es: string | null;
  answer_en: string | null;
  code_references: string | null;
  risk_level: string | null;
  source_used: string | null;
  // Categoria obligatoria del motor de score (ver
  // lib/knowledge/matchEngine.ts y supabase/knowledge_entries_match_category_upgrade.sql).
  // Nullable porque filas antiguas pueden no tenerla poblada todavia: esas
  // filas se tratan como categoria neutral sin gate (ver resolveMatchCategory
  // mas abajo), nunca como un match automatico por keyword suelta.
  match_category?: string | null;
  nec_articles?: string[] | null;
  tdlr_references?: string[] | null;
  ahj_references?: string[] | null;
  source_urls?: string[] | null;
  source_last_checked_at?: string | null;
  applies_when?: string | null;
  does_not_apply_when?: string | null;
  field_notes?: string | null;
  verification_steps?: string[] | null;
  official_reference?: string | null;
}

export interface KnowledgeEntryMatch {
  id: string;
  category: string;
  title: string | null;
  keywords: string[];
  answerEs: string;
  answerEn: string;
  codeReferences: string | null;
  riskLevel: RiskLevel;
  sourceUsed: string;
  necArticles: string[];
  tdlrReferences: string[];
  ahjReferences: string[];
  sourceUrls: string[];
  sourceLastCheckedAt: string | null;
  appliesWhen: string | null;
  doesNotApplyWhen: string | null;
  fieldNotes: string | null;
  verificationSteps: string[];
  officialReference: string | null;
}

function mapKnowledgeEntryRow(row: SupabaseKnowledgeEntryRow): KnowledgeEntryMatch {
  return {
    id: row.id,
    category: row.category,
    title: row.title ?? null,
    keywords: Array.isArray(row.keywords) ? row.keywords : [],
    answerEs: row.answer_es ?? "",
    answerEn: row.answer_en ?? "",
    codeReferences: row.code_references ?? null,
    riskLevel: mapRiskLevelFromDb(row.risk_level),
    sourceUsed: row.source_used ?? "Fly Electric Solutions LLC internal knowledge base",
    necArticles: Array.isArray(row.nec_articles) ? row.nec_articles : [],
    tdlrReferences: Array.isArray(row.tdlr_references) ? row.tdlr_references : [],
    ahjReferences: Array.isArray(row.ahj_references) ? row.ahj_references : [],
    sourceUrls: Array.isArray(row.source_urls) ? row.source_urls : [],
    sourceLastCheckedAt: row.source_last_checked_at ?? null,
    appliesWhen: row.applies_when ?? null,
    doesNotApplyWhen: row.does_not_apply_when ?? null,
    fieldNotes: row.field_notes ?? null,
    verificationSteps: Array.isArray(row.verification_steps) ? row.verification_steps : [],
    officialReference: row.official_reference ?? null
  };
}

// Fila real de public.official_sources (ver supabase/official_sources.sql).
interface SupabaseOfficialSourceRow {
  id: string;
  source_name: string;
  source_type: string;
  jurisdiction: string | null;
  official_url: string;
  current_version: string | null;
  last_checked_at: string | null;
  priority: number | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface OfficialSource {
  id: string;
  sourceName: string;
  sourceType: string;
  jurisdiction: string | null;
  officialUrl: string;
  currentVersion: string | null;
  lastCheckedAt: string | null;
  priority: number;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

function mapOfficialSourceRow(row: SupabaseOfficialSourceRow): OfficialSource {
  return {
    id: row.id,
    sourceName: row.source_name,
    sourceType: row.source_type,
    jurisdiction: row.jurisdiction ?? null,
    officialUrl: row.official_url,
    currentVersion: row.current_version ?? null,
    lastCheckedAt: row.last_checked_at ?? null,
    priority: row.priority ?? 10,
    notes: row.notes ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at
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

// --- Knowledge base (electrica, tabla real en Supabase) --------------------

// Categorias validas del motor de score (ver lib/knowledge/matchEngine.ts).
// Cualquier valor de match_category que no este en esta lista (incluyendo
// null/vacio, para filas creadas antes de la migracion) se resuelve a
// "operational_guide": una categoria sin gate especial, para que esas filas
// sigan pudiendo matchear por score sin heredar por accidente el gate de
// otra categoria (ej. el de "healthcare").
const KNOWN_MATCH_CATEGORIES = new Set<MatchCategory>([
  "exterior_wet_locations",
  "healthcare",
  "feeders",
  "services",
  "grounding_bonding",
  "mc_cable",
  "panels",
  "receptacles",
  "ev_charging",
  "tdlr",
  "houston_ahj",
  "lighting",
  "arc_flash_safety",
  "installation_methods",
  "operational_guide"
]);

function resolveMatchCategory(raw: string | null | undefined): MatchCategory {
  if (raw && KNOWN_MATCH_CATEGORIES.has(raw as MatchCategory)) return raw as MatchCategory;
  return "operational_guide";
}

interface ScorableSupabaseRow extends ScorableEntry {
  row: SupabaseKnowledgeEntryRow;
}

// public.knowledge_entries es ahora la base tecnica REAL: app/api/queries/route.ts
// la consulta primero, antes de caer al motor mock local
// (lib/knowledge/electricalKnowledgeBase.ts). Esta funcion NO hace ese
// fallback ella misma -esa decision vive en el caller-: si Supabase no esta
// configurado, no hay filas, ninguna supera el score minimo de confianza
// (ver lib/knowledge/matchEngine.ts: score ponderado, gate de categoria y
// penalizacion por terminos contradictorios; ya NO es un match por una sola
// palabra clave suelta), o la consulta falla, devuelve null y punto.
export async function findKnowledgeByQuestion(question: string): Promise<KnowledgeEntryMatch | null> {
  if (!isSupabaseConfigured()) return null;

  try {
    const supabase = getSupabaseServerClient();
    const { data, error } = await supabase.from("knowledge_entries").select("*");
    if (error) throw error;
    if (!data || data.length === 0) return null;

    const rows = data as SupabaseKnowledgeEntryRow[];
    const scorable: ScorableSupabaseRow[] = rows.map((row) => ({
      id: row.id,
      matchCategory: resolveMatchCategory(row.match_category),
      keywords: Array.isArray(row.keywords) ? row.keywords : [],
      row
    }));

    const best = findBestMatch(question, scorable);
    return best ? mapKnowledgeEntryRow(best.row) : null;
  } catch (error) {
    logSupabaseError("findKnowledgeByQuestion: fallo la busqueda en Supabase.", error);
    return null;
  }
}

export function extractSourceCategory(sourceInfo?: string): string | null {
  if (!sourceInfo) return null;
  const match = sourceInfo.match(/(?:Categoria detectada|Detected category):\s*(.+)/);
  return match ? match[1].trim() : null;
}

// --- Official sources (NEC/NFPA, TDLR, Houston AHJ) ------------------------
//
// public.official_sources es el catalogo vivo de fuentes oficiales externas
// (ver supabase/official_sources.sql): la app nunca copia el texto de esas
// fuentes, solo las cita y enlaza. app/api/queries/route.ts las consulta
// para anexarlas a la respuesta segun el tema detectado (NEC, Texas/
// licencia, Houston/permitting).

// Devuelve el catalogo completo ordenado por prioridad (menor numero =
// mayor prioridad). Se degrada a lista vacia si Supabase no esta
// configurado o la lectura falla, para no tumbar app/api/queries/route.ts
// por un problema de red o de tabla faltante.
export async function getOfficialSources(): Promise<OfficialSource[]> {
  if (!isSupabaseConfigured()) return [];
  try {
    const supabase = getSupabaseServerClient();
    const { data, error } = await supabase
      .from("official_sources")
      .select("*")
      .order("priority", { ascending: true });
    if (error) throw error;
    return (data as SupabaseOfficialSourceRow[]).map(mapOfficialSourceRow);
  } catch (error) {
    logSupabaseError("getOfficialSources: fallo la lectura en Supabase.", error);
    return [];
  }
}

// Filtra el catalogo por source_type (ej. "nec", "tdlr", "houston_ahj"; ver
// los valores insertados por supabase/official_sources.sql). Devuelve un
// arreglo porque mas de una fuente puede compartir el mismo source_type
// (ej. "TDLR Electricians" y "TDLR Electricians Laws and Rules" ambas
// podrian marcarse "tdlr" en el futuro).
export async function findOfficialSourceByType(sourceType: string): Promise<OfficialSource[]> {
  if (!isSupabaseConfigured()) return [];
  try {
    const supabase = getSupabaseServerClient();
    const { data, error } = await supabase
      .from("official_sources")
      .select("*")
      .eq("source_type", sourceType)
      .order("priority", { ascending: true });
    if (error) throw error;
    return (data as SupabaseOfficialSourceRow[]).map(mapOfficialSourceRow);
  } catch (error) {
    logSupabaseError(`findOfficialSourceByType: fallo la lectura en Supabase (source_type=${sourceType}).`, error);
    return [];
  }
}

// Marca una fuente como verificada ahora mismo (last_checked_at = now()).
// Uso: cuando alguien confirma manualmente que la URL/version oficial de
// una fuente sigue siendo correcta. No lanza: un fallo aqui no debe romper
// el flujo de respuesta de una consulta, solo se registra en los logs.
export async function updateSourceLastChecked(sourceName: string): Promise<OfficialSource | null> {
  if (!isSupabaseConfigured()) return null;
  try {
    const supabase = getSupabaseServerClient();
    const { data, error } = await supabase
      .from("official_sources")
      .update({ last_checked_at: new Date().toISOString(), updated_at: new Date().toISOString() })
      .eq("source_name", sourceName)
      .select()
      .single();
    if (error) throw error;
    return mapOfficialSourceRow(data as SupabaseOfficialSourceRow);
  } catch (error) {
    logSupabaseError(`updateSourceLastChecked: fallo la escritura en Supabase (source_name=${sourceName}).`, error);
    return null;
  }
}

// Referencia directa a getProject local: usada por paginas que todavia no
// migran a Supabase (proyectos/[id], planos) y solo necesitan un lookup por
// id sobre datos ya locales. No forma parte de las 8 funciones pedidas.
export { getLocalProject as getProjectByIdLocal };
