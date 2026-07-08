"use client";

import { useState } from "react";
import type { QueryRecord, ReviewRecord } from "@/lib/db/types";
import { RiskBadge } from "@/components/ui/RiskBadge";
import { BigActionButton } from "@/components/ui/BigActionButton";
import { formatDateTime } from "@/lib/utils/dates";

export function ReviewQueueItem({ query, review }: { query: QueryRecord; review: ReviewRecord | null }) {
  const [comment, setComment] = useState(review?.comment ?? "");
  const [status, setStatus] = useState(review?.status ?? "pending");
  const [saving, setSaving] = useState(false);

  async function decide(newStatus: "approved" | "needs_changes") {
    setSaving(true);
    const res = await fetch("/api/reviews", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ queryId: query.id, status: newStatus, comment })
    });
    setSaving(false);
    if (res.ok) setStatus(newStatus);
  }

  return (
    <div className="rounded-2xl border border-fly-gray bg-fly-charcoal p-4 space-y-2">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs text-fly-lightgray/60">{formatDateTime(query.createdAt)}</span>
        <RiskBadge risk={query.riskLevel} />
      </div>
      <p className="text-sm font-medium">{query.question}</p>
      <p className="text-sm text-fly-lightgray/80">{query.response.shortAnswer}</p>
      <p className="text-xs">
        Estado:{" "}
        <span className="font-semibold text-fly-gold">
          {status === "pending" ? "Pendiente" : status === "approved" ? "Aprobado" : "Requiere cambios"}
        </span>
      </p>
      <textarea
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        placeholder="Comentario del Master Electrician..."
        className="w-full rounded-lg bg-fly-black border border-fly-gray p-2 text-sm min-h-[3rem]"
      />
      <div className="grid grid-cols-2 gap-2">
        <BigActionButton variant="secondary" onClick={() => decide("approved")} disabled={saving}>
          Aprobar
        </BigActionButton>
        <BigActionButton variant="danger" onClick={() => decide("needs_changes")} disabled={saving}>
          Requiere cambios
        </BigActionButton>
      </div>
    </div>
  );
}
