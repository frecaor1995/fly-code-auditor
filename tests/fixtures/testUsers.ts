import type { User } from "@/lib/db/types";

// Usuarios de prueba: son los mismos 5 usuarios demo ya versionados en
// data/users.json (no son cuentas personales ni credenciales nuevas; son el
// dataset demo que el proyecto ya usa desde el inicio). Se reexportan aqui
// con tipos fuertes para que los tests no dupliquen los literales.
export const TEST_ADMIN: User = {
  id: "u-admin",
  name: "Fly Admin",
  email: "admin@flyelectric.com",
  password: "demo1234",
  role: "owner_admin",
  preferredLanguage: "bilingual"
};

export const TEST_MASTER: User = {
  id: "u-master",
  name: "Roberto Flores (Master Electrician)",
  email: "master@flyelectric.com",
  password: "demo1234",
  role: "master_electrician",
  preferredLanguage: "bilingual"
};

export const TEST_TECNICO: User = {
  id: "u-tecnico",
  name: "Luis Martinez (Tecnico)",
  email: "tecnico@flyelectric.com",
  password: "demo1234",
  role: "tecnico",
  preferredLanguage: "es"
};

export const TEST_AYUDANTE: User = {
  id: "u-ayudante",
  name: "Junior Perez (Ayudante)",
  email: "ayudante@flyelectric.com",
  password: "demo1234",
  role: "ayudante",
  preferredLanguage: "es"
};

export const TEST_OFICINA: User = {
  id: "u-oficina",
  name: "Sandra Gomez (Oficina)",
  email: "oficina@flyelectric.com",
  password: "demo1234",
  role: "oficina",
  preferredLanguage: "en"
};
