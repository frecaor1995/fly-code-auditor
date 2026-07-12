"use client";

import { useState } from "react";
import type { PlanRecord, QueryRecord } from "@/lib/db/types";
import { BigActionButton } from "@/components/ui/BigActionButton";
import { AssistantResponseCard } from "@/components/assistant/AssistantResponseCard";
import { useLanguage } from "@/lib/i18n/useLanguage";

const SUGGESTED_QUESTIONS = [
  "Resume este plano electrico.",
  "Que paneles aparecen en este plano?",
  "Donde estan los receptaculos GFCI?",
  "Que notas generales debo revisar?",
  "Que informacion falta para cotizar?",
  "Hazme un checklist de instalacion basado en este plano.",
  "Identifica riesgos o puntos que requieren revision del Master.",
  "Busca si hay EV charger, disconnect, transformer o subpanel."
];

export function PlanViewer({ plan, initialQueries }: { plan: PlanRecord; initialQueries: QueryRecord[] }) {
  const { mode, t, uiLang } = useLanguage();
  const [question, setQuestion] = useState("");
  const [loading, setLoading] = useState(false);
  const [queries, setQueries] = useState<QueryRecord[]>(initialQueries);
  const [error, setError] = useState<string | null>(null);
  const [saveWarning, setSaveWarning] = useState<string | null>(null);

  async function askAboutPlan(q: string) {
    if (!q.trim()) return;
    setLoading(true);
    setError(null);
    setSaveWarning(null);
    try {
      const res = await fetch(`/api/plans/${plan.id}/analyze`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: q, language: mode })
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data) {
        setError(
          data?.error ??
            (uiLang === "en"
              ? "Something went wrong analyzing the plan. Please try again."
              : "Ocurrio un problema al analizar el plano. Intenta de nuevo.")
        );
        return;
      }
      setQueries((prev) => [data.query, ...prev]);
      setQuestion("");
      if (data.persisted === false) {
        setSaveWarning(
          uiLang === "en"
            ? "The response was generated, but it could not be saved to the database."
            : "La respuesta fue generada, pero no pudo guardarse en la base de datos."
        );
      }
    } catch {
      setError(
        uiLang === "en"
          ? "Could not reach the server. Check your connection and try again."
          : "No se pudo conectar con el servidor. Verifica tu conexion e intenta de nuevo."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="grid md:grid-cols-2 gap-4">
      <div className="space-y-3">
        <div className="rounded-2xl border border-fly-gray bg-fly-charcoal p-2 min-h-[16rem] flex items-center justify-center">
          {plan.fileType === "image" ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={plan.fileUrl} alt={plan.fileName} className="max-h-[28rem] w-auto rounded-lg" />
          ) : (
            <iframe src={plan.fileUrl} title={plan.fileName} className="w-full h-[28rem] rounded-lg bg-white" />
          )}
        </div>
        <p className="text-xs text-fly-lightgray/60">
          {plan.fileName} {plan.sheet ? `· ${plan.sheet}` : ""}
        </p>

        <div className="rounded-2xl border border-fly-gray bg-fly-charcoal p-4 space-y-2">
          <p className="text-sm text-fly-lightgray/70">Preguntas sugeridas:</p>
          <div className="flex flex-wrap gap-2">
            {SUGGESTED_QUESTIONS.map((q) => (
              <button
                key={q}
                type="button"
                onClick={() => askAboutPlan(q)}
                className="text-xs rounded-full border border-fly-gray px-3 py-1.5 hover:border-fly-gold"
              >
                {q}
              </button>
            ))}
          </div>
          <textarea
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder={t("query_placeholder")}
            className="w-full rounded-lg bg-fly-black border border-fly-gray p-3 text-sm min-h-[4rem]"
          />
          <BigActionButton onClick={() => askAboutPlan(question)} disabled={loading}>
            {loading ? "Analizando..." : t("action_analyzePlan")}
          </BigActionButton>
          {error && (
            <div className="rounded-lg border border-risk-critical bg-risk-critical/10 p-3 text-sm text-risk-critical">
              {error}
            </div>
          )}
          {saveWarning && (
            <div className="rounded-lg border border-fly-gold bg-fly-gold/10 p-3 text-sm text-fly-gold">
              ⚠ {saveWarning}
            </div>
          )}
        </div>
      </div>

      <div className="space-y-4">
        {queries.length === 0 && (
          <p className="text-sm text-fly-lightgray/60">Aun no hay preguntas sobre este plano.</p>
        )}
        {queries.map((q) => (
          <div key={q.id} className="space-y-1">
            <p className="text-sm font-medium text-fly-lightgray/80">{q.question}</p>
            <AssistantResponseCard response={q.response} uiLang={uiLang} />
          </div>
        ))}
      </div>
    </div>
  );
}
