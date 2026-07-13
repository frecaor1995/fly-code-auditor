"use client";

import type { AssistantResponse } from "@/lib/db/types";
import { RiskBadge } from "@/components/ui/RiskBadge";
import { speakText } from "./VoiceRecorder";
import type { ReactNode } from "react";

interface Props {
  response: AssistantResponse;
  uiLang: "es" | "en";
  actions?: ReactNode;
}

const LABELS = {
  es: {
    shortAnswer: "1. Respuesta corta",
    englishSummary: "2. English summary",
    riskLevel: "3. Nivel de riesgo",
    codeReference: "4. Codigo o norma relacionada",
    planReading: "5. Lectura del plano",
    checklist: "6. Checklist de revision",
    missingQuestions: "7. Preguntas faltantes",
    recommendation: "8. Recomendacion",
    warning: "9. Advertencia",
    sourceInfo: "10. Base usada para esta respuesta",
    listen: "Escuchar",
    sheet: "Hoja",
    symbols: "Simbolos visibles",
    equipment: "Equipos identificados",
    panels: "Paneles identificados",
    circuits: "Circuitos visibles",
    notes: "Notas relevantes",
    missingInfo: "Informacion faltante"
  },
  en: {
    shortAnswer: "1. Short answer",
    englishSummary: "2. English summary",
    riskLevel: "3. Risk level",
    codeReference: "4. Related code/standard",
    planReading: "5. Plan reading",
    checklist: "6. Review checklist",
    missingQuestions: "7. Missing questions",
    recommendation: "8. Recommendation",
    warning: "9. Warning",
    sourceInfo: "10. Source used for this response",
    listen: "Listen",
    sheet: "Sheet",
    symbols: "Visible symbols",
    equipment: "Identified equipment",
    panels: "Identified panels",
    circuits: "Visible circuits",
    notes: "Relevant notes",
    missingInfo: "Missing information"
  }
} as const;

export function AssistantResponseCard({ response, uiLang, actions }: Props) {
  const L = LABELS[uiLang];

  return (
    <div className="rounded-2xl border border-fly-gray bg-fly-charcoal p-5 space-y-4">
      <section>
        <div className="flex items-center justify-between gap-2 mb-1">
          <h3 className="text-fly-gold font-bold text-sm uppercase tracking-wide">{L.shortAnswer}</h3>
          <button
            type="button"
            onClick={() => speakText(response.shortAnswer, uiLang === "en" ? "en-US" : "es-US")}
            className="text-xs text-fly-lightgray/70 hover:text-fly-gold underline"
          >
            🔊 {L.listen}
          </button>
        </div>
        <p className="text-base leading-relaxed whitespace-pre-line">{response.shortAnswer}</p>
      </section>

      {response.englishSummary && (
        <section>
          <h3 className="text-fly-gold font-bold text-sm uppercase tracking-wide mb-1">{L.englishSummary}</h3>
          <p className="text-base leading-relaxed text-fly-lightgray">{response.englishSummary}</p>
        </section>
      )}

      <section className="flex items-center gap-3">
        <h3 className="text-fly-gold font-bold text-sm uppercase tracking-wide">{L.riskLevel}</h3>
        <RiskBadge risk={response.riskLevel} lang={uiLang} />
      </section>

      <section>
        <h3 className="text-fly-gold font-bold text-sm uppercase tracking-wide mb-1">{L.codeReference}</h3>
        <p className="text-sm text-fly-lightgray">{response.codeReference}</p>
      </section>

      {response.planReading && (
        <section className="border border-fly-gray/60 rounded-xl p-3 space-y-1">
          <h3 className="text-fly-gold font-bold text-sm uppercase tracking-wide mb-1">{L.planReading}</h3>
          {response.planReading.sheet && (
            <p className="text-sm">
              <span className="text-fly-lightgray/70">{L.sheet}: </span>
              {response.planReading.sheet}
            </p>
          )}
          <PlanReadingList label={L.symbols} items={response.planReading.symbolsVisible} />
          <PlanReadingList label={L.equipment} items={response.planReading.equipmentIdentified} />
          <PlanReadingList label={L.panels} items={response.planReading.panelsIdentified} />
          <PlanReadingList label={L.circuits} items={response.planReading.circuitsVisible} />
          <PlanReadingList label={L.notes} items={response.planReading.notes} />
          <PlanReadingList label={L.missingInfo} items={response.planReading.missingInfo} />
        </section>
      )}

      <section>
        <h3 className="text-fly-gold font-bold text-sm uppercase tracking-wide mb-1">{L.checklist}</h3>
        <ul className="space-y-1">
          {response.checklist.map((item, idx) => (
            <li key={idx} className="flex gap-2 text-sm">
              <input type="checkbox" className="mt-1" />
              <span>{item}</span>
            </li>
          ))}
        </ul>
      </section>

      {response.missingQuestions.length > 0 && (
        <section>
          <h3 className="text-fly-gold font-bold text-sm uppercase tracking-wide mb-1">{L.missingQuestions}</h3>
          <ul className="list-disc list-inside text-sm space-y-1 text-fly-lightgray">
            {response.missingQuestions.map((q, idx) => (
              <li key={idx}>{q}</li>
            ))}
          </ul>
        </section>
      )}

      <section>
        <h3 className="text-fly-gold font-bold text-sm uppercase tracking-wide mb-1">{L.recommendation}</h3>
        <p className="text-sm">{response.recommendation}</p>
      </section>

      <section className="bg-fly-black/60 border border-fly-gold/50 rounded-xl p-3">
        <h3 className="text-fly-gold font-bold text-sm uppercase tracking-wide mb-1">{L.warning}</h3>
        <p className="text-xs text-fly-lightgray whitespace-pre-line">{response.warning}</p>
      </section>

      {response.sourceInfo && (
        <section className="border border-fly-gray/60 rounded-xl p-3">
          <h3 className="text-fly-gold font-bold text-sm uppercase tracking-wide mb-1">{L.sourceInfo}</h3>
          <p className="text-xs text-fly-lightgray whitespace-pre-line">{response.sourceInfo}</p>
        </section>
      )}

      {actions && <div className="flex flex-col gap-2 pt-2">{actions}</div>}
    </div>
  );
}

function PlanReadingList({ label, items }: { label: string; items: string[] }) {
  if (items.length === 0) return null;
  return (
    <p className="text-sm">
      <span className="text-fly-lightgray/70">{label}: </span>
      {items.join(", ")}
    </p>
  );
}
