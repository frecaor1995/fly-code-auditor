"use client";

import { useState } from "react";
import Link from "next/link";
import type { QueryRecord } from "@/lib/db/types";
import { AssistantResponseCard } from "@/components/assistant/AssistantResponseCard";
import { BigActionButton } from "@/components/ui/BigActionButton";
import { useLanguage } from "@/lib/i18n/useLanguage";

export function HistorialDetailClient({ query }: { query: QueryRecord }) {
  const { uiLang, t } = useLanguage();
  const [requiresReview, setRequiresReview] = useState(query.requiresMasterReview);
  const [escalated, setEscalated] = useState(false);

  async function escalate() {
    const res = await fetch(`/api/queries/${query.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "escalate" })
    });
    if (res.ok) {
      setRequiresReview(true);
      setEscalated(true);
    }
  }

  return (
    <div className="space-y-3">
      <p className="text-sm font-medium text-fly-lightgray/80">{query.question}</p>
      <AssistantResponseCard
        response={query.response}
        uiLang={uiLang}
        actions={
          <div className="grid grid-cols-2 gap-2">
            <BigActionButton variant="secondary" onClick={escalate} disabled={requiresReview}>
              {requiresReview ? (escalated ? t("action_escalated") : "Ya requiere revision del Master") : t("action_escalate")}
            </BigActionButton>
            <Link href={`/reportes/${query.id}/print`}>
              <BigActionButton variant="ghost" type="button">
                {t("action_generateReport")}
              </BigActionButton>
            </Link>
          </div>
        }
      />
    </div>
  );
}
