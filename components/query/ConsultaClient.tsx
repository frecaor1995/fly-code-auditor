"use client";

import { useState } from "react";
import Link from "next/link";
import type { Language, Project, QueryRecord } from "@/lib/db/types";
import { BigActionButton } from "@/components/ui/BigActionButton";
import { AssistantResponseCard } from "@/components/assistant/AssistantResponseCard";
import { VoiceRecorder } from "@/components/assistant/VoiceRecorder";
import { LanguageToggle } from "@/components/ui/LanguageToggle";
import { useLanguage } from "@/lib/i18n/useLanguage";
import { buildOfflineFallbackResponse } from "@/lib/ai/localFallback";

// Se usa cuando /api/queries no responde de forma utilizable (red caida,
// error 500, respuesta no-JSON, etc.). Garantiza que "Preguntar" siempre
// muestre un panel de respuesta, incluso sin backend disponible.
function buildLocalFallbackQuery(question: string, queryMode: "texto" | "voz", language: Language): QueryRecord {
  const response = buildOfflineFallbackResponse(language);
  return {
    id: `local-${Date.now()}`,
    projectId: null,
    planId: null,
    userId: "",
    mode: queryMode,
    language,
    question,
    response,
    riskLevel: response.riskLevel,
    requiresMasterReview: false,
    createdAt: new Date().toISOString()
  };
}

export function ConsultaClient({ projects }: { projects: Project[] }) {
  const { mode, changeMode, uiLang, t } = useLanguage();
  const [tab, setTab] = useState<"texto" | "voz">("texto");
  const [question, setQuestion] = useState("");
  const [projectId, setProjectId] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<QueryRecord | null>(null);
  const [escalated, setEscalated] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submitQuery(q: string, queryMode: "texto" | "voz") {
    if (!q.trim()) return;
    setLoading(true);
    setResult(null);
    setEscalated(false);
    setError(null);
    console.log("[ConsultaClient] Pregunta enviada:", q);
    try {
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
      const data = await res.json().catch(() => null);
      console.log("[ConsultaClient] Respuesta recibida:", data);

      if (res.ok && data?.query) {
        setResult(data.query);
        return;
      }

      // El servidor respondio pero sin un query utilizable (error 500,
      // permisos, body invalido, etc.): igual mostramos una respuesta mock
      // de respaldo generada en el cliente para no dejar el panel vacio,
      // dejando visible el motivo real del fallo arriba.
      setError(
        data?.error ??
          (uiLang === "en"
            ? "The server could not generate a response. Showing a local fallback answer."
            : "El servidor no pudo generar una respuesta. Mostrando una respuesta de respaldo local.")
      );
      setResult(buildLocalFallbackQuery(q, queryMode, mode));
    } catch (err) {
      console.error("[ConsultaClient] Error de red o inesperado:", err);
      setError(
        uiLang === "en"
          ? "Could not reach the server. Showing a local fallback answer."
          : "No se pudo conectar con el servidor. Mostrando una respuesta de respaldo local."
      );
      setResult(buildLocalFallbackQuery(q, queryMode, mode));
    } finally {
      setLoading(false);
    }
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
            uiLang={uiLang}
            labelIdle={t("query_recordStart")}
            labelRecording={t("query_recordStop")}
            onResult={(transcript) => {
              setQuestion(transcript);
              submitQuery(transcript, "voz");
            }}
            onUseTextFallback={() => setTab("texto")}
          />
          {question && <p className="text-sm text-fly-lightgray/80">"{question}"</p>}
        </div>
      )}

      {error && (
        <div className="rounded-lg border border-risk-critical bg-risk-critical/10 p-3 text-sm text-risk-critical">
          {error}
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
