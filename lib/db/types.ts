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
  // Sprint 2 (correccion de wiring): desglose tecnico opcional, separado de
  // shortAnswer, no concatenado. Ausente (undefined) en toda respuesta que
  // no lo provea explicitamente (las 21 entradas de electricalKnowledgeBase.ts
  // anteriores a Sprint 2, el motor OpenAI/Gemini, las categorias legacy,
  // etc.): el componente no debe renderizar una seccion vacia en esos casos.
  explanation?: string;
  riskLevel: RiskLevel;
  codeReference: string;
  planReading?: PlanReadingSummary;
  checklist: string[];
  // Sprint 2: errores comunes de campo, lista separada del checklist (el
  // checklist son pasos de verificacion; esto son advertencias sobre
  // practicas incorrectas frecuentes). Opcional, mismo criterio que
  // explanation arriba.
  commonMistakes?: string[];
  missingQuestions: string[];
  recommendation: string;
  warning: string;
  sourceInfo?: string;
  // Campos del flujo de fuentes oficiales vivas (NEC/NFPA, TDLR, Houston
  // AHJ): opcionales porque las respuestas legacy (motor mock sin match de
  // official_sources) no los llenan. Cuando estan presentes, corresponden a
  // las secciones 3, 4, 5 y 8 del formato pedido para app/api/queries/route.ts.
  officialSourceNote?: string; // 3. Fuente oficial consultada o recomendada
  practicalApplication?: string; // 4. Aplicacion practica
  doNotAssume?: string; // 5. Cuando no asumir
  finalVerification?: string; // 8. Verificacion final (NEC oficial, TDLR, AHJ, Master Electrician)
  // true SOLO cuando ninguna entrada de conocimiento (local o Supabase)
  // supero el score minimo de confianza del motor de matching (ver
  // lib/knowledge/matchEngine.ts) y el proveedor de IA tampoco genero una
  // respuesta: shortAnswer es el mensaje fijo "no fue posible generar una
  // respuesta tecnica respaldada", nunca contenido tecnico real. Usado por
  // app/api/queries/route.ts y el frontend para mostrar este caso como
  // "sin informacion verificable" en vez de como una respuesta tecnica.
  unverified?: boolean;
  // Metadatos de trazabilidad de proveedor (deben mostrarse en toda
  // respuesta visible, ver components/assistant/AssistantResponseCard.tsx).
  // Se completan en app/api/queries/route.ts justo antes de guardar/
  // devolver la respuesta, para que queden persistidos y visibles tambien
  // en el historial, no solo en la consulta en vivo.
  //
  // Los tres campos de proveedor son DELIBERADAMENTE distintos entre si
  // (bug corregido: antes un solo campo "provider" mostraba "Gemini" como
  // si hubiera respondido, aunque hubiera fallado y el texto real viniera
  // del motor local):
  //   - selectedProvider: valor de AI_PROVIDER (que proveedor esta
  //     configurado, exista o no una llamada real).
  //   - attemptedProvider: a que proveedor se le hizo la llamada real
  //     ("none" si nunca se llamo a ningun proveedor, ej. cuando
  //     knowledge_entries de Supabase ya respondio directo).
  //   - actualProvider: quien PRODUJO EL TEXTO que se esta mostrando. Si
  //     attemptedProvider fallo, actualProvider NUNCA repite ese proveedor:
  //     pasa a "local_validated_fallback" (el motor local generó el texto)
  //     o "supabase_knowledge_entries" (cuando el texto vino directo de
  //     esa tabla, sin pasar por ningun proveedor de IA).
  selectedProvider?: "gemini" | "openai" | "mock";
  attemptedProvider?: "gemini" | "openai" | "mock" | "none";
  actualProvider?: "gemini" | "openai" | "mock" | "local_validated_fallback" | "supabase_knowledge_entries";
  providerModel?: string | null;
  // true cuando attemptedProvider fallo y el texto vino del fallback local.
  // providerErrorCode es el codigo sanitizado del fallo (nunca el mensaje
  // completo ni la clave): "Motivo del fallback" en la tarjeta lo muestra
  // tal cual (ej. "rate_limit_or_quota", "model_not_found", "timeout").
  providerFallback?: boolean;
  providerErrorCode?: string | null;
  answerKind?: "backed" | "validated_fallback" | "unverified";
  internalSourceUsed?: string;
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
