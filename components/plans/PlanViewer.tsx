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

  async function askAboutPlan(q: string) {
    if (!q.trim()) return;
    setLoading(true);
    const res = await fetch(`/api/plans/${plan.id}/analyze`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question: q, language: mode })
    });
    setLoading(false);
    if (!res.ok) return;
    const data = await res.json();
    setQueries((prev) => [data.query, ...prev]);
    setQuestion("");
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
