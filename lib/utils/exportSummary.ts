import type { QueryRecord, Project, User, ReviewRecord } from "../db/types";
import { formatDateTime } from "./dates";

export function buildQuerySummaryText(input: {
  query: QueryRecord;
  project: Project | null;
  user: User | null;
  review: ReviewRecord | null;
}): string {
  const { query, project, user, review } = input;
  const r = query.response;
  const lines: string[] = [];

  lines.push("FLY ELECTRIC SOLUTIONS LLC - Fly Code Auditor");
  lines.push("Resumen de consulta tecnica (revision preliminar)");
  lines.push("================================================");
  lines.push(`Fecha: ${formatDateTime(query.createdAt)}`);
  lines.push(`Usuario: ${user?.name ?? "N/A"}`);
  lines.push(`Proyecto: ${project ? `${project.name} (${project.client})` : "Sin proyecto"}`);
  lines.push(`Modo de consulta: ${query.mode} | Idioma: ${query.language}`);
  lines.push("");
  lines.push(`Pregunta: ${query.question}`);
  lines.push("");
  lines.push(`1. Respuesta corta: ${r.shortAnswer}`);
  if (r.englishSummary) lines.push(`2. English summary: ${r.englishSummary}`);
  lines.push(`3. Nivel de riesgo: ${r.riskLevel.toUpperCase()}`);
  lines.push(`4. Codigo o norma relacionada: ${r.codeReference}`);

  if (r.planReading) {
    lines.push("5. Lectura del plano:");
    if (r.planReading.sheet) lines.push(`   - Hoja: ${r.planReading.sheet}`);
    lines.push(`   - Simbolos visibles: ${r.planReading.symbolsVisible.join(", ") || "N/A"}`);
    lines.push(`   - Equipos identificados: ${r.planReading.equipmentIdentified.join(", ") || "N/A"}`);
    lines.push(`   - Paneles identificados: ${r.planReading.panelsIdentified.join(", ") || "N/A"}`);
    lines.push(`   - Circuitos visibles: ${r.planReading.circuitsVisible.join(", ") || "N/A"}`);
    lines.push(`   - Notas relevantes: ${r.planReading.notes.join(", ") || "N/A"}`);
    lines.push(`   - Informacion faltante: ${r.planReading.missingInfo.join(", ") || "N/A"}`);
  }

  lines.push("6. Checklist de revision:");
  r.checklist.forEach((item) => lines.push(`   [ ] ${item}`));

  if (r.missingQuestions.length > 0) {
    lines.push("7. Preguntas faltantes:");
    r.missingQuestions.forEach((q) => lines.push(`   - ${q}`));
  }

  lines.push(`8. Recomendacion: ${r.recommendation}`);
  lines.push(`9. Advertencia: ${r.warning}`);
  lines.push("");
  lines.push(`Requiere revision del Master: ${query.requiresMasterReview ? "SI" : "No"}`);
  if (review) {
    lines.push(
      `Estado de revision del Master: ${review.status}${
        review.comment ? ` - Comentario: ${review.comment}` : ""
      }`
    );
  }

  return lines.join("\n");
}
