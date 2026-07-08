"use client";

import { useState } from "react";
import Link from "next/link";
import type { Project, QueryRecord } from "@/lib/db/types";
import { BigActionButton } from "@/components/ui/BigActionButton";
import { AssistantResponseCard } from "@/components/assistant/AssistantResponseCard";
import { VoiceRecorder } from "@/components/assistant/VoiceRecorder";
import { LanguageToggle } from "@/components/ui/LanguageToggle";
import { useLanguage } from "@/lib/i18n/useLanguage";

export function ConsultaClient({ projects }: { projects: Project[] }) {
  const { mode, changeMode, uiLang, t } = useLanguage();
  const [tab, setTab] = useState<"texto" | "voz">("texto");
  const [question, setQuestion] = useState("");
  const [projectId, setProjectId] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<QueryRecord | null>(null);
  const [escalated, setEscalated] = useState(false);

  async function submitQuery(q: string, queryMode: "texto" | "voz") {
    if (!q.trim()) return;
    setLoading(true);
    setResult(null);
    setEscalated(false);
    const res = await fetch("/api/queries", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        question: q,
        mode: queryMode,
        language: mode,
        projectId: projectId || null
      })
    });
    setLoading(false);
    if (!res.ok) return;
    const data = await res.json();
    setResult(data.query);
  }

  async function escalate() {
    if (!result) return;
    const res = await fetch(`/api/queries/${result.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "escalate" })
    });
    if (res.ok) setEscalated(true);
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-fly-gold">{t("nav_newQuery")}</h1>
        <LanguageToggle value={mode} onChange={changeMode} />
      </div>

      <div>
        <label className="block text-sm text-fly-lightgray/70 mb-1">{t("query_project")}</label>
        <select
          value={projectId}
          onChange={(e) => setProjectId(e.target.value)}
          className="w-full rounded-lg bg-fly-black border border-fly-gray p-3 text-sm"
        >
          <option value="">{t("query_none")}</option>
          {projects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </div>

      <div className="flex rounded-xl border border-fly-gray overflow-hidden">
        <TabButton active={tab === "texto"} onClick={() => setTab("texto")} label={t("query_textTab")} />
        <TabButton active={tab === "voz"} onClick={() => setTab("voz")} label={t("query_voiceTab")} />
      </div>

      {tab === "texto" ? (
        <div className="space-y-3">
          <textarea
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder={t("query_placeholder")}
            className="w-full min-h-[6rem] rounded-lg bg-fly-black border border-fly-gray p-3"
          />
          <BigActionButton onClick={() => submitQuery(question, "texto")} disabled={loading}>
            {loading ? "..." : t("query_submit")}
          </BigActionButton>
        </div>
      ) : (
        <div className="space-y-3">
          <VoiceRecorder
            lang={uiLang === "en" ? "en-US" : "es-US"}
            labelIdle={t("query_recordStart")}
            labelRecording={t("query_recordStop")}
            onResult={(transcript) => {
              setQuestion(transcript);
              submitQuery(transcript, "voz");
            }}
          />
          {question && <p className="text-sm text-fly-lightgray/80">"{question}"</p>}
        </div>
      )}

      {result && (
        <AssistantResponseCard
          response={result.response}
          uiLang={uiLang}
          actions={
            <>
              {result.requiresMasterReview && !escalated && (
                <p className="text-xs text-fly-gold">
                  ⚠ {uiLang === "en" ? "Automatically flagged for Master review due to risk level." : "Marcado automaticamente para revision del Master por el nivel de riesgo."}
                </p>
              )}
              <div className="grid grid-cols-2 gap-2">
                <BigActionButton variant="secondary" onClick={escalate} disabled={escalated}>
                  {escalated ? t("action_escalated") : t("action_escalate")}
                </BigActionButton>
                <Link href={`/reportes/${result.id}/print`}>
                  <BigActionButton variant="ghost" type="button">
                    {t("action_generateReport")}
                  </BigActionButton>
                </Link>
              </div>
            </>
          }
        />
      )}
    </div>
  );
}

function TabButton({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex-1 py-3 text-sm font-semibold ${active ? "bg-fly-gold text-fly-black" : "bg-fly-charcoal text-fly-white"}`}
    >
      {label}
    </button>
  );
}
