export const dictionary = {
  appName: { es: "Fly Code Auditor", en: "Fly Code Auditor" },
  nav_dashboard: { es: "Dashboard", en: "Dashboard" },
  nav_newQuery: { es: "Nueva consulta", en: "New query" },
  nav_plans: { es: "Planos", en: "Plans" },
  nav_history: { es: "Historial", en: "History" },
  nav_projects: { es: "Proyectos", en: "Projects" },
  nav_masterReview: { es: "Revision del Master", en: "Master Review" },
  nav_reports: { es: "Reportes", en: "Reports" },
  nav_settings: { es: "Configuracion", en: "Settings" },
  nav_knowledgeBase: { es: "Base de conocimiento", en: "Knowledge Base" },
  nav_logout: { es: "Cerrar sesion", en: "Log out" },
  login_title: { es: "Iniciar sesion", en: "Sign in" },
  login_subtitle: {
    es: "Asistente tecnico interno de Fly Electric Solutions LLC",
    en: "Internal technical assistant for Fly Electric Solutions LLC"
  },
  login_email: { es: "Correo", en: "Email" },
  login_password: { es: "Contrasena", en: "Password" },
  login_submit: { es: "Entrar", en: "Sign in" },
  login_error: { es: "Correo o contrasena incorrectos.", en: "Incorrect email or password." },
  query_textTab: { es: "Texto", en: "Text" },
  query_voiceTab: { es: "Voz", en: "Voice" },
  query_placeholder: {
    es: "Ej: Puedo instalar un EV charger de 48A con breaker de 60A?",
    en: "Ex: Can I install a 48A EV charger with a 60A breaker?"
  },
  query_submit: { es: "Preguntar", en: "Ask" },
  query_project: { es: "Proyecto", en: "Project" },
  query_none: { es: "Sin proyecto (consulta general)", en: "No project (general query)" },
  query_recordStart: { es: "Presiona para hablar", en: "Tap to speak" },
  query_recordStop: { es: "Grabando... presiona para detener", en: "Recording... tap to stop" },
  voice_unavailable: {
    es: "La voz no esta disponible en este navegador. Use consulta escrita o active integracion Whisper.",
    en: "Voice is not available in this browser. Please use the written query or enable Whisper integration."
  },
  voice_micError: {
    es: "No se pudo acceder al microfono. Use consulta escrita o active integracion Whisper.",
    en: "Could not access the microphone. Please use the written query or enable Whisper integration."
  },
  voice_useText: { es: "Escribir mi consulta", en: "Write my query" },
  response_shortAnswer: { es: "Respuesta corta", en: "Short answer" },
  response_englishSummary: { es: "English summary", en: "English summary" },
  response_riskLevel: { es: "Nivel de riesgo", en: "Risk level" },
  response_codeReference: { es: "Codigo o norma relacionada", en: "Related code/standard" },
  response_planReading: { es: "Lectura del plano", en: "Plan reading" },
  response_checklist: { es: "Checklist de revision", en: "Review checklist" },
  response_missingQuestions: { es: "Preguntas faltantes", en: "Missing questions" },
  response_recommendation: { es: "Recomendacion", en: "Recommendation" },
  response_warning: { es: "Advertencia", en: "Warning" },
  action_escalate: { es: "Escalar al Master", en: "Escalate to Master" },
  action_escalated: { es: "Escalado al Master", en: "Escalated to Master" },
  action_saveProject: { es: "Guardar en proyecto", en: "Save to project" },
  action_generateReport: { es: "Generar reporte", en: "Generate report" },
  action_uploadPlan: { es: "Subir plano", en: "Upload plan" },
  action_analyzePlan: { es: "Analizar plano", en: "Analyze plan" },
  risk_bajo: { es: "Bajo", en: "Low" },
  risk_medio: { es: "Medio", en: "Medium" },
  risk_alto: { es: "Alto", en: "High" },
  risk_critico: { es: "Critico", en: "Critical" },
  lang_es: { es: "Espanol", en: "Spanish" },
  lang_en: { es: "Ingles", en: "English" },
  lang_bilingual: { es: "Bilingue", en: "Bilingual" }
} as const;

export type DictionaryKey = keyof typeof dictionary;
export type UiLanguage = "es" | "en";

export function t(lang: UiLanguage, key: DictionaryKey): string {
  return dictionary[key][lang];
}
