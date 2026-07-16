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
  const [saveWarning, setSaveWarning] = useState<string | null>(null);
  const [providerNotice, setProviderNotice] = useState<string | null>(null);

  async function submitQuery(q: string, queryMode: "texto" | "voz") {
    if (!q.trim()) return;
    setLoading(true);
    setResult(null);
    setEscalated(false);
    setError(null);
    setSaveWarning(null);
    setProviderNotice(null);
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

      // app/api/queries/route.ts esta disenado para devolver SIEMPRE un
      // "answer" utilizable con HTTP 200/201, incluso si Supabase o el
      // proveedor de IA fallaron (ver providerFallback/saveError abajo): un
      // fallo recuperable en esos servicios NUNCA debe leerse como "no hay
      // conexion con el servidor". Solo la ausencia total de "answer" en
      // una respuesta valida cuenta como que el servidor no pudo generar
      // nada.
      if (data?.answer) {
        setResult(
          data.query ?? {
            id: data.queryId ?? `local-${Date.now()}`,
            projectId: projectId || null,
            planId: null,
            userId: "",
            mode: queryMode,
            language: mode,
            question: q,
            response: { shortAnswer: data.answer, riskLevel: "medio", codeReference: "", checklist: [], missingQuestions: [], recommendation: "", warning: "" },
            riskLevel: "medio",
            requiresMasterReview: false,
            createdAt: new Date().toISOString()
          }
        );

        // La respuesta se genero correctamente aunque el guardado en
        // Supabase haya fallado: nunca se deja la pantalla vacia, solo se
        // avisa que no quedo guardada.
        if (data.persisted === false) {
          setSaveWarning(
            uiLang === "en"
              ? "The response was generated, but it could not be saved to the database."
              : "La respuesta fue generada, pero no pudo guardarse en la base de datos."
          );
        }

        // providerFallback=true significa que el proveedor de IA (OpenAI)
        // fallo y la respuesta vino del motor tecnico local en su lugar:
        // es informativo, no un error, y no debe mezclarse con el aviso de
        // guardado ni con un mensaje de "sin conexion".
        if (data.providerFallback) {
          setProviderNotice(
            uiLang === "en"
              ? "The AI provider was unavailable, so this answer came from the local technical engine."
              : "El proveedor de IA no estaba disponible, asi que esta respuesta vino del motor tecnico local."
          );
        }
        return;
      }

      // El servidor SI respondio (HTTP valido) pero sin ningun "answer"
      // utilizable (error 400/401/403, body invalido, etc.): mostramos una
      // respuesta mock de respaldo generada en el cliente para no dejar el
      // panel vacio, dejando visible el motivo real del fallo arriba. Esto
      // es distinto de "no se pudo conectar": el servidor si contesto.
      setError(
        data?.error ??
          (uiLang === "en"
            ? "The server could not generate a response. Showing a local fallback answer."
            : "El servidor no pudo generar una respuesta. Mostrando una respuesta de respaldo local.")
      );
      setResult(buildLocalFallbackQuery(q, queryMode, mode));
    } catch (err) {
      // Este catch SOLO se alcanza si fetch() en si mismo fallo (sin
      // respuesta HTTP alguna: red caida, DNS, timeout de conexion, CORS).
      // Es el unico caso real de "no se pudo conectar con el servidor".
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

      {saveWarning && (
        <div className="rounded-lg border border-fly-gold bg-fly-gold/10 p-3 text-sm text-fly-gold">
          ⚠ {saveWarning}
        </div>
      )}

      {providerNotice && (
        <div className="rounded-lg border border-fly-lightgray/40 bg-fly-charcoal p-3 text-sm text-fly-lightgray/80">
          ℹ {providerNotice}
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
