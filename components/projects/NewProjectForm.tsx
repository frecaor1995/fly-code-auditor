"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { BigActionButton } from "@/components/ui/BigActionButton";

export function NewProjectForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [client, setClient] = useState("");
  const [address, setAddress] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const res = await fetch("/api/projects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, client, address })
    });
    setLoading(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "No se pudo crear el proyecto.");
      return;
    }
    const data = await res.json();
    router.push(`/proyectos/${data.project.id}`);
  }

  if (!open) {
    return (
      <BigActionButton onClick={() => setOpen(true)} type="button">
        + Nuevo proyecto
      </BigActionButton>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3 rounded-2xl border border-fly-gray bg-fly-charcoal p-4">
      <input
        required
        placeholder="Nombre del proyecto"
        value={name}
        onChange={(e) => setName(e.target.value)}
        className="w-full rounded-lg bg-fly-black border border-fly-gray p-3 text-sm"
      />
      <input
        required
        placeholder="Cliente"
        value={client}
        onChange={(e) => setClient(e.target.value)}
        className="w-full rounded-lg bg-fly-black border border-fly-gray p-3 text-sm"
      />
      <input
        placeholder="Direccion"
        value={address}
        onChange={(e) => setAddress(e.target.value)}
        className="w-full rounded-lg bg-fly-black border border-fly-gray p-3 text-sm"
      />
      {error && <p className="text-sm text-risk-critical">{error}</p>}
      <BigActionButton type="submit" disabled={loading}>
        {loading ? "Creando..." : "Crear proyecto"}
      </BigActionButton>
    </form>
  );
}
