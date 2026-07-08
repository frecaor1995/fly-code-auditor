import { getCurrentUser } from "@/lib/auth/session";
import { ROLE_LABELS } from "@/lib/auth/permissions";
import { SettingsClient } from "@/components/settings/SettingsClient";

export default function ConfiguracionPage() {
  const user = getCurrentUser()!;

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold text-fly-gold">Configuracion</h1>
      <SettingsClient userName={user.name} roleLabel={`${ROLE_LABELS[user.role].es} / ${ROLE_LABELS[user.role].en}`} email={user.email} />
    </div>
  );
}
