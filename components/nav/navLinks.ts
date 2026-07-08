import type { Role } from "@/lib/db/types";
import type { DictionaryKey } from "@/lib/i18n/dictionary";

export interface NavLink {
  href: string;
  labelKey: DictionaryKey;
  icon: string;
  roles?: Role[];
}

export const NAV_LINKS: NavLink[] = [
  { href: "/dashboard", labelKey: "nav_dashboard", icon: "🏠" },
  { href: "/consulta", labelKey: "nav_newQuery", icon: "💬" },
  { href: "/planos", labelKey: "nav_plans", icon: "🗂️" },
  { href: "/historial", labelKey: "nav_history", icon: "🕒" },
  { href: "/proyectos", labelKey: "nav_projects", icon: "📁" },
  {
    href: "/revision-master",
    labelKey: "nav_masterReview",
    icon: "✅",
    roles: ["master_electrician", "owner_admin"]
  },
  { href: "/reportes", labelKey: "nav_reports", icon: "📄" },
  { href: "/base-conocimiento", labelKey: "nav_knowledgeBase", icon: "📚" },
  { href: "/configuracion", labelKey: "nav_settings", icon: "⚙️" }
];

export function visibleLinks(role: Role): NavLink[] {
  return NAV_LINKS.filter((link) => !link.roles || link.roles.includes(role));
}
