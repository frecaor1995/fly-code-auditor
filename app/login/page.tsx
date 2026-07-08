"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const DEMO_USERS = [
  { email: "admin@flyelectric.com", role: "Owner / Admin" },
  { email: "master@flyelectric.com", role: "Master Electrician" },
  { email: "tecnico@flyelectric.com", role: "Tecnico" },
  { email: "ayudante@flyelectric.com", role: "Ayudante" },
  { email: "oficina@flyelectric.com", role: "Oficina / Administrativo" }
];

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password })
    });
    setLoading(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Correo o contrasena incorrectos.");
      return;
    }
    router.push("/dashboard");
    router.refresh();
  }

  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-fly-gold">Fly Code Auditor</h1>
          <p className="text-sm text-fly-lightgray/70">
            Asistente tecnico interno de Fly Electric Solutions LLC
            <br />
            Internal technical assistant for Fly Electric Solutions LLC
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3 rounded-2xl border border-fly-gray bg-fly-charcoal p-5">
          <div>
            <label className="block text-sm text-fly-lightgray/70 mb-1">Correo / Email</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-lg bg-fly-black border border-fly-gray p-3"
              placeholder="tecnico@flyelectric.com"
            />
          </div>
          <div>
            <label className="block text-sm text-fly-lightgray/70 mb-1">Contrasena / Password</label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-lg bg-fly-black border border-fly-gray p-3"
              placeholder="demo1234"
            />
          </div>
          {error && <p className="text-sm text-risk-critical">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="w-full min-h-[3.25rem] rounded-xl bg-fly-gold text-fly-black font-bold hover:bg-fly-goldlight transition disabled:opacity-50"
          >
            {loading ? "Entrando..." : "Entrar / Sign in"}
          </button>
        </form>

        <div className="rounded-xl border border-fly-gray/60 p-4 text-xs text-fly-lightgray/60">
          <p className="font-semibold mb-1">Usuarios demo (contrasena: demo1234)</p>
          <ul className="space-y-0.5">
            {DEMO_USERS.map((u) => (
              <li key={u.email}>
                {u.email} — {u.role}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </main>
  );
}
