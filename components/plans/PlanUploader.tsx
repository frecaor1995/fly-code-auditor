"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { Project } from "@/lib/db/types";
import { BigActionButton } from "@/components/ui/BigActionButton";

const SHEETS = [
  "E0.1 General Notes",
  "E1.1 Lighting Plan",
  "E2.1 Power Plan",
  "E3.1 One-Line Diagram",
  "E4.1 Panel Schedules",
  "E5.1 Details"
];

export function PlanUploader({ projects }: { projects: Project[] }) {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [projectId, setProjectId] = useState("");
  const [sheet, setSheet] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!file) {
      setError("Selecciona un archivo PDF, JPG o PNG.");
      return;
    }
    setLoading(true);
    setError(null);
    const form = new FormData();
    form.append("file", file);
    if (projectId) form.append("projectId", projectId);
    if (sheet) form.append("sheet", sheet);

    const res = await fetch("/api/plans", { method: "POST", body: form });
    setLoading(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "No se pudo subir el plano.");
      return;
    }
    const data = await res.json();
    router.push(`/planos/${data.plan.id}`);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3 rounded-2xl border border-fly-gray bg-fly-charcoal p-4">
      <div>
        <label className="block text-sm text-fly-lightgray/70 mb-1">Archivo (PDF, JPG, PNG)</label>
        <input
          type="file"
          accept=".pdf,.jpg,.jpeg,.png"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          className="block w-full text-sm text-fly-white file:mr-3 file:rounded-lg file:border-0 file:bg-fly-gold file:px-3 file:py-2 file:text-fly-black file:font-semibold"
        />
      </div>
      <div>
        <label className="block text-sm text-fly-lightgray/70 mb-1">Proyecto (opcional)</label>
        <select
          value={projectId}
          onChange={(e) => setProjectId(e.target.value)}
          className="w-full rounded-lg bg-fly-black border border-fly-gray p-3 text-sm"
        >
          <option value="">Sin proyecto</option>
          {projects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="block text-sm text-fly-lightgray/70 mb-1">Hoja del plano (opcional)</label>
        <select
          value={sheet}
          onChange={(e) => setSheet(e.target.value)}
          className="w-full rounded-lg bg-fly-black border border-fly-gray p-3 text-sm"
        >
          <option value="">No especificada</option>
          {SHEETS.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </div>
      {error && <p className="text-sm text-risk-critical">{error}</p>}
      <BigActionButton type="submit" disabled={loading}>
        {loading ? "Subiendo..." : "Subir plano"}
      </BigActionButton>
    </form>
  );
}
