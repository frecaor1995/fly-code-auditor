import { getCurrentUser } from "@/lib/auth/session";
import { redirect } from "next/navigation";
import { ROLE_LABELS } from "@/lib/auth/permissions";
import { SettingsClient } from "@/components/settings/SettingsClient";

export default function ConfiguracionPage() {
  // Ver nota en app/(app)/dashboard/page.tsx: guard explicito en vez de "!",
  // mismo hallazgo real detectado por la suite E2E.
  const user = getCurrentUser();
  if (!user) redirect("/login");

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold text-fly-gold">Configuracion</h1>
      <SettingsClient userName={user.name} roleLabel={`${ROLE_LABELS[user.role].es} / ${ROLE_LABELS[user.role].en}`} email={user.email} />
    </div>
  );
}
