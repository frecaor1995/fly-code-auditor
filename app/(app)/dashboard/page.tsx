import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { ROLE_LABELS } from "@/lib/auth/permissions";
import { getProjects, getQueries } from "@/lib/db/dbAdapter";
import { QueryHistoryItem } from "@/components/history/QueryHistoryItem";

export default async function DashboardPage() {
  // Hallazgo real (detectado por Playwright E2E, ver tests/e2e/auth.spec.ts
  // "una ruta protegida sin sesion redirige a /login"): confiar en "!" aqui
  // asumia que app/(app)/layout.tsx SIEMPRE redirige antes de que esta
  // pagina se ejecute, pero bajo ciertas condiciones de render/streaming de
  // RSC el body de la pagina puede empezar a correr igual, y el "!" convertia
  // un caso legitimo (sin sesion) en un TypeError sin manejar en el server.
  // Mismo guard explicito que ya usa el layout, como defensa en profundidad.
  const user = getCurrentUser();
  if (!user) redirect("/login");
  const allQueries = await getQueries();
  const queries = allQueries.slice(0, 5);
  const pendingReview = allQueries.filter((q) => q.requiresMasterReview);
  const projects = await getProjects();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-fly-gold">Hola, {user.name.split(" ")[0]}</h1>
        <p className="text-sm text-fly-lightgray/70">{ROLE_LABELS[user.role].es} / {ROLE_LABELS[user.role].en}</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <QuickLink href="/consulta" icon="💬" label="Nueva consulta" />
        <QuickLink href="/planos" icon="🗂️" label="Subir plano" />
        <QuickLink href="/proyectos" icon="📁" label="Proyectos" />
        <QuickLink href="/revision-master" icon="✅" label="Revision Master" badge={pendingReview.length} />
      </div>

      <div className="grid md:grid-cols-3 gap-3">
        <StatCard label="Proyectos activos" value={projects.filter((p) => p.status === "activo").length} />
        <StatCard label="Consultas totales" value={allQueries.length} />
        <StatCard label="Pendientes de revision del Master" value={pendingReview.length} />
      </div>

      <div>
        <div className="flex items-center justify-between mb-2">
          <h2 className="font-semibold text-fly-white">Consultas recientes</h2>
          <Link href="/historial" className="text-sm text-fly-gold hover:underline">
            Ver historial completo
          </Link>
        </div>
        <div className="space-y-2">
          {queries.length === 0 && (
            <p className="text-sm text-fly-lightgray/60">Aun no hay consultas registradas.</p>
          )}
          {queries.map((q) => (
            <QueryHistoryItem key={q.id} query={q} />
          ))}
        </div>
      </div>
    </div>
  );
}

function QuickLink({ href, icon, label, badge }: { href: string; icon: string; label: string; badge?: number }) {
  return (
    <Link
      href={href}
      className="relative flex flex-col items-center justify-center gap-2 rounded-2xl border border-fly-gray bg-fly-charcoal py-5 hover:border-fly-gold transition text-center"
    >
      {badge !== undefined && badge > 0 && (
        <span className="absolute top-2 right-2 bg-risk-critical text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
          {badge}
        </span>
      )}
      <span className="text-2xl">{icon}</span>
      <span className="text-xs font-semibold">{label}</span>
    </Link>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-fly-gray bg-fly-charcoal p-4">
      <p className="text-2xl font-bold text-fly-gold">{value}</p>
      <p className="text-xs text-fly-lightgray/70">{label}</p>
    </div>
  );
}
